/**
 * Lightweight, dependency-free password-strength estimator.
 *
 * Deliberately length-first and composition-light, per NIST 800-63B: length is
 * the dominant driver of strength, and rigid "must contain upper/lower/number/
 * symbol" rules are discouraged (they push users toward predictable patterns
 * like "Password1!"). We reward length, give a small bonus for character
 * variety, and penalise the obvious weak cases (too short, all one character,
 * or a well-known common password). This is guidance shown to the user — the
 * server is the source of truth for the hard minimum.
 */

export type PasswordStrength = {
  /** 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong */
  score: 0 | 1 | 2 | 3 | 4;
  label: '' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** 0–100, for the strength bar width */
  percent: number;
};

// A tiny blocklist of the passwords that dominate breach corpora, plus a couple
// of app-specific ones. Not exhaustive — the point is to never call an obvious
// choice "Strong". A real blocklist lives server-side if we ever add one.
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty', 'qwertyui', 'letmein', '11111111', 'iloveyou', 'admin123',
  'welcome1', 'welcome123', 'changeme', 'monkey123', 'abc12345', 'mycargolens',
]);

const LABELS: PasswordStrength['label'][] = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export function estimatePasswordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: '', percent: 0 };

  const len = pw.length;
  let score = 0;

  // Length is the main lever.
  if (len >= 8) score += 1;
  if (len >= 12) score += 1;
  if (len >= 16) score += 1;

  // One bonus point for genuine variety (3+ character classes), but only once
  // the password has some length behind it.
  const classes =
    [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes >= 3 && len >= 8) score += 1;

  // Penalties clamp the score down — a weak choice can't score its way up on
  // length alone.
  if (len < 8) score = Math.min(score, 1);
  if (/^(.)\1+$/.test(pw)) score = 1; // all one repeated character
  if (COMMON.has(pw.toLowerCase())) score = Math.min(score, 1);

  const clamped = Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
  return { score: clamped, label: LABELS[clamped], percent: clamped * 25 };
}
