import { prisma } from "../config/prisma.js";
import { getPayPalAccessToken, PAYPAL_BASE_URL } from "../config/paypal.js";
import { sendOrderConfirmationEmail } from "../services/email.service.js";
// ─── STEP 1: Create PayPal order + DB record ────────────────────────────────
export const placeOrderPaypal = async (req, res) => {
    try {
        const { userId, items, amount, deliveryFee, email, firstName, lastName, address: addressLine, suburb, state, postcode, phone, country, } = req.body;
        const origin = req.headers.origin || "";
        // 1. Save order to DB first (same pattern as Stripe)
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
                deliveryFee,
                total: amount + deliveryFee,
                paymentMethod: "PAYPAL",
                userId: userId ? String(userId) : null,
                paid: false,
                items: {
                    create: (items || []).map((item) => ({
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
        // 2. Get PayPal access token
        const accessToken = await getPayPalAccessToken();
        // 3. Create PayPal order
        const paypalRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                intent: "CAPTURE",
                purchase_units: [
                    {
                        reference_id: newOrder.id, // ties PayPal order to your DB order
                        amount: {
                            currency_code: "AUD",
                            value: (amount + deliveryFee).toFixed(2),
                            breakdown: {
                                item_total: {
                                    currency_code: "AUD",
                                    value: amount.toFixed(2),
                                },
                                shipping: {
                                    currency_code: "AUD",
                                    value: deliveryFee.toFixed(2),
                                },
                            },
                        },
                        items: items.map((item) => ({
                            name: item.name,
                            quantity: String(item.quantity),
                            unit_amount: {
                                currency_code: "AUD",
                                value: item.price.toFixed(2),
                            },
                        })),
                    },
                ],
                application_context: {
                    return_url: `${origin}/checkout/success?paypal=true&orderId=${newOrder.id}`,
                    cancel_url: `${origin}/checkout/success?paypal=true&success=false&orderId=${newOrder.id}`,
                    brand_name: "Top Dog Working Dog",
                    user_action: "PAY_NOW",
                },
            }),
        });
        const paypalData = await paypalRes.json();
        if (!paypalRes.ok) {
            // Rollback DB order if PayPal creation failed
            await prisma.order.delete({ where: { id: newOrder.id } });
            throw new Error(paypalData?.message || "PayPal order creation failed");
        }
        // 4. Save PayPal order ID to DB
        await prisma.order.update({
            where: { id: newOrder.id },
            data: { paypalOrderId: paypalData.id },
        });
        // 5. Find the approval URL to redirect the customer
        const approvalUrl = paypalData.links?.find((link) => link.rel === "approve")?.href;
        if (!approvalUrl) {
            // ✅ Roll back if no approval URL — don't leave ghost order
            await prisma.order.delete({ where: { id: newOrder.id } });
            throw new Error("No PayPal approval URL returned");
        }
        res.json({
            success: true,
            session_url: approvalUrl, // same field name as Stripe — frontend stays unchanged
            orderId: newOrder.id,
            username: `${firstName} ${lastName}`,
        });
    }
    catch (error) {
        console.error("PayPal placeOrder error:", error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, message });
    }
};
// ─── STEP 2: Capture payment after customer approves ────────────────────────
export const verifyPaypal = async (req, res) => {
    const { orderId, success, token } = req.body;
    if (!orderId) {
        return res.status(400).json({ success: false, message: "Missing orderId" });
    }
    try {
        if (success === "true" || success === true) {
            if (!token) {
                return res.status(400).json({ success: false, message: "Missing PayPal token" });
            }
            const accessToken = await getPayPalAccessToken();
            const captureRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${token}/capture`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });
            const captureData = await captureRes.json();
            if (!captureRes.ok || captureData.status !== "COMPLETED") {
                throw new Error("PayPal capture failed: " + JSON.stringify(captureData));
            }
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true },
            });
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }
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
            }).catch((err) => console.error("PayPal confirmation email error:", err));
            res.json({ success: true, message: "PayPal payment captured successfully." });
        }
        else {
            // ✅ Customer cancelled — delete unpaid ghost order
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (order && !order.paid) {
                await prisma.order.delete({ where: { id: orderId } });
            }
            res.json({ success: false, message: "PayPal payment cancelled. Order cleared." });
        }
    }
    catch (error) {
        if (error?.code === "P2025") {
            return res.json({ success: false, message: "Order already cleared." });
        }
        console.error("PayPal verify error:", error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, message });
    }
};
