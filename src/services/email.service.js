import nodemailer from "nodemailer";
// ─── Transporter Setup ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Gmail: use App Password, not your real password
    },
});
// ─── Send Order Confirmation ──────────────────────────────────────────────────
export const sendOrderConfirmationEmail = async (order) => {
    const html = buildOrderConfirmationHTML(order);
    await transporter.sendMail({
        from: `"${process.env.SHOP_NAME || "Your Shop"}" <${process.env.SMTP_USER}>`,
        to: order.email,
        subject: `Order Confirmed !`,
        html,
    });
};
// ─── Send Status Update Email ─────────────────────────────────────────────────
export const sendStatusUpdateEmail = async (payload) => {
    const html = buildStatusUpdateHTML(payload);
    const subjects = {
        PENDING: `We received your order — #${payload.orderNumber}`,
        SHIPPING: `Your order is on its way! — #${payload.orderNumber}`,
        COMPLETED: `Order delivered — #${payload.orderNumber}`,
    };
    await transporter.sendMail({
        from: `"${process.env.SHOP_NAME || "Your Shop"}" <${process.env.SMTP_USER}>`,
        to: payload.email,
        subject: subjects[payload.status] || `Order Update — #${payload.orderNumber}`,
        html,
    });
};
export const sendRefundEmail = async (payload) => {
    const html = buildRefundHTML(payload);
    await transporter.sendMail({
        from: `"${process.env.SHOP_NAME || "Your Shop"}" <${process.env.SMTP_USER}>`,
        to: payload.email,
        subject: `Your Refund of ${payload.currency} $${payload.amount} is On Its Way`,
        html,
    });
};
// ─── HTML: Order Confirmation ─────────────────────────────────────────────────
function buildOrderConfirmationHTML(order) {
    const shopName = process.env.SHOP_NAME || "Your Shop";
    const shopColor = process.env.SHOP_COLOR || "#ee6d49";
    const logoUrl = process.env.SHOP_LOGO_URL || "";
    const itemRows = order.items
        .map((item) => {
        const meta = [item.color, item.size, item.variant]
            .filter(Boolean)
            .join(" · ");
        return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
            <div style="font-weight:600;color:#1a1a1a;font-size:15px;">${item.productName}</div>
            ${meta ? `<div style="color:#888;font-size:13px;margin-top:3px;">${meta}</div>` : ""}
            <div style="color:#888;font-size:13px;">Qty: ${item.quantity}</div>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#1a1a1a;font-size:15px;white-space:nowrap;">
            $${(item.price * item.quantity).toFixed(2)}
          </td>
        </tr>`;
    })
        .join("");
    const paymentBadge = order.paymentMethod === "STRIPE"
        ? `<span style="background:#7c3aed20;color:#7c3aed;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">STRIPE</span>`
        : `<span style="background:#0070ba20;color:#0070ba;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">PAYPAL</span>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Order Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${shopColor};padding:36px 40px;text-align:center;">
            ${logoUrl ? `<img src="${logoUrl}" alt="${shopName}" style="height:40px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;"/>` : ""}
            <div style="background:rgba(255,255,255,0.2);width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:28px;">✓</span>
            </div>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Order Confirmed!</h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Thanks, ${order.firstName}. We've got your order.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <!-- Items -->
            <h2 style="margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600;">Items Ordered</h2>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemRows}
              <!-- Subtotal -->
              <tr>
                <td style="padding:16px 0 6px;color:#888;font-size:14px;">Subtotal</td>
                <td style="padding:16px 0 6px;text-align:right;color:#888;font-size:14px;">$${order.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:0 0 6px;color:#888;font-size:14px;">Delivery</td>
                <td style="padding:0 0 6px;text-align:right;color:#888;font-size:14px;">$${order.deliveryFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0 0;border-top:2px solid #f0f0f0;font-size:17px;font-weight:700;color:#1a1a1a;">Total</td>
                <td style="padding:12px 0 0;border-top:2px solid #f0f0f0;text-align:right;font-size:20px;font-weight:700;color:${shopColor};">$${order.total.toFixed(2)}</td>
              </tr>
            </table>

            <!-- 2-col: Delivery + Payment -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
              <tr valign="top">

                <!-- Delivery Address -->
                <td width="50%" style="padding-right:12px;">
                  <div style="background:#f8f8f8;border-radius:12px;padding:20px;">
                    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600;margin-bottom:10px;">📦 Deliver To</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.7;">
                      <strong>${order.firstName} ${order.lastName}</strong><br/>
                      ${order.address}<br/>
                      ${order.suburb} ${order.postcode}<br/>
                      ${order.state}, ${order.country}
                    </div>
                  </div>
                </td>

              </tr>
            </table>

            <!-- What's next -->
            <div style="margin-top:28px;background:#fff8f5;border:1px solid ${shopColor}30;border-radius:12px;padding:20px;">
              <div style="font-size:13px;font-weight:700;color:${shopColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">What happens next?</div>
              <div style="font-size:14px;color:#555;line-height:1.7;">
                We're preparing your order and will send you a shipping notification as soon as it's on its way. If you have any questions, just reply to this email.
              </div>
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-top:1px solid #efefef;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#aaa;">&copy; ${new Date().getFullYear()} ${shopName}. All rights reserved.</p>
            <p style="margin:8px 0 0;font-size:12px;color:#ccc;">This email was sent because you placed an order with us.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
// ─── HTML: Status Update ──────────────────────────────────────────────────────
function buildStatusUpdateHTML(payload) {
    const shopName = process.env.SHOP_NAME || "Your Shop";
    const shopColor = process.env.SHOP_COLOR || "#ee6d49";
    const logoUrl = process.env.SHOP_LOGO_URL || "";
    const statusMeta = {
        PENDING: {
            emoji: "🛍️",
            headline: "We've received your order!",
            body: `Hi ${payload.firstName}, your order <strong>#${payload.orderNumber}</strong> has been received and is being reviewed. We'll notify you as soon as it ships.`,
            step: 1,
        },
        SHIPPING: {
            emoji: "🚚",
            headline: "Your order is on its way!",
            body: `Great news, ${payload.firstName}! Your order <strong>#${payload.orderNumber}</strong> has been dispatched and is heading your way.${payload.trackingNumber
                ? ` Your tracking number is <strong style="font-family:monospace;">${payload.trackingNumber}</strong>. You can track your parcel via <a href="https://auspost.com.au/mypost/track/#/search?referenceId=${payload.trackingNumber}" style="color:${process.env.SHOP_COLOR}">Australia Post tracking</a>.`
                : ""}`,
            step: 2,
        },
        COMPLETED: {
            emoji: "🎉",
            headline: "Order delivered!",
            body: `We hope you love it, ${payload.firstName}! Your order <strong>#${payload.orderNumber}</strong> has been marked as delivered. If you have any questions or issues, just reply to this email — we're here to help.`,
            step: 3,
        },
    };
    const meta = statusMeta[payload.status] || statusMeta.PENDING;
    // Progress tracker
    const steps = [
        { label: "Order Placed", icon: "🛍️" },
        { label: "Shipping", icon: "🚚" },
        { label: "Delivered", icon: "✅" },
    ];
    const progressCells = steps
        .map((step, i) => {
        const stepNum = i + 1;
        const active = stepNum === meta.step;
        const done = stepNum < meta.step;
        const bg = done || active ? shopColor : "#e5e5e5";
        const text = done || active ? "#ffffff" : "#aaaaaa";
        const labelColor = active ? shopColor : done ? "#555" : "#aaa";
        const fontWeight = active ? "700" : "400";
        return `
        <td align="center" width="33%" style="padding:0 8px;">
          <div style="width:44px;height:44px;border-radius:50%;background:${bg};display:inline-flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:8px;">${step.icon}</div>
          <div style="font-size:12px;color:${labelColor};font-weight:${fontWeight};letter-spacing:0.3px;">${step.label}</div>
        </td>`;
    })
        .join(`<td align="center" width="1%" style="padding-bottom:28px;"><div style="height:2px;width:40px;background:#e5e5e5;"></div></td>`);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Order Update</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${shopColor};padding:36px 40px;text-align:center;">
            ${logoUrl ? `<img src="${logoUrl}" alt="${shopName}" style="height:40px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;"/>` : ""}
            <div style="font-size:48px;margin-bottom:12px;">${meta.emoji}</div>
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${meta.headline}</h1>
          </td>
        </tr>

        <!-- Progress -->
        <tr>
          <td style="padding:32px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr align="center">
                ${progressCells}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 40px 32px;">

            <!-- Order number -->
            <div style="background:#fafafa;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Order</td>
                  <td style="text-align:right;font-weight:700;font-size:18px;color:#1a1a1a;font-family:monospace;">#${payload.orderNumber}</td>
                </tr>
                <tr>
                  <td style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-top:6px;">Total</td>
                  <td style="text-align:right;font-weight:700;font-size:15px;color:${shopColor};padding-top:6px;">$${payload.total.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <!-- Message -->
            <p style="font-size:15px;color:#444;line-height:1.8;margin:0 0 24px;">${meta.body}</p>

            <!-- CTA -->
            ${payload.status === "COMPLETED"
        ? `
            <div style="text-align:center;margin-top:8px;">
              <a href="mailto:${process.env.SMTP_USER}" style="display:inline-block;background:${shopColor};color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:50px;text-decoration:none;">Contact Support</a>
            </div>`
        : ""}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-top:1px solid #efefef;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#aaa;">&copy; ${new Date().getFullYear()} ${shopName}. All rights reserved.</p>
            <p style="margin:8px 0 0;font-size:12px;color:#ccc;">You're receiving this because you have an active order with us.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function buildRefundHTML(payload) {
    const shopName = process.env.SHOP_NAME || "Your Shop";
    const shopColor = process.env.SHOP_COLOR || "#ee6d49";
    const logoUrl = process.env.SHOP_LOGO_URL || "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Refund Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${shopColor};padding:36px 40px;text-align:center;">
            ${logoUrl ? `<img src="${logoUrl}" alt="${shopName}" style="height:40px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;"/>` : ""}
            <div style="background:rgba(255,255,255,0.2);width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:28px;">↩️</span>
            </div>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Refund Confirmed</h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Your refund has been successfully issued.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <!-- Refund amount -->
            <div style="background:#fafafa;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Refund Amount</td>
                  <td style="text-align:right;font-weight:700;font-size:24px;color:${shopColor};">
                    ${payload.currency} $${payload.amount}
                  </td>
                </tr>
              </table>
            </div>

            <!-- Message -->
            <p style="font-size:15px;color:#444;line-height:1.8;margin:0 0 16px;">
              We have successfully processed your refund. Please allow <strong>5–10 business days</strong> 
              for the amount to appear on your statement depending on your bank or card provider.
            </p>

            <!-- Receipt link -->
            ${payload.receiptUrl
        ? `
            <div style="text-align:center;margin:28px 0;">
              <a href="${payload.receiptUrl}" 
                 style="display:inline-block;background:${shopColor};color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:50px;text-decoration:none;">
                View Refund Receipt
              </a>
            </div>`
        : ""}

            <!-- Help note -->
            <div style="margin-top:24px;background:#fff8f5;border:1px solid ${shopColor}30;border-radius:12px;padding:20px;">
              <div style="font-size:13px;font-weight:700;color:${shopColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
                Need Help?
              </div>
              <div style="font-size:14px;color:#555;line-height:1.7;">
                If you have any questions about your refund, just reply to this email and we'll get back to you as soon as possible.
              </div>
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-top:1px solid #efefef;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#aaa;">&copy; ${new Date().getFullYear()} ${shopName}. All rights reserved.</p>
            <p style="margin:8px 0 0;font-size:12px;color:#ccc;">This email was sent because a refund was issued on your order.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
