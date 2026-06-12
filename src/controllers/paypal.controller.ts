import { prisma } from "../config/prisma.js";
import { Request, Response } from "express";
import { getPayPalAccessToken, PAYPAL_BASE_URL } from "../config/paypal.js";
import { sendOrderConfirmationEmail } from "../services/email.service.js";


// ─── STEP 1: Create PayPal order + DB record ────────────────────────────────
// STEP 1: Don't save to DB — just create the PayPal order
export const placeOrderPaypal = async (req: Request, res: Response) => {
  try {
    const {
      userId, items, amount, deliveryFee,
      email, firstName, lastName,
      address: addressLine, suburb, state, postcode, phone, country,
    } = req.body;

    const origin = (req.headers.origin as string) || "";
    const accessToken = await getPayPalAccessToken();

    // ✅ No DB write here
    const paypalRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "AUD",
            value: (amount + deliveryFee).toFixed(2),
            breakdown: {
              item_total: { currency_code: "AUD", value: amount.toFixed(2) },
              shipping:   { currency_code: "AUD", value: deliveryFee.toFixed(2) },
            },
          },
          items: items.map((item: any) => ({
            name: item.name,
            quantity: String(item.quantity),
            unit_amount: { currency_code: "AUD", value: item.price.toFixed(2) },
          })),
        }],
        application_context: {
          return_url:  `${origin}/checkout/success?paypal=true`,
          cancel_url:  `${origin}/checkout?paypal=cancelled`,
          brand_name:  "Top Dog Working Dog",
          user_action: "PAY_NOW",
        },
      }),
    });

    const paypalData = await paypalRes.json();
    if (!paypalRes.ok) throw new Error(paypalData?.message || "PayPal order creation failed");

    const approvalUrl = paypalData.links?.find((l: any) => l.rel === "approve")?.href;
    if (!approvalUrl) throw new Error("No PayPal approval URL");

    // ✅ Pass customer data + cart back to frontend to send on capture
    res.json({
      success: true,
      session_url: approvalUrl,
      paypalOrderId: paypalData.id,
      username: `${firstName} ${lastName}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

// STEP 2: Capture — create DB order ONLY on success
export const verifyPaypal = async (req: Request, res: Response) => {
  const { token, customerData, cartItems, amount, deliveryFee } = req.body;
  // Frontend sends token (PayPal order token from return URL) + the cart/customer data

  if (!token) {
    return res.status(400).json({ success: false, message: "Missing PayPal token" });
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const captureRes = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${token}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureData = await captureRes.json();

    if (!captureRes.ok || captureData.status !== "COMPLETED") {
      throw new Error("PayPal capture failed: " + JSON.stringify(captureData));
    }

    // ✅ Payment confirmed — now safe to create the order
    const order = await prisma.order.create({
      data: {
        email:        customerData.email,
        firstName:    customerData.firstName,
        lastName:     customerData.lastName,
        address:      customerData.address,
        suburb:       customerData.suburb,
        state:        customerData.state,
        postcode:     customerData.postcode,
        phone:        customerData.phone,
        country:      customerData.country || "Australia",
        subtotal:     amount,
        deliveryFee,
        total:        amount + deliveryFee,
        paymentMethod: "PAYPAL",
        paid:         true,
        status:       "PENDING",
        userId:       customerData.userId ? String(customerData.userId) : null,
        items: {
          create: cartItems.map((item: any) => ({
            productName: item.name,
            variant:     item.variant || "",
            quantity:    item.quantity,
            price:       item.price,
            color:       item.color || "",
            size:        item.size || "",
          })),
        },
      },
      include: { items: true },
    });

    sendOrderConfirmationEmail({
      email:         order.email,
      firstName:     order.firstName,
      lastName:      order.lastName,
      orderNumber:   order.orderNumber,
      items:         order.items,
      subtotal:      order.subtotal,
      deliveryFee:   order.deliveryFee,
      total:         order.total,
      address:       order.address,
      suburb:        order.suburb,
      state:         order.state,
      postcode:      order.postcode,
      country:       order.country,
      paymentMethod: order.paymentMethod,
    }).catch((err) => console.error("PayPal confirmation email error:", err));

    res.json({ success: true, orderId: order.id });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};