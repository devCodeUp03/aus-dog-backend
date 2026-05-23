import { prisma } from "../config/prisma.js";
import { stripe } from "../config/stripe.js";
import { Request, Response } from "express";



const placeOrderStripe = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      items,
      amount,
      deliveryFee,
      email,
      firstName,
      lastName,
      address: addressLine,
      suburb,
      state,
      postcode,
      phone,
      country,
    } = req.body;

    const origin = (req.headers.origin as string) || "";

    // 1. Create the Order and OrderItems in one transaction (Supabase)
    const newOrder = await prisma.order.create({
      data: {
        email,
        firstName,
        lastName,
        address: addressLine,
        suburb,
        state,
        postcode,
        phone,
        country: country || "Australia",
        subtotal: amount,
        deliveryFee: deliveryFee,
        total: amount + deliveryFee,
        paymentMethod: "STRIPE",
        items: {
          create: (items || []).map((item: any) => ({
            productName: item.name,
            variant: item.variant || "",
            quantity: item.quantity,
            price: item.price,
            color: item.color || "",
            size: item.size || "",
          })),
        },
      },
    });

    // 2. Prepare line items for Stripe
    const line_items = items.map((item: any) => ({
      price_data: {
        currency: "aud", // Adjust currency if needed
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100), // Stripe expects cents
      },
      quantity: item.quantity,
    }));

    // Add delivery fee
    line_items.push({
      price_data: {
        currency: "aud",
        product_data: { name: "Delivery Fee" },
        unit_amount: Math.round(deliveryFee * 100),
      },
      quantity: 1,
    });

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/checkout/success?success=true&orderId=${newOrder.id}`,
      cancel_url: `${origin}/verify?success=false&orderId=${newOrder.id}`,
      line_items,
      mode: "payment",
      metadata: { orderId: newOrder.id }, // Keep track of ID
    });

    res.json({ success: true, session_url: session.url, items, username: `${firstName} ${lastName}` });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};



const verifyStripe = async (req: Request, res: Response) => {
  const { orderId, success } = req.body; // userId is removed

  try {
    if (success === "true" || success === true) {
      // Payment was successful. No `status` field on Order model anymore,
      // so just return success. Frontend should handle cart clearing.
      res.json({ success: true, message: "Payment successful." });
    } else {
      // 2. If user cancelled or payment failed, remove the pending order
      await prisma.order.delete({
        where: { id: orderId },
      });

      res.json({ success: false, message: "Payment failed. Pending order cleared." });
    }
  } catch (error) {
    console.error("Verification Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};



export { placeOrderStripe, verifyStripe };
