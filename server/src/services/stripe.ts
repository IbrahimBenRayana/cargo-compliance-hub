import Stripe from 'stripe';
import { env } from '../config/env.js';

// Lazy-initialize so dev servers without keys still boot.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in server/.env to enable billing.'
      );
    }
    // apiVersion must match the installed SDK's pinned version.
    // Stripe v22 ships with 2026-03-25.dahlia; the cast to `never` satisfies
    // strict typing without importing LatestApiVersion (not re-exported in v22's namespace).
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia' as never,
      appInfo: { name: 'MyCargoLens', version: '1.0.0' },
    });
  }
  return _stripe;
}

export function stripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
