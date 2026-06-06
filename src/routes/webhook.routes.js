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
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (orderId) {
            try {
                const order = await prisma.order.findUnique({
                    where: { id: orderId },
                    include: { items: true },
                });
                if (order) {
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
                    }).catch((err) => console.error("Webhook email error:", err));
                }
            }
            catch (err) {
                console.error("Webhook DB error:", err);
                return res.status(500).json({ error: "Internal server error" });
            }
        }
    }
    if (event.type === "charge.refunded") {
        try {
            const charge = event.data.object;
            const email = charge.billing_details?.email || charge.receipt_email;
            const amount = (charge.amount_refunded / 100).toFixed(2);
            const currency = charge.currency.toUpperCase();
            const receiptUrl = charge.receipt_url ?? undefined;
            if (email) {
                sendRefundEmail({
                    email,
                    amount,
                    currency,
                    receiptUrl,
                }).catch((err) => console.error("Refund email error:", err));
            }
        }
        catch (err) {
            console.error("Refund webhook error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    res.json({ received: true });
});
export default router;
