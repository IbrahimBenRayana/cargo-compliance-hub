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

/**
 * Report one per-filing usage event to the shared Stripe Billing Meter.
 * Stripe aggregates events per customer per billing period and the customer's
 * subscribed metered Price applies the tier's per-unit rate, producing one
 * monthly invoice.
 *
 * `identifier` is the Stripe-level idempotency key — passing the ShipmentCharge
 * id (one per filing) means a retried call never double-bills the shipment.
 * Returns the meter event identifier on success.
 */
export async function recordFilingMeterEvent(opts: {
  stripeCustomerId: string;
  identifier: string;
  quantity?: number;
}): Promise<string> {
  const stripe = getStripe();
  const event = await stripe.billing.meterEvents.create({
    event_name: env.STRIPE_FILING_METER_EVENT,
    identifier: opts.identifier,
    payload: {
      stripe_customer_id: opts.stripeCustomerId,
      value: String(opts.quantity ?? 1),
    },
  });
  return event.identifier ?? opts.identifier;
}
