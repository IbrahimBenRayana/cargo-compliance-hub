/**
 * The Shipments page in the dashboard's language: every ISF, paged and counted
 * on the server, with the cutoffs that still matter in colour.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AlertTriangle, Plus, Search, Ship } from 'lucide-react';
import { toast } from 'sonner';
import { FilterTabs } from '@/components/dashboard/FilterTabs';
import { Pagination } from '@/components/dashboard/Pagination';
import { TINT } from '@/components/dashboard/tones';
import { PlanLimitModal } from '@/components/PlanLimitModal';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useAuth';
import { useNow } from '@/hooks/useDashboard';
import { useBulkDelete, useBulkSubmit, useFilingFacets, useFilingsPage } from '@/hooks/useFilings';
import type { Capability } from '@/lib/planMeta';
import { cn } from '@/lib/utils';
import { ExportMenu, TemplateMenu } from './ShipmentsActions';
import { ShipmentsSkeleton } from './ShipmentsSkeleton';
import { ShipmentsTable } from './ShipmentsTable';
import { FiltersBar, SelectionBar } from './ShipmentsToolbar';
import { tabsWithCounts } from './status';
import { facetQuery, hasFilters, listQuery, PAGE_SIZE, useListState, type Sort } from './useListState';
import { useSend } from './useSend';

const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const CARD = 'relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';

function Notice({ icon: Icon, tone, title, children }: { icon: typeof Ship; tone: 'info' | 'urgent' | 'calm'; title: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-14 text-center">
      <span className={cn('mx-auto grid h-10 w-10 place-items-center rounded-xl', TINT[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-[13px] font-medium">{title}</p>
      {children}
    </div>
  );
}

export default function ShipmentsHome() {
  const { state, update, clearFilters } = useListState();
  const list = useFilingsPage(listQuery(state));
  const facets = useFilingFacets(facetQuery(state));
  const { data: user } = useCurrentUser();
  const canWrite = user?.role !== 'viewer';
  const now = useNow();
  const [planPrompt, setPlanPrompt] = useState<{ capability?: Capability } | null>(null);
  const { send, sendingId } = useSend(setPlanPrompt);
  const bulkSubmit = useBulkSubmit();
  const bulkDelete = useBulkDelete();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const listTop = useRef<HTMLElement>(null);
  const viewKey = JSON.stringify(listQuery(state));
  useEffect(() => setSelected(new Set()), [viewKey]);

  const rows = list.data?.data ?? [];
  const pageCount = list.data?.pagination.totalPages ?? 1;
  const total = list.data?.pagination.total ?? 0;
  const busy = list.isFetching && list.isPlaceholderData;

  // Sending or deleting can empty the last page; step back to the one that is left.
  useEffect(() => {
    if (!list.isFetching && list.data && state.page > Math.max(1, pageCount)) update({ page: Math.max(1, pageCount) });
  }, [list.isFetching, list.data, pageCount, state.page]); // eslint-disable-line react-hooks/exhaustive-deps

  if (list.isLoading) return <ShipmentsSkeleton />;

  const tabs = tabsWithCounts(facets.data?.status);
  const all = tabs[0].count;
  const toSend = tabs.find((t) => t.key === 'draft')!.count + tabs.find((t) => t.key === 'rejected')!.count;
  const filtered = hasFilters(state);
  const pickedRows = rows.filter((r) => selected.has(r.id));
  const draftIds = pickedRows.filter((r) => r.status === 'draft').map((r) => r.id);

  const onSort = (field: Sort) =>
    update(field === state.sort ? { dir: state.dir === 'asc' ? 'desc' : 'asc' } : { sort: field, dir: field === 'createdAt' ? 'desc' : 'asc' });
  const onSelect = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const sendDrafts = async () => {
    try {
      const r = await bulkSubmit.mutateAsync(draftIds);
      setSelected(new Set());
      if (r.submitted > 0) toast.success(`${r.submitted} sent to CBP${r.failed > 0 ? `, ${r.failed} not sent` : ''}.`);
      else toast.error(`None of the ${r.failed} were sent.`);
    } catch {
      toast.error('The drafts were not sent.');
    }
  };
  const deleteDrafts = async () => {
    try {
      const r = await bulkDelete.mutateAsync(draftIds);
      setSelected(new Set());
      toast.success(`${r.deleted} ${r.deleted === 1 ? 'draft' : 'drafts'} deleted.`);
    } catch {
      toast.error('The drafts were not deleted.');
    }
  };

  // The work waiting is the part of this line worth colour.
  const summary = facets.data ? (
    <>
      {all.toLocaleString()} {all === 1 ? 'ISF' : 'ISFs'}{filtered ? ' match your filters' : ''}
      {toSend > 0 && <>, <span className="font-medium text-soon">{toSend.toLocaleString()} to send or fix</span></>}.
    </>
  ) : '\u00a0';

  let body: React.ReactNode;
  if (list.isError && !list.data) {
    body = (
      <Notice icon={AlertTriangle} tone="urgent" title="We could not load your shipments.">
        <Button size="sm" className="mt-4" onClick={() => list.refetch()}>Try again</Button>
      </Notice>
    );
  } else if (total === 0 && !filtered && state.tab === 'all') {
    body = (
      <Notice icon={Ship} tone="info" title="No shipments yet.">
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">Each ISF you start shows here with its cutoff and where it stands with CBP.</p>
        {canWrite && <Button size="sm" className="mt-4" asChild><Link to="/shipments/new"><Plus aria-hidden />New shipment</Link></Button>}
      </Notice>
    );
  } else if (total === 0) {
    body = (
      <Notice icon={Search} tone="calm" title={filtered ? 'No shipments match these filters.' : 'No shipments here.'}>
        {filtered && <Button size="sm" variant="outline" className="mt-4" onClick={clearFilters}>Clear filters</Button>}
      </Notice>
    );
  } else {
    body = (
      <>
        <div className={cn('transition-opacity duration-150', busy && 'opacity-60')}>
          <ShipmentsTable
            key={viewKey}
            rows={rows}
            now={now}
            sort={state.sort}
            dir={state.dir}
            onSort={onSort}
            canWrite={canWrite}
            selected={selected}
            onSelect={onSelect}
            sendingId={sendingId}
            onSend={send}
          />
        </div>
        <Pagination page={state.page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onChange={(page) => {
            update({ page });
            // Pages are long; a new one starts at its first row, not where the last one ended.
            if ((listTop.current?.getBoundingClientRect().top ?? 0) < 0) listTop.current?.scrollIntoView({ block: 'start' });
          }} label="Shipment pages" layoutId="shipments-page" />
      </>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={PAGE}>
        <PlanLimitModal open={planPrompt !== null} onClose={() => setPlanPrompt(null)} capability={planPrompt?.capability} />
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Shipments</h1>
            <p className="text-[13px] tabular-nums text-muted-foreground">
              {summary}
              {list.isRefetchError && <> Could not refresh. <button type="button" onClick={() => list.refetch()} className="text-foreground underline underline-offset-2">Retry</button></>}
            </p>
          </div>
          <div className="flex gap-2">
            <ExportMenu />
            {canWrite && <TemplateMenu />}
            {canWrite && <Button asChild size="sm"><Link to="/shipments/new"><Plus aria-hidden />New shipment</Link></Button>}
          </div>
        </header>

        <section ref={listTop} aria-label="Shipments" className={cn(CARD, 'scroll-mt-4')}>
          <div className="border-b border-border pt-3">
            <FilterTabs items={tabs} active={state.tab} onChange={(tab) => update({ tab })} layoutId="shipments-tab" />
          </div>
          {selected.size > 0 ? (
            <SelectionBar
              count={pickedRows.length}
              drafts={draftIds.length}
              sending={bulkSubmit.isPending}
              deleting={bulkDelete.isPending}
              onSend={sendDrafts}
              onDelete={deleteDrafts}
              onClear={() => setSelected(new Set())}
            />
          ) : (
            <FiltersBar state={state} update={update} clearFilters={clearFilters} origins={facets.data?.origins ?? []} />
          )}
          {busy && <div className="dash-progress" role="progressbar" aria-label="Loading shipments" />}
          {body}
        </section>
      </div>
    </MotionConfig>
  );
}
