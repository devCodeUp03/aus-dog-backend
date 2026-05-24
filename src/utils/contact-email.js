import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
export const sendContactInquiryEmail = async (payload) => {
    const html = `
    <div style="font-family:Arial,sans-serif;padding:20px;">
      <h2>New Contact Inquiry</h2>

      <p><strong>Name:</strong> ${payload.firstName} ${payload.lastName || ""}</p>

      <p><strong>Email:</strong> ${payload.email}</p>

      <p><strong>Subject:</strong> ${payload.subject || "No Subject"}</p>

      <div style="margin-top:20px;">
        <strong>Message:</strong>
        <p style="line-height:1.7;">
          ${payload.message}
        </p>
      </div>
    </div>
  `;
    await transporter.sendMail({
        from: `"${process.env.SHOP_NAME}" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
        replyTo: payload.email,
        subject: `New Inquiry - ${payload.subject || "Contact Form"}`,
        html,
    });
};
