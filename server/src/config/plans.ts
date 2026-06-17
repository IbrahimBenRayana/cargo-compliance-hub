// ─── Per-Filing Pricing: Tiers & Capabilities ───────────────────────────────
//
// SINGLE SOURCE OF TRUTH for the pricing model. The seed (prisma/seed.ts), the
// billing routes, and the capability middleware all import from here. The app
// (src/lib/planMeta.ts) and the landing site mirror these numbers — keep them
// in sync when editing.
//
// Model: there is NO monthly subscription fee. A customer subscribes to ONE
// tier; the tier sets (a) the per-shipment rate billed via Stripe metered
// billing and (b) which product capabilities are unlocked. Billing is keyed on
// the Filing record (which IS the shipment): the first successful CBP
// submission on a filing — the ISF submit OR a linked ABI Entry send — reports
// exactly one metered event at the tier's rate. Re-submits/amendments never
// re-charge (idempotent on filingId; rate locked at first-bill time).

import { env } from './env.js';

// ─── Capabilities ───────────────────────────────────────────
// The four gateable product surfaces. ISF_FILING is the base capability every
// paid tier has. NOTE: HTS_CLASSIFICATION gates the *dedicated* classification
// tooling (AI classify, the Classification tab, the Duty Calculator) — NOT the
// HTSAutocomplete used to enter a 6-digit code while filing an ISF, which every
// tier needs to produce a valid ISF-10.
export const CAPABILITIES = {
  ISF_FILING: 'ISF_FILING',
  ABI_ENTRY: 'ABI_ENTRY',
  CONTAINER_TRACKING: 'CONTAINER_TRACKING',
  HTS_CLASSIFICATION: 'HTS_CLASSIFICATION',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// ─── Tier definitions ───────────────────────────────────────
export interface TierDef {
  /** Plan row id / Stripe metadata `planId`. */
  id: string;
  /** Display name. */
  name: string;
  description: string;
  /** Per-shipment rate in cents (the metered Price unit_amount). */
  perFilingCents: number;
  /** Unlocked product surfaces. */
  capabilities: Capability[];
  /** Resolves the Stripe metered Price id from env (null until bootstrapped). */
  stripePriceId: () => string | null;
  /** Shown in the public pricing UI (false = private/contact-sales). */
  isPublic: boolean;
  sortOrder: number;
  /** Marketing bullet keys for the pricing/upgrade UI. */
  features: string[];
}

export const TIERS: TierDef[] = [
  {
    id: 'isf',
    name: 'ISF Filing',
    description: 'File ISF-10 / ISF-5 security filings. Pay only when you file.',
    perFilingCents: 4500, // $45 / shipment
    capabilities: [CAPABILITIES.ISF_FILING],
    stripePriceId: () => env.STRIPE_PRICE_ISF || null,
    isPublic: true,
    sortOrder: 1,
    features: ['isf_10_2', 'isf_5', 'templates', 'manifest_query', 'email_support'],
  },
  {
    id: 'entry',
    name: 'ISF + Entry',
    description: 'Everything in ISF Filing, plus ABI Entry Summary (7501/3461).',
    perFilingCents: 18000, // $180 / shipment
    capabilities: [CAPABILITIES.ISF_FILING, CAPABILITIES.ABI_ENTRY],
    stripePriceId: () => env.STRIPE_PRICE_ENTRY || null,
    isPublic: true,
    sortOrder: 2,
    features: ['everything_in_isf', 'abi_entry_7501', 'abi_entry_3461', 'cargo_release', 'chat_support'],
  },
  {
    id: 'full',
    name: 'Complete',
    description: 'The full suite: ISF, ABI Entry, container tracking, and HTS classification.',
    perFilingCents: 28000, // $280 / shipment
    capabilities: [
      CAPABILITIES.ISF_FILING,
      CAPABILITIES.ABI_ENTRY,
      CAPABILITIES.CONTAINER_TRACKING,
      CAPABILITIES.HTS_CLASSIFICATION,
    ],
    stripePriceId: () => env.STRIPE_PRICE_FULL || null,
    isPublic: true,
    sortOrder: 3,
    features: [
      'everything_in_entry',
      'container_tracking',
      'hts_classification',
      'duty_calculator',
      'priority_support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Volume pricing, SSO, SLA, and dedicated support. Contact sales.',
    perFilingCents: 0, // negotiated per contract
    capabilities: [
      CAPABILITIES.ISF_FILING,
      CAPABILITIES.ABI_ENTRY,
      CAPABILITIES.CONTAINER_TRACKING,
      CAPABILITIES.HTS_CLASSIFICATION,
    ],
    stripePriceId: () => null, // negotiated; not a self-serve metered price
    isPublic: false,
    sortOrder: 4,
    features: ['everything_in_complete', 'sso', 'dedicated_csm', 'uptime_sla', 'custom_integrations'],
  },
];

// ─── Helpers ─────────────────────────────────────────────────
const TIER_BY_ID = new Map(TIERS.map((t) => [t.id, t]));

/** The tier a brand-new / unsubscribed org defaults to. No capabilities, no
 *  billing — they must pick a tier + add a card before they can submit. */
export const DEFAULT_TIER_ID = 'isf';

export function tierById(id: string | null | undefined): TierDef | undefined {
  return id ? TIER_BY_ID.get(id) : undefined;
}

export function capabilitiesForTier(id: string | null | undefined): Capability[] {
  return tierById(id)?.capabilities ?? [];
}

export function tierHasCapability(id: string | null | undefined, cap: Capability): boolean {
  return capabilitiesForTier(id).includes(cap);
}

/** Reverse lookup used by the Stripe webhook: map a metered Price id back to a
 *  tier so subscription.created/updated events can set the org's plan. */
export function tierByStripePriceId(priceId: string | null | undefined): TierDef | undefined {
  if (!priceId) return undefined;
  return TIERS.find((t) => t.stripePriceId() === priceId);
}
