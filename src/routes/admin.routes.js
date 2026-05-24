import { Router } from "express";
import { createSuperuser, adminLogin, getAdminMe, getAllOrders, updateOrderStatus, } from "../controllers/admin.controller.js";
import { requireAdminJWT } from "../middleware/auth.middleware.js";
const router = Router();
// ── Public (no JWT needed) ──────────────────────────────────────────────────
router.post("/create-superuser", createSuperuser); // guarded by x-admin-key header
router.post("/login", adminLogin);
// ── Protected (JWT required) ────────────────────────────────────────────────
router.get("/me", requireAdminJWT, getAdminMe);
router.get("/orders", requireAdminJWT, getAllOrders);
router.patch("/orders/:id/status", requireAdminJWT, updateOrderStatus);
export default router;
