/**
 * Route `/`. Serves the new dashboard or the classic page, decided per user by the
 * server's DASHBOARD_V2 setting. Each lives in its own chunk.
 */
import { Suspense } from 'react';
import { useCurrentUser } from '@/hooks/useAuth';
import { PageLoading } from '@/components/PageLoading';
import { lazyPage } from '@/lib/lazyPage';

const Classic = lazyPage(() => import('./DashboardClassic'), 'default');
const Home = lazyPage(() => import('@/components/dashboard/DashboardHome'), 'default');

export default function Dashboard() {
  const { data: user } = useCurrentUser();
  return (
    <Suspense fallback={<PageLoading />}>
      {user?.features?.dashboardV2 ? <Home /> : <Classic />}
    </Suspense>
  );
}
