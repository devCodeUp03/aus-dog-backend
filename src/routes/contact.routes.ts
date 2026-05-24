import { Router } from "express";
import { sendContactInquiry } from "../controllers/contact.controller.js";

const router = Router();

router.post("/", sendContactInquiry);

export default router;