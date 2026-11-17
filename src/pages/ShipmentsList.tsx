/**
 * Route `/shipments`. Serves the redesigned list or the classic page, decided
 * per user by the server's SHIPMENTS_V2 setting. Each lives in its own chunk.
 */
import { Suspense } from 'react';
import { useCurrentUser } from '@/hooks/useAuth';
import { ShipmentsSkeleton } from '@/components/shipments/ShipmentsSkeleton';
import { PageLoading } from '@/components/PageLoading';
import { lazyPage } from '@/lib/lazyPage';

const Classic = lazyPage(() => import('./ShipmentsListClassic'), 'default');
const Home = lazyPage(() => import('@/components/shipments/ShipmentsHome'), 'default');

export default function ShipmentsList() {
  const { data: user } = useCurrentUser();
  const v2 = user?.features?.shipmentsV2;
  return (
    <Suspense fallback={v2 ? <ShipmentsSkeleton /> : <PageLoading />}>
      {v2 ? <Home /> : <Classic />}
    </Suspense>
  );
}
