import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowRight, CalendarX, CheckCircle2, Clock, FilePen, FilePlus2, Hourglass, Lock, PauseCircle, XCircle } from 'lucide-react';
import { dashboardApi } from '@/api/client';
import { useActionsPage } from '@/hooks/useDashboard';
import { cn } from '@/lib/utils';
import type { ActionFilter, ActionItem, ActionKind, DashboardResponse, Lane } from '@/types/dashboard';
import { BADGE, CutoffBadge } from './CutoffBadge';
import { FilterTabs } from './FilterTabs';
import { Pagination } from './Pagination';
import { FILL, TINT, type Tone } from './tones';

const PAGE_SIZE = 10;
const COLUMNS = 5;

const LANE: Record<Lane, { name: string; tone: Tone }> = {
  now: { name: 'Now', tone: 'urgent' },
  soon: { name: 'Soon', tone: 'soon' },
  later: { name: 'Later', tone: 'calm' },
};

const KIND: Record<ActionKind, { icon: LucideIcon; tone: Tone }> = {
  isf_overdue: { icon: AlertTriangle, tone: 'urgent' },
  isf_due: { icon: Clock, tone: 'soon' },
  isf_rejected: { icon: XCircle, tone: 'urgent' },
  isf_change_rejected: { icon: XCircle, tone: 'urgent' },
  entry_rejected: { icon: XCircle, tone: 'urgent' },
  entry_change_rejected: { icon: XCircle, tone: 'urgent' },
  entry_release_rejected: { icon: XCircle, tone: 'urgent' },
  isf_no_date: { icon: CalendarX, tone: 'soon' },
  isf_on_hold: { icon: PauseCircle, tone: 'soon' },
  isf_draft: { icon: FilePen, tone: 'calm' },
  entry_draft: { icon: FilePen, tone: 'entry' },
  entry_needed: { icon: FilePlus2, tone: 'entry' },
  cbp_no_response: { icon: Hourglass, tone: 'info' },
  cbp_outcome_unknown: { icon: Hourglass, tone: 'info' },
  cbp_conditional: { icon: Hourglass, tone: 'info' },
  tracking_hold: { icon: Lock, tone: 'soon' },
};

const STATE: Partial<Record<ActionKind, { text: string; tone: Tone }>> = {
  isf_rejected: { text: 'Rejected', tone: 'urgent' },
  entry_rejected: { text: 'Rejected', tone: 'urgent' },
  isf_change_rejected: { text: 'Rejected', tone: 'urgent' },
  entry_change_rejected: { text: 'Rejected', tone: 'urgent' },
  entry_release_rejected: { text: 'Rejected', tone: 'urgent' },
  isf_no_date: { text: 'No date', tone: 'soon' },
  isf_on_hold: { text: 'On hold', tone: 'soon' },
  tracking_hold: { text: 'Hold', tone: 'soon' },
  cbp_no_response: { text: 'No response', tone: 'info' },
  cbp_outcome_unknown: { text: 'Unknown', tone: 'info' },
  cbp_conditional: { text: 'Review', tone: 'info' },
};


function Due({ item, now }: { item: ActionItem; now: number }) {
  if (item.due) return <CutoffBadge at={item.due.at} basis={item.due.basis} now={now} />;
  const state = STATE[item.kind];
  return state ? <span className={cn(BADGE, TINT[state.tone])}>{state.text}</span> : null;
}

const ROW = 'group relative border-t border-border/60 transition-colors duration-150 can-hover:hover:bg-muted/40';
const TITLE = 'line-clamp-2 font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring';
const REF = 'font-mono text-[12.5px]';

function Lead({ item, children }: { item: ActionItem; children: React.ReactNode }) {
  const { icon: Icon, tone } = KIND[item.kind];
  return (
    <td className="w-full max-w-0 py-2 pl-4 pr-3">
      <span aria-hidden className={cn('dash-accent absolute inset-y-0 left-0 w-0.5 origin-center', FILL[tone])} />
      <div className="flex items-center gap-3">
        <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', TINT[tone])}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {children}
          <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground sm:hidden">
            <span className={REF}>{item.ref}</span>
            {item.party && <>, {item.party}</>}
          </span>
        </div>
      </div>
    </td>
  );
}

function Cells({ item, now, action }: { item: ActionItem; now: number; action: string }) {
  return (
    <>
      <td className="hidden whitespace-nowrap px-3 py-2 sm:table-cell"><span className={REF}>{item.ref}</span></td>
      <td className="hidden max-w-[170px] truncate px-3 py-2 text-muted-foreground min-[1360px]:table-cell" title={item.party ?? undefined}>{item.party}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right"><Due item={item} now={now} /></td>
      <td className="hidden whitespace-nowrap py-2 pl-3 pr-4 text-right sm:table-cell">
        <span className="inline-flex items-center gap-1 text-muted-foreground transition-colors duration-150 can-hover:group-hover:text-primary">
          {action}
          <ArrowRight aria-hidden className="h-3.5 w-3.5 opacity-0 transition duration-150 ease-out can-hover:-translate-x-1 can-hover:group-hover:translate-x-0 can-hover:group-hover:opacity-100" />
        </span>
      </td>
    </>
  );
}

