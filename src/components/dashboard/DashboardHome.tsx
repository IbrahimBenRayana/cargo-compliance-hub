/**
 * The dashboard: what needs attention, how filing is going, and where everything
 * is (spec: docs/specs/dashboard-redesign.md). Stored state only, and it transmits
 * nothing: every action opens the page that does the work.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Plus } from 'lucide-react';
import { CelebrationModal } from '@/components/CelebrationModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCapabilities, useSubscription } from '@/hooks/useBilling';
import { useDashboard, useNow } from '@/hooks/useDashboard';
import { formatDuration } from '@/lib/countdown';
import { CAPABILITIES } from '@/lib/planMeta';
import type { DashboardResponse } from '@/types/dashboard';
import { ActivityChart } from './ActivityChart';
import { AttentionTable } from './AttentionTable';
import { BlockerBand } from './BlockerBand';
import { AwaitingPanel, CountPanel, CutoffPanel, StagePanel } from './SidePanels';
import { StatStrip } from './StatStrip';

const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const SPLIT = 'grid items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_296px]';

type Subscription = ReturnType<typeof useSubscription>['data'];

/** What this month has used so far, in the terms the account is billed. */
function usageLine(sub: Subscription): string | null {
  if (!sub) return null;
  const { invoicing, usage } = sub as unknown as {
    invoicing?: { includedIsfs: number | null; monthToDate: { isfs: number } } | null;
    usage?: { amountCents: number } | null;
  };
  if (invoicing) {
    const { isfs } = invoicing.monthToDate;
    return invoicing.includedIsfs ? `${isfs} of ${invoicing.includedIsfs} included ISFs used this month` : `${isfs} ISFs this month`;
  }
  return usage?.amountCents ? `$${(usage.amountCents / 100).toLocaleString()} billed this month` : null;
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading your dashboard" className={PAGE}>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-[106px] rounded-lg" />
      <div className={SPLIT}>
        <Skeleton className="h-[420px] rounded-lg" />
        <Skeleton className="h-[220px] rounded-lg" />
      </div>
    </div>
  );
}

function Header({ now, updatedAt, isStale, onRetry, canCreate, canEnter }: {
  now: number; updatedAt: number; isStale: boolean; onRetry: () => void; canCreate: boolean; canEnter: boolean;
}) {
  const date = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const ago = formatDuration(now - updatedAt);
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Today</h1>
        <p className="text-[13px] tabular-nums text-muted-foreground">
          {date}
          {isStale ? (
            <>. Could not refresh. <button type="button" onClick={onRetry} className="text-foreground underline underline-offset-2">Retry</button></>
          ) : (
            <>. Updated {ago === '<1m' ? 'just now' : `${ago} ago`}.</>
          )}
        </p>
      </div>
      {canCreate && (
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="max-sm:hidden"><Link to="/manifest-query">Manifest query</Link></Button>
          {canEnter && <Button asChild variant="outline" size="sm" className="max-sm:hidden"><Link to="/abi-documents/new">New entry</Link></Button>}
          <Button asChild size="sm"><Link to="/shipments/new"><Plus aria-hidden />New shipment</Link></Button>
        </div>
      )}
    </header>
  );
}

function Setup({ steps }: { steps: NonNullable<DashboardResponse['setup']> }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-[15px] font-semibold">Get set up to file</h2>
      <ul className="mt-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-baseline justify-between gap-3 border-t border-border/70 py-2 text-[13px] first:border-t-0">
            <span className={s.done ? 'text-muted-foreground line-through' : undefined}>{s.label}</span>
            {!s.done && s.href && <Link to={s.href} className="font-medium text-primary">Start</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DashboardHome() {
  const { data, isLoading, isError, isRefetchError, dataUpdatedAt, refetch } = useDashboard();
  const { data: user } = useCurrentUser();
  const { can } = useCapabilities();
  const canManage = user?.role === 'owner' || user?.role === 'admin';
  const { data: subscription } = useSubscription({ enabled: canManage });
  const now = useNow();

  const [searchParams, setSearchParams] = useSearchParams();
  const closeWelcome = () => setSearchParams((p) => { p.delete('welcome'); return p; });

  if (isLoading) return <Loading />;
  if (isError && !data) {
    return (
      <div className={PAGE}>
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <h1 className="text-[15px] font-semibold">We could not load your dashboard.</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Try again, or go straight to your shipments.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" onClick={() => refetch()}>Try again</Button>
            <Button size="sm" variant="outline" asChild><a href="/shipments">Shipments</a></Button>
          </div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const header = (
    <Header
      now={now}
      updatedAt={dataUpdatedAt}
      isStale={isRefetchError}
      onRetry={() => refetch()}
      canCreate={user?.role !== 'viewer'}
      canEnter={can(CAPABILITIES.ABI_ENTRY)}
    />
  );

  if (data.isEmpty) {
    return (
      <div className={PAGE}>
        <CelebrationModal planId={searchParams.get('welcome')} onClose={closeWelcome} />
        {header}
        <BlockerBand blockers={data.blockers} />
        {data.setup && <Setup steps={data.setup} />}
      </div>
    );
  }

  const { metrics } = data;
  return (
    <MotionConfig reducedMotion="user">
    <div className={PAGE}>
      <CelebrationModal planId={searchParams.get('welcome')} onClose={closeWelcome} />
      {header}
      <BlockerBand blockers={data.blockers} />
      <StatStrip data={data} now={now} />

      <div className={SPLIT}>
        <AttentionTable data={data} now={now} />
        <div className="grid gap-6">
          {data.horizon && <CutoffPanel horizon={data.horizon} />}
          <AwaitingPanel awaiting={data.awaiting} now={now} />
          <StagePanel flow={data.flow} />
        </div>
      </div>

      <div className={SPLIT}>
        <ActivityChart metrics={metrics} now={now} usage={canManage ? usageLine(subscription) : null} />
        <div className="grid gap-6">
          <CountPanel title="Top rejection reasons" aside={`${metrics.windowDays} days`} items={metrics.rejectionReasons.map((r) => ({ label: r.reason, count: r.count }))} />
          {/* A single importer has nothing to compare, so this is for brokers. */}
          {data.workload.length > 1 && <CountPanel title="Open items by importer" items={data.workload.map((w) => ({ label: w.name, count: w.count }))} />}
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
