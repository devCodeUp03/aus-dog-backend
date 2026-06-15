import { prisma } from "../config/prisma.js";
import { Request, Response } from "express";

// GET /api/admin/inventory
export const getInventory = async (req: Request, res: Response) => {
  try {
    const inventory = await prisma.product.findMany({
      orderBy: [{ productId: "asc" }, { size: "asc" }]
    });
    res.json({ success: true, inventory });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

// PATCH /api/admin/inventory/:productId
export const updateStock = async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId as string);
  const size = String(req.params.size);
  const { stock } = req.body;

  if (typeof stock !== "number" || stock < 0) {
    return res.status(400).json({ success: false, message: "Invalid stock value" });
  }
   if (!["Small", "Medium", "Large"].includes(size)) {
    return res.status(400).json({ success: false, message: "Invalid size" });
  }

  try {
    const updated = await prisma.product.upsert({
      where: { productId_size: { productId, size } },
      update: { stock },
      create: { productId, size, stock },
    });
    res.json({ success: true, product: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

// GET /api/inventory (public — for frontend)
export const getPublicInventory = async (req: Request, res: Response) => {
  try {
    const inventory = await prisma.product.findMany();
    res.json({ success: true, inventory });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};