function ActionRow({ item, now, index }: { item: ActionItem; now: number; index: number }) {
  return (
    <tr className={cn(ROW, 'dash-row')} style={{ '--i': index } as React.CSSProperties}>
      <Lead item={item}>
        <Link to={item.primary.href} aria-label={`${item.primary.label}: ${item.title}, ${item.ref}`} className={TITLE}>{item.title}</Link>
      </Lead>
      <Cells item={item} now={now} action={item.primary.label} />
    </tr>
  );
}

/** A consolidation: one row of work until someone needs its house bills. */
function GroupRow({ item, now, index }: { item: ActionItem; now: number; index: number }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['dashboard', 'group', item.group!.id, item.kind],
    queryFn: () => dashboardApi.actions({ group: item.group!.id, limit: 50 }),
    enabled: open,
  });
  const members = data?.items.filter((m) => m.kind === item.kind && m.lane === item.lane) ?? [];
  return (
    <>
      <tr className={cn(ROW, 'dash-row')} style={{ '--i': index } as React.CSSProperties}>
        <Lead item={item}>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={cn(TITLE, 'w-full text-left')}>{item.title}</button>
        </Lead>
        <Cells item={item} now={now} action={open ? 'Hide' : item.primary.label} />
      </tr>
      {open && members.map((m, i) => <ActionRow key={m.id} item={m} now={now} index={i} />)}
    </>
  );
}

function LaneRow({ lane, count }: { lane: Lane; count: number | null }) {
  const { name, tone } = LANE[lane];
  return (
    <tr className="border-t border-border/60 bg-muted/30">
      <th colSpan={COLUMNS} scope="rowgroup" className="px-4 py-1.5 text-left text-[12.5px] font-medium">
        <span className="inline-flex items-center gap-2">
          {name}
          {count !== null && <span className={cn('rounded-md px-1.5 py-px text-[11.5px] font-medium tabular-nums', TINT[tone])}>{count.toLocaleString()}</span>}
        </span>
      </th>
    </tr>
  );
}

function Rows({ items, now, counts }: { items: ActionItem[]; now: number; counts: Record<Lane, number> | null }) {
  return (
    <>
      {items.map((item, i) => {
        const Row = item.group ? GroupRow : ActionRow;
        const newLane = i === 0 || items[i - 1].lane !== item.lane;
        return (
          <FragmentRow key={item.id} lane={newLane ? item.lane : null} count={counts ? counts[item.lane] : null}>
            <Row item={item} now={now} index={i} />
          </FragmentRow>
        );
      })}
    </>
  );
}

function FragmentRow({ lane, count, children }: { lane: Lane | null; count: number | null; children: React.ReactNode }) {
  return (
    <>
      {lane && <LaneRow lane={lane} count={count} />}
      {children}
    </>
  );
}

function Head() {
  const th = 'px-3 py-2 text-[12px] font-medium text-muted-foreground';
  return (
    <thead className="max-sm:sr-only">
      <tr>
        <th scope="col" className={cn(th, 'pl-4 text-left')}>Issue</th>
        <th scope="col" className={cn(th, 'hidden text-left sm:table-cell')}>Shipment</th>
        <th scope="col" className={cn(th, 'hidden text-left min-[1360px]:table-cell')}>Importer</th>
        <th scope="col" className={cn(th, 'text-right')}>Due</th>
        <th scope="col" className={cn(th, 'hidden pr-4 text-right sm:table-cell')}><span className="sr-only">Action</span></th>
      </tr>
    </thead>
  );
}

export function AttentionTable({ data, now }: { data: DashboardResponse; now: number }) {
  const [filter, setFilter] = useState<ActionFilter>('all');
  const [page, setPage] = useState(1);
  const fetched = useActionsPage(filter, page);
  const first = filter === 'all' && page === 1;
  const view = first ? data.actions : fetched.data ?? data.actions;
  const busy = !first && (fetched.isFetching || fetched.isPlaceholderData);

  // A page can disappear as work gets done; the server answers with the last one.
  useEffect(() => {
    if (!busy && view.page !== page) setPage(view.page);
  }, [busy, view.page, page]);

  function changeFilter(f: ActionFilter) {
    setFilter(f);
    setPage(1);
  }

  const { attention, filters } = data;
  const counts = filter === 'all' ? attention : null;
  return (
    <section aria-labelledby="attention-title" className="dash-in relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-card" style={{ '--i': 2 } as React.CSSProperties}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b border-border pt-3">
        <h2 id="attention-title" className="px-4 pb-2.5 text-[14px] font-semibold">Action items</h2>
        <FilterTabs items={filters} active={filter} onChange={changeFilter} layoutId="attention-tab" />
      </div>
      {busy && <div className="dash-progress" role="progressbar" aria-label="Loading action items" />}
      {view.total === 0 ? (
        <div className="px-4 py-12 text-center">
          <span className={cn('mx-auto grid h-10 w-10 place-items-center rounded-xl', TINT.done)}>
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-[13px] font-medium">Nothing needs attention right now.</p>
        </div>
      ) : (
        <>
          <table className={cn('w-full text-[13px] transition-opacity duration-150', busy && 'opacity-60')}>
            <Head />
            <tbody key={`${filter}-${view.page}`}>
              <Rows items={view.items} now={now} counts={counts} />
            </tbody>
          </table>
          <Pagination page={view.page} pageCount={view.pageCount} total={view.total} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </section>
  );
}
