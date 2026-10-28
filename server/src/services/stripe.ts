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

export type PaymentMethodKind = 'card' | 'us_bank_account';

/**
 * Start a SetupIntent so the browser (Stripe Elements) can save a payment
 * method to the customer WITHOUT charging it. Returns the client secret.
 * `us_bank_account` (ACH Direct Debit, for invoiced accounts) verifies the
 * account with Stripe Financial Connections (instant) or micro-deposits, and
 * Stripe's Payment Element collects the debit mandate.
 */
export async function createSetupIntent(customerId: string, method: PaymentMethodKind = 'card'): Promise<{
  clientSecret: string;
  setupIntentId: string;
}> {
  const stripe = getStripe();
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: [method],
    usage: 'off_session', // we will charge later without the customer present
    ...(method === 'us_bank_account' && {
      payment_method_options: {
        us_bank_account: { verification_method: 'automatic', financial_connections: { permissions: ['payment_method'] } },
      },
    }),
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

export type SavedPaymentMethod =
  | ({ type: 'card' } & CardSummary)
  | { type: 'us_bank_account'; paymentMethodId: string; bankName: string | null; last4: string | null };

/** Set a saved payment method as the customer default and summarise it for
 *  display (card brand/last4/exp, or bank name/last4). */
export async function setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<SavedPaymentMethod> {
  const stripe = getStripe();
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.type === 'us_bank_account') {
    return {
      type: 'us_bank_account',
      paymentMethodId,
      bankName: pm.us_bank_account?.bank_name?.slice(0, 100) ?? null,
      last4: pm.us_bank_account?.last4 ?? null,
    };
  }
  return {
    type: 'card',
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
 * moment CBP accepts it. `idempotencyKey` (stable per charge attempt) means a
 * repeat of the same attempt never double-charges.
 *
 * Outcomes the customer must fix are returned: a decline → `failed`, a card
 * needing authentication → `requires_action`, and a card or customer that is
 * gone (removed in the Stripe portal: StripeInvalidRequestError) → `failed`.
 * Anything else (Stripe outage, network, rate limit) THROWS: the outcome is
 * unknown, so the caller must retry with the SAME key (billing audit P1 G1).
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
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return { status: 'failed', paymentIntentId: null, error: err.message };
    }
    throw err;
  }
}
