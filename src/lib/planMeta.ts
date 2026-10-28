// ─── Plans & Capabilities (app mirror) ──────────────────────────────────────
// Mirrors server/src/config/plans.ts. The server is the source of truth for
// prices + capabilities (and an org's own prices come from /billing/subscription);
// this file is the display/UX layer (labels, blurbs, feature bullets) plus the
// capability constants the UI gates on. Keep ids and capabilities in sync.

// Capabilities — must match the server's CAPABILITIES keys exactly.
export const CAPABILITIES = {
  ISF_FILING: 'ISF_FILING',
  ABI_ENTRY: 'ABI_ENTRY',
  CONTAINER_TRACKING: 'CONTAINER_TRACKING',
  HTS_CLASSIFICATION: 'HTS_CLASSIFICATION',
  // Native in-bond (7512) movements — plans set up by our team.
  IN_BOND: 'IN_BOND',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export interface PlanMeta {
  /** Plan id — matches the server plan row id. */
  id: string;
  name: string;
  /** Short positioning line. */
  blurb: string;
  /** Default price of one accepted ISF, in cents. */
  perFilingCents: number;
  /** Human price label, e.g. "$45". */
  priceLabel: string;
  /** Sub-label under the price. */
  priceFooter: string;
  capabilities: Capability[];
  /** Marketing bullets for the upgrade / pricing cards. */
  features: string[];
  /** Self-selectable in the app (false = set up by MyCargoLens). */
  isPublic: boolean;
  /** Featured (visually highlighted) tier. */
  featured?: boolean;
}

const dollars = (cents: number) => `$${Math.round(cents / 100)}`;

const ALL_CAPABILITIES: Capability[] = [
  CAPABILITIES.ISF_FILING,
  CAPABILITIES.ABI_ENTRY,
  CAPABILITIES.CONTAINER_TRACKING,
  CAPABILITIES.HTS_CLASSIFICATION,
  CAPABILITIES.IN_BOND,
];

// Pricing v2: ISF is the only self-serve price ($45 per accepted ISF). Entries
// have no public price; MyCargoLens sets them per account on "ISF + Entry".
export const PLAN_META: Record<string, PlanMeta> = {
  isf: {
    id: 'isf',
    name: 'ISF Filing',
    blurb: 'Security filings, pay as you go.',
    perFilingCents: 4500,
    priceLabel: dollars(4500),
    priceFooter: 'per accepted ISF',
    capabilities: [CAPABILITIES.ISF_FILING, CAPABILITIES.HTS_CLASSIFICATION],
    isPublic: true,
    features: [
      'ISF-10 (10+2) & ISF-5 filing',
      'Templates & bulk duplicate',
      'Manifest (MBOL) query',
      'HTS suggestions',
      'Filing deadline tracking',
      'Email support',
    ],
  },
  entry: {
    id: 'entry',
    name: 'ISF + Entry',
    blurb: 'ISF plus customs entries, priced for your account.',
    perFilingCents: 4500,
    priceLabel: 'Custom',
    priceFooter: 'set up with our team',
    capabilities: ALL_CAPABILITIES,
    isPublic: false,
    features: [
      'Everything in ISF Filing',
      'ABI Entry Summary (7501)',
      'ABI Cargo Release (3461)',
      'Container tracking',
      'Email + chat support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    blurb: 'Contract pricing, invoiced.',
    perFilingCents: 0,
    priceLabel: 'Custom',
    priceFooter: 'per contract',
    capabilities: ALL_CAPABILITIES,
    isPublic: false,
    features: ['Everything in ISF + Entry', 'Dedicated support', 'Custom integrations'],
  },
};

export const KNOWN_PLAN_IDS = Object.keys(PLAN_META);

/** Self-serve plans in display order. */
export const PUBLIC_TIERS: PlanMeta[] = Object.values(PLAN_META).filter((p) => p.isPublic);

/** Where to talk to us about entries, volume or contract pricing. */
export const TALK_TO_US_URL = 'https://mycargolens.com/book-a-demo';

/** Human label for a capability — used in locked-feature nudges. */
export const CAPABILITY_LABEL: Record<Capability, string> = {
  ISF_FILING: 'ISF Filing',
  ABI_ENTRY: 'ABI Entry',
  CONTAINER_TRACKING: 'Container Tracking',
  HTS_CLASSIFICATION: 'HTS Classification',
  IN_BOND: 'In-Bond Movements',
};

/** The self-serve plan that includes a capability, if any. Undefined means the
 *  capability is set up by our team (entries, tracking, in-bond): talk to us. */
export function minTierForCapability(cap: Capability): PlanMeta | undefined {
  return PUBLIC_TIERS.find((t) => t.capabilities.includes(cap));
}
