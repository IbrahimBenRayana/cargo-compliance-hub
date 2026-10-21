/**
 * Step 6 of the native HTS classifier: rules in code, not AI, that decide
 * what the user is told. A wrong HTS code means wrong duty, so "High" is
 * earned only when every signal agrees, and money differences are spelled out.
 */
import type { Sufficiency } from './understand.js';
import type { Verification } from './verify.js';

export type ConfidenceLabel = 'high' | 'medium' | 'low';

export const NOT_A_RULING =
  'Suggestions are not a binding classification. The importer of record is responsible for the HTS code declared to CBP; for certainty, request a binding ruling (19 CFR Part 177).';

export const EXTRA_DUTY_NOTE =
  'Rates shown are the General (column 1) rate only. Chapter 99 duties (e.g. Section 301 or 232) and AD/CVD can apply on top.';

const HIGH_MIN = 0.85;
const VERIFY_MIN = 0.8;
const LEAD_MIN = 0.25;
const MEDIUM_MIN = 0.55;

export function confidenceLabel(p: {
  confidence: number;
  rank: number;
  nextConfidence: number;
  verification: Verification | null;
  sufficiency: Sufficiency;
}): ConfidenceLabel {
  if (p.rank > 0) return p.confidence >= MEDIUM_MIN ? 'medium' : 'low';
  if (p.verification && !p.verification.fits) return 'low';
  if (p.confidence < MEDIUM_MIN) return 'low';
  const high =
    p.confidence >= HIGH_MIN &&
    p.verification !== null && p.verification.confidence >= VERIFY_MIN &&
    p.sufficiency === 'enough' &&
    p.confidence - p.nextConfidence >= LEAD_MIN;
  return high ? 'high' : 'medium';
}

/** "Free" -> 0, "3.4%" -> 3.4; anything else (specific or compound) -> null. */
export function parseAdValorem(rate: string): number | null {
  const r = rate.trim();
  if (/^free$/i.test(r)) return 0;
  const m = /^(\d+(?:\.\d+)?)%$/.exec(r);
  return m ? Number(m[1]) : null;
}

const SPREAD_POINTS = 3;
const show = (n: number) => (n === 0 ? 'Free' : `${n}%`);

export function dutySpreadWarning(rates: string[]): string | undefined {
  const distinct = [...new Set(rates.map((r) => r.trim()).filter(Boolean))];
  if (distinct.length < 2) return undefined;
  const parsed = distinct.map(parseAdValorem);
  if (parsed.some((x) => x === null)) {
    return `These codes have duty calculated differently (${distinct.join('; ')}). Choosing the right one changes what you pay.`;
  }
  const nums = parsed as number[];
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  if (hi - lo < SPREAD_POINTS) return undefined;
  return `These codes carry different duty: ${show(lo)} to ${show(hi)}. Choosing the right one changes what you pay.`;
}
