/**
 * HTS rate-expression parser (duty engine, workstream F).
 *
 * The HTS "General" rate-of-duty column is free text. The engine supports
 * the forms the certification scenarios exercise:
 *   "Free"                       → no duty
 *   "2.6%"                       → ad valorem
 *   "$1.50/kg", "4.4¢/kg"        → specific (per unit of quantity 1)
 *   "4.4¢/kg + 4%"               → compound (sum of components)
 * Anything else throws — filer-computed duty must never be guessed.
 *
 * Fixed-point units, chosen to be exact for every published HTS rate:
 *   ad valorem   → basis points ×100 (2.6%  → 26000 per-million)
 *   specific     → micro-dollars per unit ($0.044 → 44000)
 */
import { RecordCodecError, type CodecIssue } from '../records/codec.js';

export type RateComponent =
  | { kind: 'free' }
  | { kind: 'adValorem'; perMillion: number }
  | { kind: 'specific'; microDollarsPerUnit: number; unit: string };

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
  return text.split('+').map((part) => parseComponent(part, expression));
}

export interface DutyBasis {
  /** Entered value in whole dollars (50-record Value of Goods). */
  valueDollars: number;
  /** Quantity 1 in hundredths (two implied decimals), when reported. */
  quantity1Hundredths?: number;
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
