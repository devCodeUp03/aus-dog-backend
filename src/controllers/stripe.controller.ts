import { prisma } from "../config/prisma.js";
import { stripe } from "../config/stripe.js";
import { Request, Response } from "express";
import { sendOrderConfirmationEmail } from "../services/email.service.js";

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
        userId: userId ? String(userId) : null,
        paid: false,
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
      include: { items: true },
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
      cancel_url: `${origin}/checkout/success?success=false&orderId=${newOrder.id}`,
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
  const { orderId, success } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Missing orderId" });
  }

  try {
    if (success === "true" || success === true) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      // ✅ Idempotent — if already marked paid (e.g. webhook beat us to it), skip duplicate email
      if (order.paid) {
        return res.json({ success: true, message: "Already verified." });
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { paid: true },
        include: { items: true },
      });

      sendOrderConfirmationEmail({
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        orderNumber: updated.orderNumber,
        items: updated.items,
        subtotal: updated.subtotal,
        deliveryFee: updated.deliveryFee,
        total: updated.total,
        address: updated.address,
        suburb: updated.suburb,
        state: updated.state,
        postcode: updated.postcode,
        country: updated.country,
        paymentMethod: updated.paymentMethod,
      }).catch((err) => console.error("Stripe confirmation email error:", err));

      res.json({ success: true, message: "Payment successful." });
    } else {
      // ✅ Cancelled — delete the unpaid ghost order
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (order && !order.paid) {
        await prisma.order.delete({ where: { id: orderId } });
      }

      res.json({ success: false, message: "Payment failed. Pending order cleared." });
    }
  } catch (error: any) {
    if (error?.code === "P2025") {
      // Already deleted, fine
      return res.json({ success: false, message: "Order already cleared." });
    }
    console.error("Verification Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

export { placeOrderStripe, verifyStripe };
