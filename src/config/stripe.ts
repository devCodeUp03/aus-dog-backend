import Stripe from 'stripe';
import 'dotenv/config';

// Initialize Stripe with your Secret Key from .env
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-04-22.dahlia', // Use the latest API version
});