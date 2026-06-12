// routes/webhook.routes.ts
import express from "express";
import { stripe } from "../config/stripe.js";
import { prisma } from "../config/prisma.js";
import { sendOrderConfirmationEmail, sendRefundEmail } from "../services/email.service.js";

const router = express.Router();

// ⚠️ Raw body middleware applied at the ROUTE level (not globally)
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${err}`);
    }

    res.json({ received: true });

    if (event.type === "checkout.session.completed") {
  const session = event.data.object as any;
  if (session.payment_status !== "paid") return;

  // Check if order already exists (idempotency — Stripe may retry)
  const existing = await prisma.order.findFirst({
    where: { stripeSessionId: session.id }
  });
  if (existing) return;

  const customerData = JSON.parse(session.metadata.customerData);
  const cartItems    = JSON.parse(session.metadata.cartItems);
  const amount       = parseFloat(session.metadata.amount);
  const deliveryFee  = parseFloat(session.metadata.deliveryFee);

  const order = await prisma.order.create({
    data: {
      stripeSessionId: session.id,   // add this field to your schema
      email:        customerData.email,
      firstName:    customerData.firstName,
      lastName:     customerData.lastName,
      address:      customerData.address,
      suburb:       customerData.suburb,
      state:        customerData.state,
      postcode:     customerData.postcode,
      phone:        customerData.phone,
      country:      customerData.country,
      subtotal:     amount,
      deliveryFee,
      total:        amount + deliveryFee,
      paymentMethod: "STRIPE",
      paid:         true,
      status:       "PENDING",
      userId:       customerData.userId,
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

  sendOrderConfirmationEmail({ ...order }).catch(console.error);
}

    if (event.type === "charge.refunded") {
      try {
        const charge = event.data.object as any;
        const email = charge.billing_details?.email || charge.receipt_email;
        const amount = (charge.amount_refunded / 100).toFixed(2);
        const currency = charge.currency.toUpperCase();
        const receiptUrl = charge.receipt_url ?? undefined;

        console.log(`Webhook: refund for ${email}, amount ${amount} ${currency}`);

        if (!email) {
          console.error("Webhook: no email found on charge for refund");
          return;
        }

        await sendRefundEmail({ email, amount, currency, receiptUrl });
        console.log(`Webhook: refund email sent to ${email}`);

      } catch (err) {
        console.error("Refund webhook error:", err);
      }
    }
  }
);

export default router;