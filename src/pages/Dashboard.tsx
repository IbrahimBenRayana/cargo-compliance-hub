/**
 * Route `/`. Serves the work queue or the classic page, decided per user by the
 * server's DASHBOARD_V2 setting. Each lives in its own chunk.
 */
import { Suspense } from 'react';
import { useCurrentUser } from '@/hooks/useAuth';
import { PageLoading } from '@/components/PageLoading';
import { lazyPage } from '@/lib/lazyPage';

const Classic = lazyPage(() => import('./DashboardClassic'), 'default');
const WorkQueue = lazyPage(() => import('@/components/dashboard/WorkQueuePage'), 'default');

export default function Dashboard() {
  const { data: user } = useCurrentUser();
  return (
    <Suspense fallback={<PageLoading />}>
      {user?.features?.dashboardV2 ? <WorkQueue /> : <Classic />}
    </Suspense>
  );
}
