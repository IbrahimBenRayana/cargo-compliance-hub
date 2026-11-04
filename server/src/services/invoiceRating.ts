/**
 * Monthly rating for invoiced accounts (pricing plan v2 §5.1, §8.2).
 *
 * A pilot pays a monthly minimum that covers its first N accepted ISFs, then a
 * per-ISF rate for each one above N, plus any entries at their prices. Every
 * accepted shipment's price was locked on its ShipmentCharge row at acceptance;
 * this only adds them up. Pure, so the invoice math is easy to test and to
 * show before an invoice is created.
 *
 * Volume bands (pilot offer ladder: $5 for ISFs 51-250, $4 from 251): an ISF's
 * band depends on how many came before it in the month, which isn't known at
 * acceptance, so bands are applied here. ISFs above the included count and
 * below the first band keep their locked rate; from a band's first ISF on, its
 * rate replaces the locked one. The last band runs on until another is set.
 */
import type { ChargeKind } from './pricing.js';

/** Defaults from the founder-approved pilot terms, used when an admin switches
 *  an org to invoiced without setting its own numbers. */
export const PILOT_DEFAULTS = {
  monthlyMinimumCents: 25000, // $250 / month
  includedIsfs: 50,
  isfCents: 500, // $5 per ISF above the included 50
  isfBands: [{ fromIsf: 251, cents: 400 }], // $4 per ISF from the 251st
};

/** From the `fromIsf`-th accepted ISF of the month on, each costs `cents`. */
export interface IsfBand {
  fromIsf: number;
  cents: number;
}

export const MAX_ISF_BANDS = 5;

/** Bands as stored (JSON column); anything malformed reads as no bands. */
export function isfBandsOf(stored: unknown): IsfBand[] {
  if (!Array.isArray(stored)) return [];
  const bands = stored.map((b) => ({ fromIsf: Number(b?.fromIsf), cents: Number(b?.cents) }));
  return checkIsfBands(bands) ? [] : bands;
}

/** Validate admin band input. Returns an error message, or null when valid. */
export function checkIsfBands(bands: IsfBand[] | null | undefined): string | null {
  if (!bands || bands.length === 0) return null;
  if (bands.length > MAX_ISF_BANDS) return `At most ${MAX_ISF_BANDS} bands.`;
  for (const [i, b] of bands.entries()) {
    if (!Number.isInteger(b.fromIsf) || b.fromIsf < 2 || b.fromIsf > 1_000_000) {
      return 'Each band starts at a whole ISF number from 2 to 1,000,000.';
    }
    if (!Number.isInteger(b.cents) || b.cents < 0 || b.cents > 1_000_000) {
      return 'Band prices must be whole cents between 0 and 1,000,000.';
    }
    if (i > 0 && b.fromIsf <= bands[i - 1].fromIsf) return 'Bands must be in order, each starting after the one before.';
  }
  return null;
}

export interface RatedRow {
  kind: ChargeKind;
  amountCents: number;
  billedAt: Date;
}

export interface InvoiceTerms {
  minimumCents: number;
  includedIsfs: number;
  /** The month's minimum was billed in advance (a prepay invoice). */
  minimumPrepaid: boolean;
  /** Volume bands above the included count, in order; none = one locked rate. */
  isfBands?: IsfBand[] | null;
}

export interface InvoiceLine {
  code: 'minimum' | 'isf_overage' | 'isf_band' | 'entry_linked' | 'entry';
  description: string;
  quantity: number;
  /** Price of one unit when every unit costs the same; null when rates differ. */
  unitCents: number | null;
  amountCents: number;
}

const usd = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
const count = (n: number) => n.toLocaleString('en-US');
const range = (from: number, to: number | null) => (to == null ? `${count(from)} and above` : `${count(from)}-${count(to)}`);

