import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
export const requireAdminJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.adminId = payload.adminId;
        req.adminEmail = payload.email;
        next();
    }
    catch {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};
