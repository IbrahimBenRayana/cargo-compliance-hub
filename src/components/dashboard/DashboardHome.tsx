/**
 * The dashboard: what needs you, how the org is doing, and where everything is
 * (spec: docs/specs/dashboard-redesign.md). Stored state only, and it transmits
 * nothing: every action opens the page that does the work.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CelebrationModal } from '@/components/CelebrationModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCapabilities } from '@/hooks/useBilling';
import { useDashboard, useFilteredActions, useNow } from '@/hooks/useDashboard';
import { CAPABILITIES } from '@/lib/planMeta';
import { cn } from '@/lib/utils';
import type { ActionFilter } from '@/types/dashboard';
import { ActionQueue, Rows } from './ActionQueue';
import { BlockerBand } from './BlockerBand';
import { CommandPanel } from './CommandPanel';
import { FilterChips } from './FilterChips';
import { HealthCard } from './HealthCard';
import { KpiRow } from './KpiRow';
import { PipelineBand } from './PipelineBand';
import { AwaitingPanel, ReasonsPanel, RecentPanel, VolumePanel, WorkloadPanel } from './RailPanels';
import { Surface } from './Surface';

const PAGE = 'mx-auto flex max-w-[1500px] flex-col gap-3 -mx-2 sm:mx-auto pb-24 sm:pb-16';

/** The opening runs once a session: a page people return to all day should just be there. */
let opened = false;

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading your dashboard" className={PAGE}>
      <div className="grid gap-3 lg:grid-cols-12">
        <Skeleton className="h-[292px] rounded-[22px] lg:col-span-8" />
        <Skeleton className="h-[292px] rounded-[22px] lg:col-span-4" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-[22px]" />)}
      </div>
      <Skeleton className="h-[120px] rounded-[22px]" />
      <div className="grid gap-3 lg:grid-cols-12">
        <Skeleton className="h-[420px] rounded-[22px] lg:col-span-8" />
        <Skeleton className="h-[420px] rounded-[22px] lg:col-span-4" />
      </div>
    </div>
  );
}

export default function WorkQueuePage() {
  const { data, isLoading, isError, isRefetchError, dataUpdatedAt, refetch } = useDashboard();
  const { data: user } = useCurrentUser();
  const { can } = useCapabilities();
  const [filter, setFilter] = useState<ActionFilter>('all');
  const filtered = useFilteredActions(filter);
  const now = useNow();

  const [searchParams, setSearchParams] = useSearchParams();
  const closeWelcome = () => setSearchParams((p) => { p.delete('welcome'); return p; });

  const [entering] = useState(() => !opened);
  useEffect(() => {
    if (data) opened = true;
  }, [data]);

  if (isLoading) return <Loading />;
  if (isError && !data) {
    return (
      <div className={PAGE}>
        <Surface core="px-6 py-12 text-center">
          <h1 className="text-[17px] font-semibold">We could not load your dashboard.</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Try again, or go straight to your shipments.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => refetch()}>Try again</Button>
            <Button variant="outline" asChild><a href="/shipments">Shipments</a></Button>
          </div>
        </Surface>
      </div>
    );
  }
  if (!data) return null;

  const { metrics } = data;
  return (
    <div className={cn(PAGE, entering && 'enter')}>
      <CelebrationModal planId={searchParams.get('welcome')} onClose={closeWelcome} />
      <BlockerBand blockers={data.blockers} />

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <CommandPanel
            attention={data.attention}
            horizon={data.horizon}
            updatedAt={dataUpdatedAt}
            isStale={isRefetchError}
            now={now}
            canCreate={user?.role !== 'viewer'}
            canEnter={can(CAPABILITIES.ABI_ENTRY)}
            onRetry={() => refetch()}
          />
        </div>
        <div className="min-w-0 lg:col-span-4"><HealthCard metrics={metrics} index={1} /></div>
      </div>

      <KpiRow metrics={metrics} now={now} start={2} />
      <PipelineBand flow={data.flow} index={6} />

      <div className="grid items-start gap-3 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-8">
          <FilterChips filters={data.filters} active={filter} onChange={setFilter} />
          <Surface index={7}>
            {filter === 'all'
              ? <ActionQueue lanes={data.lanes} now={now} />
              : <Rows items={filtered.data?.items ?? []} firstIsCurrent now={now} />}
          </Surface>
        </div>
        <aside aria-label="Activity" className="grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          <AwaitingPanel awaiting={data.awaiting} now={now} index={8} />
          <VolumePanel metrics={metrics} now={now} index={9} />
          <WorkloadPanel workload={data.workload} index={10} />
          <ReasonsPanel reasons={metrics.rejectionReasons} days={metrics.windowDays} index={11} />
          <RecentPanel recent={data.recent} now={now} index={12} />
        </aside>
      </div>
    </div>
  );
}
