/**
 * Auth-related types shared between the zustand store, useAuth hooks,
 * and the api/client.ts authApi namespace.
 */

export type UserRole = 'owner' | 'admin' | 'operator' | 'viewer';

export interface UserOrganizationSummary {
  id: string;
  name: string;
  iorNumber?: string | null;
  ccEnvironment?: string | null;
  onboardingCompleted: boolean;
}

/** Full user shape returned by /auth/me. */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  /** Platform-level staff (MyCargoLens) — gates the /admin provisioning area. */
  isPlatformAdmin?: boolean;
  emailVerified?: boolean;
  /** Whether the user has an active authenticator (TOTP) second factor. */
  mfaEnabled?: boolean;
  /** True when the org enforces MFA and the user hasn't enrolled yet — hard gate. */
  mfaSetupRequired?: boolean;
  organization: UserOrganizationSummary;
}

/** Trimmed user shape returned by /auth/login + /auth/register (no emailVerified). */
export type AuthUser = Omit<User, 'emailVerified'>;

/** Auth response from login / register. */
export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

/** Available second-factor methods a user can present at the challenge step. */
export type MfaMethod = 'totp' | 'recovery' | 'email';

/**
 * Login MFA challenge — returned by POST /auth/login (in place of AuthSession)
 * when the account has MFA enabled. The mfaToken is a short-lived (5-min) JWT
 * that ONLY /auth/mfa/* accept; held in component state, never persisted.
 */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
  methods: MfaMethod[];
}

/** Discriminates the two possible /auth/login outcomes. */
export type LoginResult = AuthSession | MfaChallenge;

export function isMfaChallenge(r: LoginResult): r is MfaChallenge {
  return (r as MfaChallenge).mfaRequired === true;
}
