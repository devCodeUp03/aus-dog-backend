import { Router } from "express";
import {
  createSuperuser,
  adminLogin,
  getAdminMe,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/admin.controller.js";
import { requireAdminJWT } from "../middleware/auth.middleware.js";
import { getInventory, updateStock } from "../controllers/inventory.controller.js";

const router = Router();

// ── Public (no JWT needed) ──────────────────────────────────────────────────
router.post("/create-superuser", createSuperuser); // guarded by x-admin-key header
router.post("/login", adminLogin);

//inventory
router.get("/inventory", requireAdminJWT, getInventory);
router.patch("/inventory/:productId", requireAdminJWT, updateStock);

// ── Protected (JWT required) ────────────────────────────────────────────────
router.get("/me", requireAdminJWT, getAdminMe);
router.get("/orders", requireAdminJWT, getAllOrders);
router.patch("/orders/:id/status", requireAdminJWT, updateOrderStatus);

// admin.routes.ts
router.delete("/orders/:id", requireAdminJWT, deleteOrder);

export default router;