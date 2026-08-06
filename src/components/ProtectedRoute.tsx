import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, useCurrentUser } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  // Always try to fetch the current user. Phase 6 moved the refresh token
  // out of localStorage and into an httpOnly cookie, so the FE has no
  // JS-readable signal for "credentials present"; we just attempt /me
  // and let apiFetch auto-refresh via the cookie if one is set.
  const { isLoading: isUserLoading } = useCurrentUser();

  // Show loading while the first /me round-trip is in flight (covers the
  // implicit /auth/refresh that fires on /me's 401).
  if (isLoading || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Once useCurrentUser resolves, isAuthenticated reflects the real auth
  // state — no cookie / no valid refresh ⇒ redirect.
  if (!isAuthenticated) {
    const intended = location.pathname + location.search;
    const loginUrl = intended && intended !== '/'
      ? `/login?redirect=${encodeURIComponent(intended)}`
      : '/login';
    return <Navigate to={loginUrl} replace />;
  }

  // Email verification gate — sits BEFORE the onboarding redirect so a new
  // signup verifies first, then sets up their company. We whitelist
  // /verify-email itself so the user can actually reach the page; we also
  // whitelist /logout-adjacent paths implicitly (login is unauthenticated,
  // so it's already past). The server-side requireVerifiedEmail middleware
  // is the load-bearing gate — this is just UX so the user doesn't see
  // 403s mid-flow.
  if (
    user && user.emailVerified === false &&
    location.pathname !== '/verify-email'
  ) {
    const intended = location.pathname + location.search;
    const verifyUrl = intended && intended !== '/'
      ? `/verify-email?redirect=${encodeURIComponent(intended)}`
      : '/verify-email';
    return <Navigate to={verifyUrl} replace />;
  }

  // MFA-enrollment gate — sits AFTER the email-verify gate. When the org
  // enforces MFA and the user hasn't enrolled (mfaSetupRequired), force them
  // to /mfa-setup, which we whitelist so they can actually reach it. The
  // server-side requireMfaEnrolled middleware is the load-bearing gate; this
  // is UX so the user doesn't hit raw 403s mid-flow.
  //
  // /verify-email must ALSO be whitelisted here: an invited user starts with
  // emailVerified=false AND mfaSetupRequired=true, and without it this gate
  // hijacks /verify-email → /mfa-setup while the email gate above bounces
  // /mfa-setup → /verify-email — an infinite <Navigate> loop that renders a
  // blank page and locks every new invitee out. Email verification runs
  // first; this gate catches them right after.
  if (
    user && user.mfaSetupRequired === true &&
    location.pathname !== '/mfa-setup' &&
    location.pathname !== '/verify-email'
  ) {
    return <Navigate to="/mfa-setup" replace />;
  }

  // If onboarding not completed and not already on onboarding page, redirect.
  // Also let /verify-email through so unverified-with-incomplete-onboarding
  // users hit the verify gate first (handled above) and aren't bounced here.
  // /mfa-setup is whitelisted for the same reason as /verify-email: the MFA
  // gate above outranks onboarding, so without it a must-enroll user in a
  // not-yet-onboarded org loops /mfa-setup ⇄ /onboarding (blank page).
  if (
    user?.organization &&
    user.organization.onboardingCompleted === false &&
    location.pathname !== '/onboarding' &&
    location.pathname !== '/verify-email' &&
    location.pathname !== '/mfa-setup'
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
