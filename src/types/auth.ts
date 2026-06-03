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
  emailVerified?: boolean;
  organization: UserOrganizationSummary;
}

/** Trimmed user shape returned by /auth/login + /auth/register (no emailVerified). */
export type AuthUser = Omit<User, 'emailVerified'>;

/** Auth response from login / register. */
export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}
