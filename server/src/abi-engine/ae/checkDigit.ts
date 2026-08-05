/**
 * Entry number check-digit computation — AE Table 1 (Entry Summary
 * Create/Update, July 2026, ESF-213). The 10-char base is the 3-char filer
 * code followed by the 7-digit filer-assigned sequence; the result is the
 * 8th character of the Entry Number.
 */

/** Alpha→numeric conversion table from Step ONE of AE Table 1. */
const ALPHA_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

/**
 * Compute the entry-number check digit for a filer code + 7-digit sequence.
 * Throws on malformed input — certification requires our software to refuse
 * to build an invalid entry number.
 */
export function computeEntryCheckDigit(filerCode: string, sequence7: string): number {
  const filer = filerCode.toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(filer)) {
    throw new Error(`entry filer code must be 3 alphanumeric chars, got '${filerCode}'`);
  }
  if (!/^[0-9]{7}$/.test(sequence7)) {
    throw new Error(`entry number sequence must be 7 digits, got '${sequence7}'`);
  }

  const base = (filer + sequence7)
    .split('')
    .map((ch) => (ch >= '0' && ch <= '9' ? Number(ch) : ALPHA_VALUES[ch]));

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = base[i];
    if ((i + 1) % 2 === 0) {
      // Even positions ×2; products over 9 get +1, then only the ones digit counts.
      let product = digit * 2;
      if (product > 9) product += 1;
      sum += product % 10;
    } else {
      sum += digit;
    }
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Return the full 8-char entry number for a filer code + sequence, appending
 * the computed check digit. If given 8 chars, validates the embedded digit.
 */
export function formatEntryNumber(filerCode: string, sequence: string): string {
  if (/^[0-9]{8}$/.test(sequence)) {
    const expected = computeEntryCheckDigit(filerCode, sequence.slice(0, 7));
    if (Number(sequence[7]) !== expected) {
      throw new Error(
        `entry number '${sequence}' has check digit ${sequence[7]}, expected ${expected} for filer ${filerCode}`
      );
    }
    return sequence;
  }
  return sequence + String(computeEntryCheckDigit(filerCode, sequence));
}
