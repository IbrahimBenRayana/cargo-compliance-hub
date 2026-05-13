import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, useCurrentUser } from '@/hooks/useAuth';
import { getAccessToken } from '@/api/client';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const refreshToken = localStorage.getItem('mcl_refresh');
  const location = useLocation();
  
  // If we have a refresh token, try to fetch the current user
  const { isLoading: isUserLoading } = useCurrentUser();

  // Show loading while checking auth
  if ((isLoading || isUserLoading) && refreshToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and no refresh token, redirect to login
  // Preserve the intended destination so user returns after auth
  if (!isAuthenticated && !refreshToken) {
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

  // If onboarding not completed and not already on onboarding page, redirect.
  // Also let /verify-email through so unverified-with-incomplete-onboarding
  // users hit the verify gate first (handled above) and aren't bounced here.
  if (
    user?.organization &&
    user.organization.onboardingCompleted === false &&
    location.pathname !== '/onboarding' &&
    location.pathname !== '/verify-email'
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
