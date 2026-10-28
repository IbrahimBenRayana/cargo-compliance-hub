/**
 * Monthly rating for invoiced accounts (pricing plan v2 §5.1, §8.2).
 *
 * A pilot pays a monthly minimum that covers its first N accepted ISFs, then a
 * per-ISF rate for each one above N, plus any entries at their prices. Every
 * accepted shipment's price was locked on its ShipmentCharge row at acceptance;
 * this only adds them up. Pure, so the invoice math is easy to test and to
 * show before an invoice is created.
 */
import type { ChargeKind } from './pricing.js';

/** Defaults from the founder-approved pilot terms, used when an admin switches
 *  an org to invoiced without setting its own numbers. */
export const PILOT_DEFAULTS = {
  monthlyMinimumCents: 25000, // $250 / month
  includedIsfs: 50,
  isfCents: 500, // $5 per ISF above the included 50
} as const;

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
}

export interface InvoiceLine {
  code: 'minimum' | 'isf_overage' | 'entry_linked' | 'entry';
  description: string;
  quantity: number;
  /** Price of one unit when every unit costs the same; null when rates differ. */
  unitCents: number | null;
  amountCents: number;
}

const usd = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

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
  const overage = sumLine('isf_overage', `Accepted ISFs beyond the ${terms.includedIsfs} included`, isfRows.slice(terms.includedIsfs));
  if (overage) lines.push(overage);
  const linked = sumLine('entry_linked', 'Entries on an ISF', rows.filter((r) => r.kind === 'entry_linked'));
  if (linked) lines.push(linked);
  const entry = sumLine('entry', 'Entries', rows.filter((r) => r.kind === 'entry'));
  if (entry) lines.push(entry);

  return { lines, totalCents: lines.reduce((n, l) => n + l.amountCents, 0), isfCount: isfRows.length };
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