function sumLine(code: InvoiceLine['code'], label: string, rows: RatedRow[]): InvoiceLine | null {
  if (rows.length === 0) return null;
  const amountCents = rows.reduce((n, r) => n + r.amountCents, 0);
  if (amountCents === 0) return null;
  const rates = new Set(rows.map((r) => r.amountCents));
  const unitCents = rates.size === 1 ? rows[0].amountCents : null;
  return {
    code,
    description: unitCents != null ? `${label}: ${rows.length} × ${usd(unitCents)}` : `${label}: ${rows.length}`,
    quantity: rows.length,
    unitCents,
    amountCents,
  };
}

export function rateMonth(rows: RatedRow[], terms: InvoiceTerms): { lines: InvoiceLine[]; totalCents: number; isfCount: number } {
  const isfRows = rows.filter((r) => r.kind === 'isf').sort((a, b) => a.billedAt.getTime() - b.billedAt.getTime());
  const lines: InvoiceLine[] = [];

  if (terms.minimumCents > 0 && !terms.minimumPrepaid) {
    lines.push({
      code: 'minimum',
      description: `Monthly minimum: includes ${terms.includedIsfs} accepted ISFs (${isfRows.length} used)`,
      quantity: 1,
      unitCents: terms.minimumCents,
      amountCents: terms.minimumCents,
    });
  }
  lines.push(...isfLines(isfRows, terms));
  const linked = sumLine('entry_linked', 'Entries on an ISF', rows.filter((r) => r.kind === 'entry_linked'));
  if (linked) lines.push(linked);
  const entry = sumLine('entry', 'Entries', rows.filter((r) => r.kind === 'entry'));
  if (entry) lines.push(entry);

  return { lines, totalCents: lines.reduce((n, l) => n + l.amountCents, 0), isfCount: isfRows.length };
}

/** ISFs above the included count: at their locked rate, then band by band. */
function isfLines(isfRows: RatedRow[], terms: InvoiceTerms): InvoiceLine[] {
  const included = terms.includedIsfs;
  // Bands inside the included count start where billing does.
  const bands = (terms.isfBands ?? []).map((b) => ({ ...b, fromIsf: Math.max(b.fromIsf, included + 1) }));
  if (bands.length === 0) {
    const flat = sumLine('isf_overage', `Accepted ISFs beyond the ${included} included`, isfRows.slice(included));
    return flat ? [flat] : [];
  }
  const lines: InvoiceLine[] = [];
  // Positions are 1-based: the n-th accepted ISF of the month is isfRows[n - 1].
  const firstBand = bands[0].fromIsf;
  const locked = sumLine('isf_overage', `Accepted ISFs ${range(included + 1, firstBand - 1)}`, isfRows.slice(included, firstBand - 1));
  if (locked) lines.push(locked);
  for (const [i, band] of bands.entries()) {
    const next = bands[i + 1]?.fromIsf ?? null;
    const rows = isfRows.slice(band.fromIsf - 1, next == null ? undefined : next - 1).map((r) => ({ ...r, amountCents: band.cents }));
    const line = sumLine('isf_band', `Accepted ISFs ${range(band.fromIsf, next == null ? null : next - 1)}`, rows);
    if (line) lines.push(line);
  }
  return lines;
}

/** The prepay invoice for a month: its minimum only. */
export function prepayLines(terms: Pick<InvoiceTerms, 'minimumCents' | 'includedIsfs'>, periodLabel: string): InvoiceLine[] {
  if (terms.minimumCents <= 0) return [];
  return [{
    code: 'minimum',
    description: `Monthly minimum for ${periodLabel}, paid in advance (includes ${terms.includedIsfs} accepted ISFs)`,
    quantity: 1,
    unitCents: terms.minimumCents,
    amountCents: terms.minimumCents,
  }];
}

/** "2026-11" → first day of that UTC month; null if malformed. */
export function parsePeriod(period: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(Number(m[1]), month - 1, 1));
}

export function monthWindow(start: Date): { start: Date; end: Date } {
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
}

export function periodLabel(start: Date): string {
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
