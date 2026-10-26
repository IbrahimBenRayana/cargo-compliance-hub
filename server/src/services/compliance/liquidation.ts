/**
 * Liquidation math.
 *
 * CBP "liquidates" an entry — i.e. finalizes the duty/fee/tax amount — by
 * default 314 days after the entry summary is filed (19 CFR § 159.11).
 * Within the 314-day window, the importer can file a Post-Summary Correction
 * (PSC) up to 270 days after entry. After liquidation, the importer has 180
 * days to file a Protest (19 USC § 1514) to challenge the final amount.
 *
 * Reference dates we compute:
 *   • estimatedLiquidationAt = entryDate + 314 days
 *   • pscDeadline            = entryDate + 270 days
 *   • protestDeadline        = liquidationAt + 180 days  (if liquidated)
 *
 * All math is done in UTC to avoid timezone drift.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const LIQUIDATION_WINDOW_DAYS = 314;
export const PSC_WINDOW_DAYS = 270;
export const PROTEST_WINDOW_DAYS = 180;

export interface LiquidationDates {
  entryDate: Date;
  estimatedLiquidationAt: Date;
  pscDeadline: Date;
  daysUntilLiquidation: number;
  daysUntilPscDeadline: number;
  status: 'pending' | 'psc-window-open' | 'awaiting-liquidation' | 'liquidated';
}

/** All math derived from the entry date. `now` is overridable for tests. */
export function computeLiquidation(entryDate: Date, now: Date = new Date()): LiquidationDates {
  const entry = new Date(entryDate.getTime());
  const estimatedLiquidationAt = new Date(entry.getTime() + LIQUIDATION_WINDOW_DAYS * DAY_MS);
  const pscDeadline = new Date(entry.getTime() + PSC_WINDOW_DAYS * DAY_MS);

  const daysSinceEntry = Math.floor((now.getTime() - entry.getTime()) / DAY_MS);
  const daysUntilLiquidation = LIQUIDATION_WINDOW_DAYS - daysSinceEntry;
  const daysUntilPscDeadline = PSC_WINDOW_DAYS - daysSinceEntry;

  let status: LiquidationDates['status'];
  if (daysSinceEntry < 0) status = 'pending';
  else if (daysSinceEntry <= PSC_WINDOW_DAYS) status = 'psc-window-open';
  else if (daysSinceEntry <= LIQUIDATION_WINDOW_DAYS) status = 'awaiting-liquidation';
  else status = 'liquidated';

  return {
    entryDate: entry,
    estimatedLiquidationAt,
    pscDeadline,
    daysUntilLiquidation,
    daysUntilPscDeadline,
    status,
  };
}

/** Protest deadline = 180 days from actual liquidation. Used once CBP confirms. */
export function computeProtestDeadline(liquidationDate: Date): {
  protestDeadline: Date;
  daysRemaining: number;
  expired: boolean;
} {
  const protestDeadline = new Date(liquidationDate.getTime() + PROTEST_WINDOW_DAYS * DAY_MS);
  const daysRemaining = Math.floor((protestDeadline.getTime() - Date.now()) / DAY_MS);
  return {
    protestDeadline,
    daysRemaining,
    expired: daysRemaining < 0,
  };
}

export interface LiquidationSource {
  id: string;
  /** Entry number as CBP prints it (XXX-NNNNNNN-N), else the bill. */
  ref: string;
  entryType: string;
  entryDate: Date;
  linkUrl: string;
}

/**
 * Accepted entry summaries to track for PSC and liquidation. Liquidation is
 * an entry concept, dated from the entry date (falling back to CBP's answer,
 * then the send); ISF filings never liquidate.
 */
export function liquidationSources(docs: Array<{
  id: string; entryNumber: string | null; mbolNumber: string | null; entryType: string;
  payload: unknown; respondedAt: Date | null; sentAt: Date | null;
}>): LiquidationSource[] {
  const out: LiquidationSource[] = [];
  for (const d of docs) {
    const ymd = (d.payload as { dates?: { entryDate?: unknown } } | null)?.dates?.entryDate;
    const entryDate = typeof ymd === 'string' && /^\d{8}$/.test(ymd)
      ? new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00Z`)
      : d.respondedAt ?? d.sentAt;
    if (!entryDate) continue;
    const n = (d.entryNumber ?? '').replace(/-/g, '');
    const ref = n.length === 11 ? `${n.slice(0, 3)}-${n.slice(3, 10)}-${n.slice(10)}` : d.entryNumber || d.mbolNumber || d.id.slice(0, 8);
    out.push({ id: d.id, ref, entryType: d.entryType, entryDate, linkUrl: `/abi-documents/${d.id}` });
  }
  return out;
}
