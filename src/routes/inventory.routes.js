import { Router } from "express";
import { getPublicInventory } from "../controllers/inventory.controller.js";
const router = Router();
router.get("/", getPublicInventory);
export default router;
