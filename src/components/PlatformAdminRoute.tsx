import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, useCurrentUser } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

/**
 * Route guard for the platform-admin area. Renders the nested routes only when
 * the current user is a MyCargoLens platform admin.
 *
 * Mirrors ProtectedRoute's loading + auth handling: we always attempt the /me
 * round-trip (cookie-based refresh) and show the same loading treatment until
 * it resolves, then gate on `isPlatformAdmin`.
 */
export function PlatformAdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // Always try to fetch the current user; apiFetch auto-refreshes via the
  // httpOnly cookie if one is present.
  const { isLoading: isUserLoading } = useCurrentUser();

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

  // Not authenticated at all → send to login.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but not a platform admin → bounce to the dashboard.
  if (!user?.isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
