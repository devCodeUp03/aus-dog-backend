import express from 'express';
import { placeOrderStripe, verifyStripe } from '../controllers/stripe.controller.js';
import { placeOrderPaypal, verifyPaypal } from '../controllers/paypal.controller.js'; // ADD

const router = express.Router();

router.post('/stripe', placeOrderStripe);
router.post('/verify-stripe', verifyStripe);
router.post('/paypal', placeOrderPaypal);           // ADD
router.post('/verify-paypal', verifyPaypal);        // ADD

export default router;