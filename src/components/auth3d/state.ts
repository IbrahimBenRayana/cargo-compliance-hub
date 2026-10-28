// Live form state the auth scenes react to. The pages own the values; the
// scene reads the latest snapshot every frame and eases toward it.

export type AuthPhase = 'idle' | 'checking' | 'mfa' | 'success' | 'error';

/** Sign in: "Clear the gate". */
export interface GateState {
  kind: 'gate';
  /** typed email; the scene prints only its domain on the container tag */
  email: string;
  /** the password field has something in it */
  hasPassword: boolean;
  phase: AuthPhase;
  /** digits typed in the MFA code (0-6) */
  codeLength: number;
  /** bump on every failed attempt so repeated errors re-trigger the flash */
  errorCount: number;
}

/** Invite sign-up and set-password: "Your berth is ready". */
export interface BerthState {
  kind: 'berth';
  /** stencilled on the gold container: the invited org, or the email domain */
  org: string;
  /** typed full name, shown on the crew card */
  name: string;
  /** role from the invitation, e.g. "Operator" */
  role: string;
  /** completed fields so far, and how many there are (each loads a box) */
  filled: number;
  total: number;
  /** password strength 0..1 */
  strength: number;
  phase: AuthPhase;
  errorCount: number;
}

export type AuthSceneState = GateState | BerthState;

/** The domain part of an email ("ops@seagold.com" -> "seagold.com"). */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).trim().toLowerCase() : '';
}

/** Rough strength for the gauge only (the server enforces the real rules). */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let s = Math.min(pw.length, 16) / 16;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 0.15;
  if (/\d/.test(pw)) s += 0.1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 0.15;
  return Math.min(1, s);
}
