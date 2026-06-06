import { prisma } from "../config/prisma.js";
// GET /api/admin/inventory
export const getInventory = async (req, res) => {
    try {
        const inventory = await prisma.product.findMany({
            orderBy: { productId: "asc" },
        });
        res.json({ success: true, inventory });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, message });
    }
};
// PATCH /api/admin/inventory/:productId
export const updateStock = async (req, res) => {
    const productId = parseInt(req.params.productId);
    const { stock } = req.body;
    if (typeof stock !== "number" || stock < 0) {
        return res.status(400).json({ success: false, message: "Invalid stock value" });
    }
    try {
        const updated = await prisma.product.upsert({
            where: { productId },
            update: { stock },
            create: { productId, stock },
        });
        res.json({ success: true, product: updated });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, message });
    }
};
// GET /api/inventory (public — for frontend)
export const getPublicInventory = async (req, res) => {
    try {
        const inventory = await prisma.product.findMany();
        res.json({ success: true, inventory });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, message });
    }
};
