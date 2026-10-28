/**
 * In-bond number check-digit computation — MOD-7, per the CATAIR In-Bond
 * chapter (Amendment 51, April 2026), WP10 Note 2 / NS10 Note 2
 * (INB-56 / INB-62..63): a conventional 9-digit in-bond control number
 * "must have a valid MOD-7 check digit as the final digit of the number".
 * The MOD-7 digit is the remainder of the leading 8-digit number divided
 * by 7 (0-6).
 *
 * High-volume-air variant (WP10 Note 2, INB-56): certain air trade
 * entities identified by CBP as high-volume in-bond number users are
 * permitted check digits of MOD-7 "plus one, two or three" (making 7-9
 * possible final digits). We ACCEPT that variant when validating numbers
 * we did not assign (isAcceptableInbondNumber, used on the WP event
 * side), but we NEVER GENERATE it — formatInbondNumber and the QP
 * builder always require/produce the plain MOD-7 digit.
 */

/**
 * Compute the MOD-7 check digit for the leading 8-digit sequence of a
 * conventional 9-digit in-bond number. Throws on malformed input —
 * certification requires our software to refuse to build an invalid
 * in-bond number.
 */
export function computeInbondCheckDigit(sequence8: string): number {
  if (!/^[0-9]{8}$/.test(sequence8)) {
    throw new Error(`in-bond number sequence must be 8 digits, got '${sequence8}'`);
  }
  return Number(sequence8) % 7;
}

/**
 * Return the full conventional 9-digit in-bond number. Given 8 digits,
 * appends the computed MOD-7 check digit; given 9 digits, validates the
 * embedded digit (strict — the high-volume-air +1/+2/+3 variant is
 * rejected here because we never generate it).
 */
export function formatInbondNumber(sequence: string): string {
  if (/^[0-9]{9}$/.test(sequence)) {
    const expected = computeInbondCheckDigit(sequence.slice(0, 8));
    if (Number(sequence[8]) !== expected) {
      throw new Error(
        `in-bond number '${sequence}' has check digit ${sequence[8]}, expected ${expected} (MOD-7)`,
      );
    }
    return sequence;
  }
  return sequence + String(computeInbondCheckDigit(sequence));
}

/**
 * True when a 9-digit in-bond number carries an acceptable check digit on
 * the receiving/event side: the plain MOD-7 remainder, or the
 * high-volume-air remainder +1/+2/+3 (WP10 Note 2). Non-9-digit input is
 * not acceptable in the conventional format.
 */
export function isAcceptableInbondNumber(value: string): boolean {
  if (!/^[0-9]{9}$/.test(value)) return false;
  const remainder = computeInbondCheckDigit(value.slice(0, 8));
  const digit = Number(value[8]);
  return digit >= remainder && digit <= remainder + 3;
}
