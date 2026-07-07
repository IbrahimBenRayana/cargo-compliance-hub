import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, setAccessToken, clearTokens } from '../api/client';
import { create } from 'zustand';
import type { MfaMethod, User } from '../types/auth';
import { isMfaChallenge } from '../types/auth';

// ─── Auth Store (Zustand) ─────────────────────────────────
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  logout: () => {
    clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));

// ─── Hooks ────────────────────────────────────────────────
export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      // When the account has MFA, login returns an MfaChallenge with no
      // session — do NOT establish an authenticated session here. The
      // LoginPage inspects the result and drives the challenge step; the
      // real session lands via useMfaVerify().
      if (isMfaChallenge(data)) return;
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
  });
}

/**
 * Second step of MFA login: exchange the challenge mfaToken + a code for a
 * real session. On success it establishes the session exactly like login.
 */
export function useMfaVerify() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: ({ mfaToken, method, code }: { mfaToken: string; method: MfaMethod; code: string }) =>
      authApi.mfaVerify(mfaToken, method, code),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
  });
}

export function useRegister() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (data: { email: string; password: string; firstName: string; lastName: string; companyName?: string; inviteToken?: string }) =>
      authApi.register(data),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: logout,
    onError: logout, // Logout locally even if API fails
  });
}

export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const user = await authApi.me();
        setUser(user);
        return user;
      } catch (err: any) {
        // Audit Phase 11.2: pre-fix any /auth/me failure (transient 5xx,
        // network blip, CORS hiccup) cleared the user and triggered a
        // bounce to /login — indistinguishable from a real session
        // expiry. Now we only clear on the genuinely auth-related codes;
        // anything else (5xx, network, undefined status) leaves the
        // cached user in place so the next render keeps showing the app.
        const status = err?.status;
        const isAuthFailure = status === 401 || status === 403;
        if (isAuthFailure) {
          setUser(null);
          return null;
        }
        // Re-throw so React Query knows the query failed and the caller
        // can show a transient-error banner if they care — but importantly
        // the user/auth state is unchanged.
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
