import express from "express";
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import cors from "cors";
import webhookRoutes from "./routes/webhook.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
const app = express();
const PORT = process.env.PORT || 5001;
app.use(cors({
    origin: (origin, callback) => {
        const allowed = [
            "http://localhost:3000",
            "https://topdogworkingdog.com", // no trailing slash
        ];
        if (!origin || allowed.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));
app.use("/api/webhook", webhookRoutes);
app.use(express.json()); // ← MUST be before all routes
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/inventory", inventoryRoutes);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
