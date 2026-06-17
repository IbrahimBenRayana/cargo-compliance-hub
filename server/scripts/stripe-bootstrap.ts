/**
 * Stripe bootstrap — idempotent setup for per-filing metered billing.
 *
 *   npm run stripe:bootstrap
 *
 * Creates (or reuses, by lookup_key / metadata) everything the per-filing model
 * needs in your Stripe account:
 *   1. one Billing Meter  (event_name = STRIPE_FILING_METER_EVENT, sum aggregation)
 *   2. one Product per public tier (isf / entry / full)
 *   3. one $0-base *metered* Price per tier, unit_amount = tier.perFilingCents,
 *      recurring monthly, tied to the meter.
 *
 * Re-running is safe: it looks up existing objects by lookup_key / metadata
 * before creating, so it never duplicates. It prints the env lines to paste
 * into server/.env (and your prod secrets) at the end.
 *
 * Requires STRIPE_SECRET_KEY in the environment.
 */
import { getStripe, stripeConfigured } from '../src/services/stripe.js';
import { env } from '../src/config/env.js';
import { TIERS } from '../src/config/plans.js';

const PRICE_ENV_KEY: Record<string, string> = {
  isf: 'STRIPE_PRICE_ISF',
  entry: 'STRIPE_PRICE_ENTRY',
  full: 'STRIPE_PRICE_FULL',
};

async function findMeter(stripe: ReturnType<typeof getStripe>, eventName: string) {
  // Meters can't be filtered by event_name server-side; page through active ones.
  for await (const meter of stripe.billing.meters.list({ status: 'active', limit: 100 })) {
    if (meter.event_name === eventName) return meter;
  }
  return null;
}

async function main() {
  if (!stripeConfigured()) {
    console.error('❌ STRIPE_SECRET_KEY is not set. Add it to server/.env first.');
    process.exit(1);
  }
  const stripe = getStripe();
  const eventName = env.STRIPE_FILING_METER_EVENT;

  // 1. Meter ───────────────────────────────────────────────
  let meter = await findMeter(stripe, eventName);
  if (meter) {
    console.log(`• Reusing meter ${meter.id} (event "${eventName}")`);
  } else {
    meter = await stripe.billing.meters.create({
      display_name: 'Filings',
      event_name: eventName,
      default_aggregation: { formula: 'sum' },
      customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
      value_settings: { event_payload_key: 'value' },
    });
    console.log(`✓ Created meter ${meter.id} (event "${eventName}")`);
  }

  // 2 + 3. Product + metered Price per public, priced tier ──
  const envLines: string[] = [];
  for (const tier of TIERS) {
    if (!tier.isPublic || tier.perFilingCents <= 0) continue; // skip enterprise/custom
    const lookupKey = `mcl_filing_${tier.id}`;

    // Reuse an existing active price by lookup_key if present.
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    let price = existing.data[0];

    if (price) {
      console.log(`• Reusing price ${price.id} for "${tier.name}" (${lookupKey})`);
    } else {
      const product = await stripe.products.create({
        name: `MyCargoLens — ${tier.name}`,
        description: tier.description,
        metadata: { planId: tier.id },
      });
      price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: tier.perFilingCents,
        lookup_key: lookupKey,
        recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
        billing_scheme: 'per_unit',
        metadata: { planId: tier.id },
      });
      console.log(`✓ Created price ${price.id} for "${tier.name}" ($${(tier.perFilingCents / 100).toFixed(2)}/filing)`);
    }
    envLines.push(`${PRICE_ENV_KEY[tier.id]}=${price.id}`);
  }

  console.log('\n──────────────────────────────────────────────');
  console.log('Add these to server/.env (and your prod secrets):\n');
  console.log(`STRIPE_FILING_METER_EVENT=${eventName}`);
  for (const line of envLines) console.log(line);
  console.log('\nThen re-run `npm run db:seed` to wire the price ids into the plan rows.');
  console.log('──────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
