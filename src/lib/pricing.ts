// Display helpers for an org's own prices (from GET /billing/subscription).
// Pricing v2: a shipment is priced by what was filed: an accepted ISF, an entry
// linked to an ISF (charged on top of it), or an entry on its own.

export interface OrgPricing {
  isfCents: number;
  entryLinkedCents: number | null;
  entryOnlyCents: number | null;
}

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

/** One line per thing the org can be charged for, e.g. "$45 per accepted ISF". */
export function pricingLines(p: OrgPricing | null | undefined): string[] {
  if (!p) return [];
  const lines = [p.isfCents > 0 ? `${money(p.isfCents)} per accepted ISF` : 'ISF filings at no charge'];
  if (p.entryLinkedCents != null && p.entryOnlyCents != null) {
    lines.push(
      p.entryLinkedCents > 0 ? `+${money(p.entryLinkedCents)} for an entry on the same shipment as an ISF` : 'Entry on an ISF shipment at no charge',
      p.entryOnlyCents > 0 ? `${money(p.entryOnlyCents)} per entry without an ISF` : 'Entry without an ISF at no charge',
    );
  }
  return lines;
}

/** Admin price input: "45" / "$45.50" → cents; "" → null (use the default).
 *  NaN marks input that isn't a dollar amount. */
export function dollarsToCents(v: string): number | null {
  const t = v.trim().replace(/^\$/, '');
  if (t === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return Math.round(Number(t) * 100);
}

/** Invoiced volume band: from the fromIsf-th accepted ISF of a month on, each costs cents. */
export interface IsfBand {
  fromIsf: number;
  cents: number;
}

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n.toLocaleString('en-US')}${suffix}`;
};

/** One line per band, e.g. "$4 per accepted ISF from the 251st in a month". */
export function isfBandLines(bands: IsfBand[] | null | undefined): string[] {
  return (bands ?? []).map((b) => `${money(b.cents)} per accepted ISF from the ${ordinal(b.fromIsf)} in a month`);
}
