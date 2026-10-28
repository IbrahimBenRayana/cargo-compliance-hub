// ─── Plans: capability bundles + the self-serve ISF price ───────────────────
//
// SINGLE SOURCE OF TRUTH for the plan catalogue. planSync copies TIERS into the
// DB `plans` table on boot; the app (src/lib/planMeta.ts) mirrors the public
// numbers — keep them in sync when editing.
//
// Pricing v2 ("price for proof", Oct 2026):
//   • There is no monthly subscription fee on the public card. A shipment is
//     charged when CBP ACCEPTS it (never on submission, never when rejected),
//     by an off-session card charge (services/shipmentBilling.ts).
//   • The price follows WHAT WAS FILED, not the plan: an accepted ISF bills the
//     org's ISF price; an accepted entry bills the org's entry price (linked to
//     an ISF, or entry-only). See services/pricing.ts.
//   • ISF is the only self-serve price: $45 per accepted ISF.
//   • Entries have no public price ("talk to us"). They are priced per org by
//     a platform admin in /admin, on the private `entry` plan.
//   • Per-org overrides live on the org's Subscription row, so planSync (which
//     rewrites these defaults on every boot) never touches a negotiated price.
//
// Retired: `full` (Complete, $280) and `entry` as a $180 public tier. Orgs on
// them were moved by migration z_billing_v2_charge_integrity.

// ─── Capabilities ───────────────────────────────────────────
// The gateable product surfaces. ISF_FILING is the base capability every plan
// has. HTS_CLASSIFICATION gates the dedicated classification tooling (the Duty
// Calculator); HTS suggestions are on every plan (founder decision, Oct 2026),
// so every plan carries it.
export const CAPABILITIES = {
  ISF_FILING: 'ISF_FILING',
  ABI_ENTRY: 'ABI_ENTRY',
  CONTAINER_TRACKING: 'CONTAINER_TRACKING',
  HTS_CLASSIFICATION: 'HTS_CLASSIFICATION',
  // Native in-bond (7512) movements — admin-assigned plans only.
  IN_BOND: 'IN_BOND',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// ─── Plan definitions ───────────────────────────────────────
export interface TierDef {
  /** Plan row id. */
  id: string;
  /** Display name. */
  name: string;
  description: string;
  /** Default price (cents) of one accepted ISF. An org's own price overrides it. */
  perFilingCents: number;
  /** Unlocked product surfaces. */
  capabilities: Capability[];
  /** Self-selectable in the app (false = assigned by a platform admin). */
  isPublic: boolean;
  sortOrder: number;
  /** Marketing bullet keys for the pricing/upgrade UI. */
  features: string[];
}

const ALL_CAPABILITIES: Capability[] = [
  CAPABILITIES.ISF_FILING,
  CAPABILITIES.ABI_ENTRY,
  CAPABILITIES.CONTAINER_TRACKING,
  CAPABILITIES.HTS_CLASSIFICATION,
  CAPABILITIES.IN_BOND,
];

export const TIERS: TierDef[] = [
  {
    id: 'isf',
    name: 'ISF Filing',
    description: 'File ISF-10 / ISF-5 security filings. Pay only when CBP accepts.',
    perFilingCents: 4500, // $45 per accepted ISF
    capabilities: [CAPABILITIES.ISF_FILING, CAPABILITIES.HTS_CLASSIFICATION],
    isPublic: true,
    sortOrder: 1,
    features: ['isf_10_2', 'isf_5', 'templates', 'manifest_query', 'hts_suggestions', 'email_support'],
  },
  {
    id: 'entry',
    name: 'ISF + Entry',
    description: 'ISF plus customs entries (7501/3461). Entry pricing is set per account.',
    perFilingCents: 4500, // ISF price; entry prices are per org (Subscription)
    capabilities: ALL_CAPABILITIES,
    isPublic: false,
    sortOrder: 2,
    features: ['everything_in_isf', 'abi_entry_7501', 'abi_entry_3461', 'cargo_release', 'container_tracking', 'chat_support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Contract pricing, invoiced. Contact us.',
    perFilingCents: 0, // per contract
    capabilities: ALL_CAPABILITIES,
    isPublic: false,
    sortOrder: 4,
    features: ['everything_in_entry', 'dedicated_csm', 'custom_integrations'],
  },
];

/** Plan ids that no longer exist. Their DB rows stay (old charges reference
 *  them) but planSync marks them inactive so nobody can be put on them. */
export const RETIRED_TIER_IDS = ['full'] as const;

// ─── Helpers ─────────────────────────────────────────────────
const TIER_BY_ID = new Map(TIERS.map((t) => [t.id, t]));

export function tierById(id: string | null | undefined): TierDef | undefined {
  return id ? TIER_BY_ID.get(id) : undefined;
}

export function capabilitiesForTier(id: string | null | undefined): Capability[] {
  return tierById(id)?.capabilities ?? [];
}

export function tierHasCapability(id: string | null | undefined, cap: Capability): boolean {
  return capabilitiesForTier(id).includes(cap);
}
