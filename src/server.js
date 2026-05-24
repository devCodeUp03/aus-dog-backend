import express from "express";
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import cors from "cors";
const app = express();
const PORT = process.env.PORT || 5001;
app.use(cors());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express.json()); // ← MUST be before all routes
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/contact", contactRoutes);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
