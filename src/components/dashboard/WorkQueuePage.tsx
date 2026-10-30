/**
 * The dashboard as a work queue: what needs you, in order, and how long you have
 * (spec: docs/specs/dashboard-redesign.md). Stored state only, and it transmits
 * nothing: every action opens the page that does the work.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CelebrationModal } from '@/components/CelebrationModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useAuth';
import { useDashboard, useFilteredActions, useNow } from '@/hooks/useDashboard';
import type { ActionFilter } from '@/types/dashboard';
import { ActionQueue, Rows } from './ActionQueue';
import { DashboardHeadline } from './DashboardHeadline';
import { FilterChips } from './FilterChips';

const PAGE = 'mx-auto flex max-w-[1500px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-16';

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading your work" className={PAGE}>
      <div className="space-y-2">
        <Skeleton className="h-[34px] w-3/5" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="m-3 h-10 rounded-md" />)}
      </div>
    </div>
  );
}

export default function WorkQueuePage() {
  const { data, isLoading, isError, isRefetchError, dataUpdatedAt, refetch } = useDashboard();
  const { data: user } = useCurrentUser();
  const [filter, setFilter] = useState<ActionFilter>('all');
  const filtered = useFilteredActions(filter);
  const now = useNow();

  const [searchParams, setSearchParams] = useSearchParams();
  const closeWelcome = () => setSearchParams((p) => { p.delete('welcome'); return p; });

  if (isLoading) return <Loading />;
  if (isError && !data) {
    return (
      <div className={PAGE}>
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <h1 className="text-[17px] font-semibold">We could not load your work.</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Try again, or go straight to your shipments.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => refetch()}>Try again</Button>
            <Button variant="outline" asChild><a href="/shipments">Shipments</a></Button>
          </div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className={PAGE}>
      <CelebrationModal planId={searchParams.get('welcome')} onClose={closeWelcome} />
      <DashboardHeadline
        attention={data.attention}
        updatedAt={dataUpdatedAt}
        isStale={isRefetchError}
        now={now}
        canCreate={user?.role !== 'viewer'}
        onRetry={() => refetch()}
      />
      <FilterChips filters={data.filters} active={filter} onChange={setFilter} />
      {filter === 'all' ? (
        <ActionQueue lanes={data.lanes} now={now} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Rows items={filtered.data?.items ?? []} firstIsCurrent now={now} />
        </div>
      )}
    </div>
  );
}
