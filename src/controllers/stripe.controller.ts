import { prisma } from "../config/prisma.js";
import { stripe } from "../config/stripe.js";
import { Request, Response } from "express";
import { sendOrderConfirmationEmail } from "../services/email.service.js";
import { getPayPalAccessToken } from "../config/paypal.js";

const placeOrderStripe = async (req: Request, res: Response) => {
  try {
    const {
      userId, items, amount, deliveryFee,
      email, firstName, lastName,
      address: addressLine, suburb, state, postcode, phone, country,
    } = req.body;

    const origin = (req.headers.origin as string) || "";

    // ✅ No DB order created here — only create Stripe session
    const line_items = items.map((item: any) => ({
      price_data: {
        currency: "aud",
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    line_items.push({
      price_data: {
        currency: "aud",
        product_data: { name: "Delivery Fee" },
        unit_amount: Math.round(deliveryFee * 100),
      },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/checkout/success?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/checkout?cancelled=true`,
      line_items,
      mode: "payment",
      // ✅ Store everything needed to create the order in the webhook
      metadata: {
        customerData: JSON.stringify({
          userId: userId ? String(userId) : null,
          email, firstName, lastName,
          address: addressLine, suburb, state,
          postcode, phone,
          country: country || "Australia",
        }),
        cartItems:   JSON.stringify(items),
        amount:      String(amount),
        deliveryFee: String(deliveryFee),
      },
    });

    res.json({
      success: true,
      session_url: session.url,
      username: `${firstName} ${lastName}`,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

// verifyStripe is no longer needed for order creation — webhook handles it
// Keep it only if your success page calls it to check status
const verifyStripe = async (req: Request, res: Response) => {
  const { session_id } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === "paid") {
      res.json({ success: true, message: "Payment confirmed." });
    } else {
      res.json({ success: false, message: "Payment not completed." });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};
 
export { placeOrderStripe, verifyStripe };
