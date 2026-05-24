import { prisma } from "../config/prisma.js";
import { stripe } from "../config/stripe.js";
import { sendOrderConfirmationEmail } from "../services/email.service.js";
const placeOrderStripe = async (req, res) => {
    try {
        const { userId, items, amount, deliveryFee, email, firstName, lastName, address: addressLine, suburb, state, postcode, phone, country, } = req.body;
        const origin = req.headers.origin || "";
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
            include: { items: true },
        });
        // 2. Prepare line items for Stripe
        const line_items = items.map((item) => ({
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
    }
    catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, message });
    }
};
const verifyStripe = async (req, res) => {
    const { orderId, success } = req.body;
    try {
        if (success === "true" || success === true) {
            // Fetch the full order to build the confirmation email
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true },
            });
            if (order) {
                // Fire confirmation email (non-blocking)
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
                }).catch((err) => console.error("Stripe confirmation email error:", err));
            }
            res.json({ success: true, message: "Payment successful." });
        }
        else {
            await prisma.order.delete({ where: { id: orderId } });
            res.json({ success: false, message: "Payment failed. Pending order cleared." });
        }
    }
    catch (error) {
        console.error("Verification Error:", error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, message });
    }
};
export { placeOrderStripe, verifyStripe };
