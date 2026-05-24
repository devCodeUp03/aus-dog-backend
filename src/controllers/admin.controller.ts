import { prisma } from "../config/prisma.js";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  sendOrderConfirmationEmail,
  sendStatusUpdateEmail,
} from "../services/email.service.js";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

// ─── Seed / Create Superuser ─────────────────────────────────────────────────
// POST /api/admin/create-superuser
// Protected by ADMIN_SECRET_KEY header (one-time setup only)
export const createSuperuser = async (req: Request, res: Response) => {
  const key = req.headers["x-admin-key"];
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password required" });
  }

  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Admin already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.adminUser.create({
      data: { email, passwordHash },
    });

    res.status(201).json({
      success: true,
      message: "Superuser created",
      admin: { id: admin.id, email: admin.email },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────
// POST /api/admin/login
export const adminLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password required" });
  }

  try {
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      admin: { id: admin.id, email: admin.email },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

// ─── Verify Token (used by frontend middleware) ───────────────────────────────
// GET /api/admin/me
export const getAdminMe = async (req: any, res: Response) => {
  res.json({
    success: true,
    admin: { id: req.adminId, email: req.adminEmail },
  });
};

// ─── GET /api/admin/orders ────────────────────────────────────────────────────
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

// ─── PATCH /api/admin/orders/:id/status ──────────────────────────────────────
export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
 
  const VALID_STATUSES = ["PENDING", "SHIPPING", "COMPLETED"];
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }
 
  try {
    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
 
    // ── Fire status email (non-blocking — don't fail the request if email fails) ──
    sendStatusUpdateEmail({
      email:       updated.email,
      firstName:   updated.firstName,
      orderNumber: updated.orderNumber,
      status:      updated.status as "PENDING" | "SHIPPING" | "COMPLETED",
      total:       updated.total,
    }).catch((err) => console.error("Status email error:", err));
 
    res.json({ success: true, order: updated });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};