/**
 * Pricing v2 — what one accepted shipment costs an org.
 *
 * The price follows WHAT WAS FILED (pricing plan v2 §8.1 item 0.4; billing
 * audit P1 G4), never the plan the org happens to be on when CBP accepts:
 *   isf           an accepted ISF
 *   entry_linked  an accepted entry linked to an ISF — charged ON TOP of that
 *                 ISF, so "ISF + Entry" = isfCents + entryLinkedCents. Only one
 *                 entry per ISF gets this price (P1 G3).
 *   entry         an accepted entry with no ISF, or a further entry on one ISF
 *
 * Prices are per org (Subscription columns, set by a platform admin). The ISF
 * price falls back to the plan's default ($45 on the public card). Entries have
 * no public price, so with no entry pricing an org cannot send entries.
 */

export type ChargeKind = 'isf' | 'entry_linked' | 'entry';

export interface OrgPricing {
  isfCents: number;
  entryLinkedCents: number | null;
  entryOnlyCents: number | null;
}

export interface PriceOverrides {
  isfCents?: number | null;
  entryLinkedCents?: number | null;
  entryOnlyCents?: number | null;
}

export function resolvePricing(planIsfCents: number | null | undefined, sub: PriceOverrides | null | undefined): OrgPricing {
  return {
    isfCents: sub?.isfCents ?? planIsfCents ?? 0,
    entryLinkedCents: sub?.entryLinkedCents ?? null,
    entryOnlyCents: sub?.entryOnlyCents ?? null,
  };
}

/** The price of one shipment of this kind; null = not priced for this org. */
export function priceFor(kind: ChargeKind, p: OrgPricing): number | null {
  if (kind === 'isf') return p.isfCents;
  return kind === 'entry_linked' ? p.entryLinkedCents : p.entryOnlyCents;
}

export function entryPricingSet(p: OrgPricing): boolean {
  return p.entryLinkedCents != null && p.entryOnlyCents != null;
}

/** Card-mode orgs need a payment method once anything they file costs money. */
export function requiresPaymentMethod(p: OrgPricing): boolean {
  return p.isfCents > 0 || (p.entryLinkedCents ?? 0) > 0 || (p.entryOnlyCents ?? 0) > 0;
}

/** Highest price an admin can set for one shipment ($10,000): a typo guard. */
export const MAX_PRICE_CENTS = 1_000_000;

/** Validate admin price input. Returns an error message, or null when valid. */
export function checkPriceInput(p: PriceOverrides): string | null {
  for (const v of [p.isfCents, p.entryLinkedCents, p.entryOnlyCents]) {
    if (v == null) continue;
    if (!Number.isInteger(v) || v < 0 || v > MAX_PRICE_CENTS) {
      return 'Prices must be whole cents between 0 and 1,000,000.';
    }
  }
  // Pricing plan CR1: entry-only and the linked price are set together, so
  // unbundling can never undercut the bundle by accident.
  if ((p.entryLinkedCents == null) !== (p.entryOnlyCents == null)) {
    return 'Set the linked-entry and entry-only prices together, or clear both.';
  }
  return null;
}
