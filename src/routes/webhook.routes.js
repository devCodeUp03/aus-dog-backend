// routes/webhook.routes.ts
import express from "express";
import { stripe } from "../config/stripe.js";
import { prisma } from "../config/prisma.js";
import { sendOrderConfirmationEmail, sendRefundEmail } from "../services/email.service.js";
const router = express.Router();
// ⚠️ Raw body middleware applied at the ROUTE level (not globally)
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        console.error("Webhook signature verification failed:", err);
        return res.status(400).send(`Webhook Error: ${err}`);
    }
    res.json({ received: true });
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (!orderId) {
            console.error("Webhook: no orderId in metadata");
            return;
        }
        // Only fulfill if payment actually succeeded
        if (session.payment_status !== "paid") {
            console.log("Webhook: session not paid, skipping");
            return;
        }
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true },
            });
            if (!order) {
                console.error(`Webhook: order ${orderId} not found`);
                return;
            }
            if (order.paid) {
                console.log(`Webhook: order ${orderId} already processed, skipping`);
                return; // Idempotency — don't double-process on Stripe retries
            }
            await prisma.order.update({
                where: { id: orderId },
                data: { paid: true },
            });
            sendOrderConfirmationEmail({
                email: order.email,
                firstName: order.firstName,
                lastName: order.lastName,
                orderNumber: order.orderNumber,
                items: order.items,
                subtotal: order.subtotal,
                deliveryFee: order.deliveryFee,
                total: order.total,
                address: order.address,
                suburb: order.suburb,
                state: order.state,
                postcode: order.postcode,
                country: order.country,
                paymentMethod: order.paymentMethod,
            }).catch((err) => console.error("Webhook confirmation email error:", err));
        }
        catch (err) {
            console.error("Webhook DB error (checkout.session.completed):", err);
        }
    }
    if (event.type === "charge.refunded") {
        try {
            const charge = event.data.object;
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
        }
        catch (err) {
            console.error("Refund webhook error:", err);
        }
    }
});
export default router;
