import { sendContactInquiryEmail } from "../utils/contact-email.js";
export const sendContactInquiry = async (req, res) => {
    try {
        const { firstName, lastName, email, subject, message, } = req.body;
        if (!firstName || !email || !message) {
            return res.status(400).json({
                success: false,
                message: "Required fields missing",
            });
        }
        await sendContactInquiryEmail({
            firstName,
            lastName,
            email,
            subject,
            message,
        });
        return res.status(200).json({
            success: true,
            message: "Inquiry sent successfully",
        });
    }
    catch (error) {
        console.error("CONTACT EMAIL ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send inquiry",
        });
    }
};
