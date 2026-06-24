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

// ─── Card-on-file + immediate per-shipment charging ────────────────────────
// The model: each org keeps a Stripe Customer with a default payment method
// (saved via SetupIntent, no charge). Each shipment CBP accepts is charged
// immediately with an off-session PaymentIntent for the tier's flat rate.

/** Create a Stripe Customer for an org (card is attached later via SetupIntent). */
export async function createStripeCustomer(opts: {
  orgId: string;
  email?: string;
  name?: string;
}): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: opts.email,
    name: opts.name,
    metadata: { orgId: opts.orgId },
  });
  return customer.id;
}

/**
 * Start a SetupIntent so the browser (Stripe Elements) can save a card to the
 * customer WITHOUT charging it. Returns the client secret for the frontend.
 */
export async function createSetupIntent(customerId: string): Promise<{
  clientSecret: string;
  setupIntentId: string;
}> {
  const stripe = getStripe();
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session', // we will charge later without the customer present
  });
  return { clientSecret: intent.client_secret ?? '', setupIntentId: intent.id };
}

export type CardSummary = {
  paymentMethodId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

/** Pull the card brand/last4/exp for display + set it as the customer default. */
export async function setDefaultCard(
  customerId: string,
  paymentMethodId: string,
): Promise<CardSummary> {
  const stripe = getStripe();
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  return {
    paymentMethodId,
    brand: pm.card?.brand ?? null,
    last4: pm.card?.last4 ?? null,
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
  };
}

export type ChargeOutcome = {
  status: 'paid' | 'requires_action' | 'failed';
  paymentIntentId: string | null;
  error?: string;
};

/**
 * Charge a saved card immediately, off-session. Used to bill one shipment the
 * moment CBP accepts it. `idempotencyKey` (the ShipmentCharge id) guarantees a
 * retry never double-charges. A card that needs authentication (rare for US
 * cards) surfaces as `requires_action`; a decline as `failed`.
 */
export async function chargeSavedCard(opts: {
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  idempotencyKey: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<ChargeOutcome> {
  const stripe = getStripe();
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: opts.amountCents,
        currency: 'usd',
        customer: opts.customerId,
        payment_method: opts.paymentMethodId,
        off_session: true,
        confirm: true,
        description: opts.description,
        metadata: opts.metadata,
      },
      { idempotencyKey: opts.idempotencyKey },
    );
    return {
      status: pi.status === 'succeeded' ? 'paid' : 'requires_action',
      paymentIntentId: pi.id,
    };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeCardError) {
      const pi = (err.payment_intent ?? (err.raw as { payment_intent?: { id?: string } })?.payment_intent) as
        | { id?: string }
        | undefined;
      const requiresAction = err.code === 'authentication_required';
      return {
        status: requiresAction ? 'requires_action' : 'failed',
        paymentIntentId: pi?.id ?? null,
        error: err.message,
      };
    }
    throw err;
  }
}
