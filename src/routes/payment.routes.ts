import express from 'express';
import { placeOrderStripe } from '../controllers/stripe.controller.js';
import { verifyStripe } from '../controllers/stripe.controller.js';

const router = express.Router();

// Route to handle Stripe payment and order placement
router.post('/stripe', placeOrderStripe);
router.post("/verify-stripe", verifyStripe);
export default router;