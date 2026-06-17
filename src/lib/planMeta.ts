// ─── Per-Filing Pricing: Tiers & Capabilities (app mirror) ──────────────────
// Mirrors server/src/config/plans.ts. The server is the source of truth for
// rates + capabilities; this file is the display/UX layer (labels, blurbs,
// feature bullets) plus the capability constants the UI gates on. Keep the ids,
// rates, and capability lists in sync with the server.

// Capabilities — must match the server's CAPABILITIES keys exactly.
export const CAPABILITIES = {
  ISF_FILING: 'ISF_FILING',
  ABI_ENTRY: 'ABI_ENTRY',
  CONTAINER_TRACKING: 'CONTAINER_TRACKING',
  HTS_CLASSIFICATION: 'HTS_CLASSIFICATION',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export interface PlanMeta {
  /** Tier id — matches the server plan row id. */
  id: string;
  name: string;
  /** Short positioning line. */
  blurb: string;
  /** Per-shipment rate in cents. */
  perFilingCents: number;
  /** Human price label, e.g. "$45". */
  priceLabel: string;
  /** Sub-label under the price. */
  priceFooter: string;
  capabilities: Capability[];
  /** Marketing bullets for the upgrade / pricing cards. */
  features: string[];
  /** Featured (visually highlighted) tier. */
  featured?: boolean;
}

const dollars = (cents: number) => `$${Math.round(cents / 100)}`;

export const PLAN_META: Record<string, PlanMeta> = {
  isf: {
    id: 'isf',
    name: 'ISF Filing',
    blurb: 'Security filings, pay as you go.',
    perFilingCents: 4500,
    priceLabel: dollars(4500),
    priceFooter: 'per shipment filed',
    capabilities: [CAPABILITIES.ISF_FILING],
    features: [
      'ISF-10 (10+2) & ISF-5 filing',
      'Templates & bulk duplicate',
      'Manifest (MBOL) query',
      'Filing deadline tracking',
      'Email support',
    ],
  },
  entry: {
    id: 'entry',
    name: 'ISF + Entry',
    blurb: 'Add ABI Entry Summary to your filings.',
    perFilingCents: 18000,
    priceLabel: dollars(18000),
    priceFooter: 'per shipment filed',
    capabilities: [CAPABILITIES.ISF_FILING, CAPABILITIES.ABI_ENTRY],
    featured: true,
    features: [
      'Everything in ISF Filing',
      'ABI Entry Summary (7501)',
      'ABI Cargo Release (3461)',
      'Linked ISF + Entry billed once per shipment',
      'Email + chat support',
    ],
  },
  full: {
    id: 'full',
    name: 'Complete',
    blurb: 'The full customs suite.',
    perFilingCents: 28000,
    priceLabel: dollars(28000),
    priceFooter: 'per shipment filed',
    capabilities: [
      CAPABILITIES.ISF_FILING,
      CAPABILITIES.ABI_ENTRY,
      CAPABILITIES.CONTAINER_TRACKING,
      CAPABILITIES.HTS_CLASSIFICATION,
    ],
    features: [
      'Everything in ISF + Entry',
      'Container tracking (Terminal 49)',
      'HTS classification & Duty Calculator',
      'Priority support',
    ],
  },
};

export const KNOWN_PLAN_IDS = Object.keys(PLAN_META);

/** Public tiers in display order (excludes enterprise/custom). */
export const PUBLIC_TIERS: PlanMeta[] = [PLAN_META.isf, PLAN_META.entry, PLAN_META.full];

/** Human label for a capability — used in locked-feature nudges. */
export const CAPABILITY_LABEL: Record<Capability, string> = {
  ISF_FILING: 'ISF Filing',
  ABI_ENTRY: 'ABI Entry',
  CONTAINER_TRACKING: 'Container Tracking',
  HTS_CLASSIFICATION: 'HTS Classification',
};

/** The cheapest public tier that includes a given capability (for "upgrade to
 *  unlock" prompts). */
export function minTierForCapability(cap: Capability): PlanMeta | undefined {
  return PUBLIC_TIERS.find((t) => t.capabilities.includes(cap));
}
