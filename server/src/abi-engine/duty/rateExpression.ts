/**
 * HTS rate-expression parser (duty engine, workstream F).
 *
 * The HTS "General" rate-of-duty column is free text. The engine supports
 * the forms the certification scenarios exercise:
 *   "Free"                       → no duty
 *   "2.6%"                       → ad valorem
 *   "$1.50/kg", "4.4¢/kg"        → specific (per unit of quantity 1)
 *   "4.4¢/kg + 4%"               → compound (sum of components)
 *   "The duty provided in the applicable subheading + 25%"
 *                                → ch.99 overlay surcharge (Section 301/232
 *                                  lines): ad valorem on the value of the
 *                                  ch.1–97 tariff(s) on the same line
 * Anything else throws — filer-computed duty must never be guessed.
 *
 * The "Special" column groups preference rates by SPI program, e.g.
 *   "Free (A*, AU, BH, CL, D, E, IL, JO, KR, MA, OM, P, PA, PE, S, SG)"
 *   "Free (AU, BH) 2.5% (JO)"
 * pickSpecialRate() extracts the rate expression a claimed SPI qualifies
 * for, or null when the program is not listed for the subheading.
 *
 * Fixed-point units, chosen to be exact for every published HTS rate:
 *   ad valorem   → basis points ×100 (2.6%  → 26000 per-million)
 *   specific     → micro-dollars per unit ($0.044 → 44000)
 */
import { RecordCodecError, type CodecIssue } from '../records/codec.js';

export type RateComponent =
  | { kind: 'free' }
  | { kind: 'adValorem'; perMillion: number }
  | { kind: 'specific'; microDollarsPerUnit: number; unit: string }
  /** Ch.99 "duty of the applicable subheading + X%": the X% part, computed
   *  on the value of the OTHER (ch.1–97) tariffs of the same line. */
  | { kind: 'overlaySurcharge'; perMillion: number };

function fail(expression: string, message: string): never {
  const issue: CodecIssue = { record: 'RateExpression', field: expression, message };
  throw new RecordCodecError([issue]);
}

function parseComponent(raw: string, full: string): RateComponent {
  const text = raw.trim();

  const percent = text.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    return { kind: 'adValorem', perMillion: Math.round(Number(percent[1]) * 10000) };
  }

  const dollars = text.match(/^\$(\d+(?:\.\d+)?)\s*\/\s*([a-zA-Z0-9.]+)$/);
  if (dollars) {
    return { kind: 'specific', microDollarsPerUnit: Math.round(Number(dollars[1]) * 1_000_000), unit: dollars[2].toLowerCase() };
  }

  const cents = text.match(/^(\d+(?:\.\d+)?)\s*[¢c]\s*\/\s*([a-zA-Z0-9.]+)$/);
  if (cents) {
    return { kind: 'specific', microDollarsPerUnit: Math.round(Number(cents[1]) * 10_000), unit: cents[2].toLowerCase() };
  }

  fail(full, `unsupported rate component '${text}'`);
}

/** Parse an HTS rate expression into components. Throws on unsupported forms. */
export function parseRateExpression(expression: string): RateComponent[] {
  const text = expression.trim();
  if (text === '' ) fail(expression, 'empty rate expression');
  if (/^free$/i.test(text)) return [{ kind: 'free' }];

  // Ch.99 overlay wording (Section 301/232 additional-duty subheadings).
  const overlay = text.match(
    /^the duty provided in the applicable subheading\s*\+\s*(\d+(?:\.\d+)?)\s*%$/i
  );
  if (overlay) {
    return [{ kind: 'overlaySurcharge', perMillion: Math.round(Number(overlay[1]) * 10000) }];
  }

  return text.split('+').map((part) => parseComponent(part, expression));
}

/**
 * Pick the preference rate a claimed SPI program qualifies for from an HTS
 * "Special" column expression. Returns the rate expression text (parseable by
 * parseRateExpression) or null when the program is not listed.
 *
 * Program matching: a listing token matches the claim when they are equal, or
 * when the token is the claim plus a trailing '*' (e.g. listing 'A*' covers a
 * claim of 'A' — the asterisk marks partial-article coverage, which is the
 * filer's responsibility to have verified). 'A+' is a DIFFERENT program
 * (GSP least-developed) and only matches an 'A+' claim.
 */
export function pickSpecialRate(specialExpression: string, spiCode: string): string | null {
  const claim = spiCode.trim().toUpperCase();
  if (claim === '') return null;
  const groups = specialExpression.matchAll(/([^()]+)\(([^)]+)\)/g);
  for (const group of groups) {
    const rateText = group[1].trim().replace(/,$/, '');
    const programs = group[2].split(',').map((p) => p.trim().toUpperCase());
    for (const token of programs) {
      if (token === claim || token === `${claim}*`) {
        return rateText === '' ? null : rateText;
      }
    }
  }
  return null;
}

export interface DutyBasis {
  /** Entered value in whole dollars (50-record Value of Goods). */
  valueDollars: number;
  /** Quantity 1 in hundredths (two implied decimals), when reported. */
  quantity1Hundredths?: number;
  /**
   * Combined value of the line's ch.1–97 tariffs, for ch.99 overlay
   * surcharges ("duty of the applicable subheading + X%"). Supplied by the
   * engine when the line carries multiple tariffs.
   */
  applicableSubheadingValueDollars?: number;
}

/**
 * Compute the estimated duty in cents for one tariff line.
 * Specific components require quantity 1; its UOM must be the unit the
 * rate prescribes (the caller/refdata layer guarantees the pairing).
 */
export function computeDutyCents(components: RateComponent[], basis: DutyBasis, expression = ''): number {
  let totalMicroDollars = 0;
  for (const component of components) {
    if (component.kind === 'free') continue;
    if (component.kind === 'adValorem') {
      totalMicroDollars += basis.valueDollars * component.perMillion;
    } else if (component.kind === 'overlaySurcharge') {
      if (basis.applicableSubheadingValueDollars === undefined) {
        fail(expression, 'ch.99 overlay surcharge requires the applicable-subheading value');
      }
      totalMicroDollars += basis.applicableSubheadingValueDollars * component.perMillion;
    } else {
      if (basis.quantity1Hundredths === undefined) {
        fail(expression || component.unit, 'specific rate requires quantity 1');
      }
      totalMicroDollars += (basis.quantity1Hundredths / 100) * component.microDollarsPerUnit;
    }
  }
  // Micro-dollars → cents, standard rounding (ESF-186).
  return Math.round(totalMicroDollars / 10_000);
}
