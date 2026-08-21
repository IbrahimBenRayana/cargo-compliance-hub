/**
 * User-fee computation — Entry Summary Create/Update usage notes
 * (m)/(n)/(o)/(p)/(q)/(r)/(w), July 2026 chapter (ESF-161..174).
 *
 * Fee amounts and limits are fiscal-year adjusted; each table row is keyed
 * by its effective date (YYYYMMDD). The applicability date is chosen by
 * the caller per the chapter's date matrices.
 */

interface FeeEra<T> {
  /** First date (YYYYMMDD, inclusive) the row applies. */
  from: string;
  value: T;
}

function pick<T>(eras: FeeEra<T>[], date: string): T {
  for (const era of eras) {
    if (date >= era.from) return era.value;
  }
  return eras[eras.length - 1].value;
}

// ── Formal Merchandise Processing Fee, class 499 (notes n, w) ──

/** MPF ad valorem rate per-million since 1-Oct-2011 (0.3464%). */
export const MPF_RATE_PER_MILLION = 3464;

/** Min/max thresholds in cents, newest first (ESF-173). */
const MPF_LIMITS: FeeEra<{ minCents: number; maxCents: number }>[] = [
  { from: '20251001', value: { minCents: 3358, maxCents: 65150 } },
  { from: '20241001', value: { minCents: 3271, maxCents: 63462 } },
  { from: '20231001', value: { minCents: 3167, maxCents: 61435 } },
  { from: '20221001', value: { minCents: 2966, maxCents: 57535 } },
  { from: '20211001', value: { minCents: 2775, maxCents: 53840 } },
  { from: '20201001', value: { minCents: 2723, maxCents: 52833 } },
  { from: '20191001', value: { minCents: 2679, maxCents: 51976 } },
  { from: '20181001', value: { minCents: 2622, maxCents: 50870 } },
  { from: '20180101', value: { minCents: 2567, maxCents: 49799 } },
  { from: '20111001', value: { minCents: 2500, maxCents: 48500 } },
];

/** Line-level formal MPF in cents: article value × 0.3464%, standard rounding. */
export function computeLineMpfCents(valueDollars: number): number {
  return Math.round((valueDollars * MPF_RATE_PER_MILLION) / 10_000);
}

/**
 * Apply the min/max to the summed line MPF for the 89-record 499 total
 * (usage note w): below min report min, above max report max.
 */
export function applyMpfMinMax(totalLineMpfCents: number, date: string): number {
  const { minCents, maxCents } = pick(MPF_LIMITS, date);
  if (totalLineMpfCents < minCents) return minCents;
  if (totalLineMpfCents > maxCents) return maxCents;
  return totalLineMpfCents;
}

// ── Harbor Maintenance Fee, class 501 (note o) ─────────────

/** HMF rate per-million since 1-Jan-1991 (0.125%). */
export const HMF_RATE_PER_MILLION = 1250;

/** HMF de minimis threshold: ≤ $3.00 for the entire summary (note o). */
export const HMF_DE_MINIMIS_CENTS = 300;

/**
 * SPI programs whose goods are exempt from MPF per CBP's "Merchandise
 * Processing Fee and Preferential Trade Programs" table (19 CFR 24.23(c)):
 * Australia, Bahrain, CAFTA-DR, Chile, Colombia, Korea, USMCA, Oman,
 * Panama, Peru, Singapore. Notably NOT exempt: Israel (IL), Jordan (JO),
 * Morocco (MA), plain GSP (A). CERT enforces this as F632.
 */
export const MPF_EXEMPT_SPI = new Set([
  'AU', 'BH', 'P', 'P+', 'CL', 'CO', 'KS', 'S', 'S+', 'OM', 'PA', 'PE', 'SG',
]);

const HMF_MOTS = new Set(['10', '11', '12']);
const HMF_EXEMPT_ENTRY_TYPES = new Set(['11', '12', '06', '22', '31', '32', '34', '38']);

/** Whether HMF applies at all for this MOT + entry type (note o). */
export function hmfApplies(motCode: string | undefined, entryTypeCode: string): boolean {
  return motCode !== undefined && HMF_MOTS.has(motCode) && !HMF_EXEMPT_ENTRY_TYPES.has(entryTypeCode);
}

/**
 * Line-level HMF in cents: sum of the line's 50-record values × 0.125%,
 * rounded once per line (note o's calculation guidance).
 */
export function computeLineHmfCents(lineValueDollarsSum: number): number {
  return Math.round((lineValueDollarsSum * HMF_RATE_PER_MILLION) / 10_000);
}

// ── Fixed header fees (notes p, q, r) ──────────────────────

/** Informal Entry Fee, class 311 (ESF-164). */
const INFORMAL_FEE: FeeEra<number>[] = [
  { from: '20251001', value: 269 },
  { from: '20241001', value: 262 },
  { from: '20231001', value: 253 },
  { from: '20221001', value: 237 },
  { from: '20211001', value: 222 },
  { from: '20201001', value: 218 },
  { from: '20191001', value: 214 },
  { from: '20181001', value: 210 },
  { from: '20180101', value: 205 },
  { from: '19700101', value: 200 },
];

/** Dutiable Mail Fee, class 496 (ESF-163). */
const MAIL_FEE: FeeEra<number>[] = [
  { from: '20251001', value: 739 },
  { from: '20241001', value: 720 },
  { from: '20231001', value: 697 },
  { from: '20221001', value: 652 },
  { from: '20211001', value: 611 },
  { from: '20201001', value: 599 },
  { from: '20191001', value: 589 },
  { from: '20181001', value: 577 },
  { from: '20180101', value: 565 },
  { from: '19700101', value: 500 },
];

/** Manual Entry Surcharge, class 500 (ESF-165). */
const SURCHARGE: FeeEra<number>[] = [
  { from: '20251001', value: 403 },
  { from: '20241001', value: 393 },
  { from: '20231001', value: 380 },
  { from: '20221001', value: 356 },
  { from: '20211001', value: 333 },
  { from: '20201001', value: 327 },
  { from: '20191001', value: 321 },
  { from: '20181001', value: 315 },
  { from: '20180101', value: 308 },
  { from: '19700101', value: 300 },
];

export function informalEntryFeeCents(date: string): number {
  return pick(INFORMAL_FEE, date);
}

export function dutiableMailFeeCents(date: string): number {
  return pick(MAIL_FEE, date);
}

export function manualEntrySurchargeCents(date: string): number {
  return pick(SURCHARGE, date);
}
