/**
 * Entry-number check digit (CBP AE Table 1) — frontend port of
 * server/src/abi-engine/ae/checkDigit.ts so the wizard can flag a bad
 * check digit as the user types, without a round-trip per keystroke.
 * Keep the two implementations in lock-step; the test file pins engine-
 * generated vectors to catch drift.
 */

/** Alpha→numeric conversion table from Step ONE of AE Table 1. */
const ALPHA_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

export function computeEntryCheckDigit(filerCode: string, sequence7: string): number {
  const base = (filerCode.toUpperCase() + sequence7)
    .split('')
    .map((ch) => (ch >= '0' && ch <= '9' ? Number(ch) : ALPHA_VALUES[ch] ?? 0));

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = base[i];
    if ((i + 1) % 2 === 0) {
      let product = digit * 2;
      if (product > 9) product += 1;
      sum += product % 10;
    } else {
      sum += digit;
    }
  }
  return (10 - (sum % 10)) % 10;
}

export interface EntryNumberLocalValidation {
  valid: boolean;
  canonical?: string;
  expectedCheckDigit?: number;
}

/**
 * Validate a typed entry number's check digit. Only fires on a fully
 * formed number (3 filer chars + 7 digits + check digit, hyphens
 * optional) — partial input returns valid so we never nag mid-keystroke;
 * shape completeness is the schema/validators' job.
 */
export function validateEntryNumberLocal(raw: string): EntryNumberLocalValidation {
  const flat = raw.replace(/-/g, '').toUpperCase().trim();
  const match = flat.match(/^([A-Z0-9]{3})(\d{7})(\d)$/);
  if (!match) return { valid: true };

  const [, filerCode, sequence, digit] = match;
  const expected = computeEntryCheckDigit(filerCode, sequence);
  if (Number(digit) !== expected) {
    return { valid: false, expectedCheckDigit: expected };
  }
  return { valid: true, canonical: `${filerCode}-${sequence}-${expected}` };
}
