import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { dashboardApi } from '@/api/client';
import { useFilteredActions } from '@/hooks/useDashboard';
import { countdownLabel, urgencyOf } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { ActionFilter, ActionItem, ActionKind, DashboardResponse, Lane, LaneData } from '@/types/dashboard';

const LANE_NAME: Record<Lane, string> = { now: 'Now', soon: 'Soon', later: 'Later' };
const FIRST_ROWS = 8;
/** Beyond this the full lists are the better tool. */
const MAX_ROWS = 100;
const COLUMNS = 5;

const STATE: Partial<Record<ActionKind, { text: string; urgent?: boolean }>> = {
  isf_rejected: { text: 'Rejected', urgent: true },
  entry_rejected: { text: 'Rejected', urgent: true },
  isf_change_rejected: { text: 'Rejected', urgent: true },
  entry_change_rejected: { text: 'Rejected', urgent: true },
  entry_release_rejected: { text: 'Rejected', urgent: true },
  isf_no_date: { text: 'No date' },
  isf_on_hold: { text: 'On hold' },
  tracking_hold: { text: 'Hold' },
  cbp_no_response: { text: 'No response' },
  cbp_outcome_unknown: { text: 'Unknown' },
  cbp_conditional: { text: 'Review' },
};

const URGENCY_CLASS = { overdue: 'font-medium text-urgent', urgent: 'text-urgent', soon: 'text-soon', calm: 'text-muted-foreground' };

function Due({ item, now }: { item: ActionItem; now: number }) {
  if (item.due) {
    const level = urgencyOf(new Date(item.due.at).getTime() - now);
    const date = new Date(item.due.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const estimated = item.due.basis === 'ETD_ESTIMATE';
    return (
      <time
        dateTime={item.due.at}
        className={URGENCY_CLASS[level]}
        title={estimated ? `Estimated from the sailing date: ${date}. Add a lading date to make it exact.` : date}
      >
        {countdownLabel(item.due.at, item.due.basis, now)}
      </time>
    );
  }
  const state = STATE[item.kind];
  return state ? <span className={state.urgent ? 'text-urgent' : 'text-muted-foreground'}>{state.text}</span> : null;
}

const ROW = 'group relative border-t border-border/70 transition-colors duration-100 can-hover:hover:bg-muted/50';
const CELL_FIRST = 'w-full max-w-0 py-2.5 pl-4 pr-3';
const TITLE = 'block line-clamp-2 font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring sm:truncate';
const REF = 'font-mono text-[12.5px]';

function Cells({ item, now, action }: { item: ActionItem; now: number; action: string }) {
  return (
    <>
      <td className="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell"><span className={REF}>{item.ref}</span></td>
      <td className="hidden max-w-[170px] truncate px-3 py-2.5 text-muted-foreground min-[1360px]:table-cell" title={item.party ?? undefined}>{item.party}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums"><Due item={item} now={now} /></td>
      <td className="hidden whitespace-nowrap py-2.5 pl-3 pr-4 text-right text-muted-foreground transition-colors duration-100 can-hover:group-hover:text-foreground sm:table-cell">{action}</td>
    </>
  );
}

function Sub({ item }: { item: ActionItem }) {
  return (
    <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground sm:hidden">
      <span className={REF}>{item.ref}</span>
      {item.party && <>, {item.party}</>}
    </span>
  );
}

function ActionRow({ item, now }: { item: ActionItem; now: number }) {
  return (
    <tr className={ROW}>
      <td className={CELL_FIRST}>
        <Link to={item.primary.href} aria-label={`${item.primary.label}: ${item.title}, ${item.ref}`} className={TITLE}>{item.title}</Link>
        <Sub item={item} />
      </td>
      <Cells item={item} now={now} action={item.primary.label} />
    </tr>
  );
}

/** A consolidation: one row of work until someone needs its house bills. */
function GroupRow({ item, now }: { item: ActionItem; now: number }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['dashboard', 'group', item.group!.id, item.kind],
    queryFn: () => dashboardApi.actions({ group: item.group!.id, limit: 50 }),
    enabled: open,
  });
  const members = data?.items.filter((m) => m.kind === item.kind && m.lane === item.lane) ?? [];
  return (
    <>
      <tr className={ROW}>
        <td className={CELL_FIRST}>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={cn(TITLE, 'w-full text-left')}>{item.title}</button>
          <Sub item={item} />
        </td>
        <Cells item={item} now={now} action={open ? 'Hide' : item.primary.label} />
      </tr>
      {open && members.map((m) => <ActionRow key={m.id} item={m} now={now} />)}
    </>
  );
}

export function Rows({ items, now }: { items: ActionItem[]; now: number }) {
  return (
    <>
      {items.map((item) => {
        const Row = item.group ? GroupRow : ActionRow;
        return <Row key={item.id} item={item} now={now} />;
      })}
    </>
  );
}

function LaneRows({ data, now }: { data: LaneData; now: number }) {
  const [open, setOpen] = useState(data.lane !== 'later');
  const [more, setMore] = useState<ActionItem[]>([]);
  const [cursor, setCursor] = useState(data.nextCursor);
  const [limit, setLimit] = useState(FIRST_ROWS);
  const [busy, setBusy] = useState(false);

  const items = [...data.items, ...more];
  const visible = items.slice(0, limit);
  const hidden = data.total - visible.length;

  async function showMore() {
    const next = limit + 25;
    if (cursor && items.length < next) {
      setBusy(true);
      try {
        const page = await dashboardApi.actions({ lane: data.lane, cursor, limit: 25 });
        setMore((m) => [...m, ...page.items]);
        setCursor(page.nextCursor);
      } finally {
        setBusy(false);
      }
    }
    setLimit(next);
  }

  return (
    <tbody>
      <tr className="border-t border-border/70 bg-muted/30">
        <th colSpan={COLUMNS} scope="rowgroup" className="p-0 text-left">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center gap-1.5 px-4 py-1.5 text-[12.5px] font-medium text-muted-foreground outline-none transition-colors duration-100 can-hover:hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <ChevronRight aria-hidden className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-90')} />
            {LANE_NAME[data.lane]}
            <span className="tabular-nums">{data.total.toLocaleString()}</span>
          </button>
        </th>
      </tr>
      {open && <Rows items={visible} now={now} />}
      {open && hidden > 0 && visible.length < MAX_ROWS && (
        <tr className="border-t border-border/70">
          <td colSpan={COLUMNS} className="p-0">
            <button
              type="button"
              disabled={busy}
              onClick={showMore}
              className="w-full px-4 py-2 text-left text-[13px] font-medium text-primary outline-none can-hover:hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {busy ? 'Loading' : `Show ${Math.min(25, hidden)} more of ${hidden.toLocaleString()}`}
            </button>
          </td>
        </tr>
      )}
    </tbody>
  );
}

function Tabs({ filters, active, onChange }: { filters: DashboardResponse['filters']; active: ActionFilter; onChange: (f: ActionFilter) => void }) {
  return (
    <div role="group" aria-label="Filter" className="-mb-px flex gap-5 overflow-x-auto px-4 [scrollbar-width:none]">
      {filters.map((f) => {
        const on = f.key === active;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={on}
            disabled={f.count === 0 && f.key !== 'all'}
            onClick={() => onChange(f.key)}
            className={cn(
              'relative shrink-0 pb-2.5 pt-1 text-[13px] font-medium outline-none transition-colors duration-100 disabled:opacity-45 focus-visible:text-foreground focus-visible:underline',
              on ? 'text-foreground' : 'text-muted-foreground can-hover:hover:text-foreground',
            )}
          >
            {f.label} <span className="tabular-nums text-muted-foreground">{f.count.toLocaleString()}</span>
            {on && <motion.span layoutId="attention-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" transition={{ type: 'spring', bounce: 0, duration: 0.3 }} />}
          </button>
        );
      })}
    </div>
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
  const filtered = useFilteredActions(filter);
  const { attention, filters, lanes } = data;
  const dueSoon = attention.overdue + (filters.find((f) => f.key === 'due_today')?.count ?? 0);
  const shown = lanes.filter((l) => l.total > 0);
  return (
    <section aria-labelledby="attention-title" className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b border-border pt-3">
        <h2 id="attention-title" className="px-4 pb-2.5 text-[14px] font-semibold">Action items</h2>
        <Tabs filters={filters} active={filter} onChange={setFilter} />
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">Nothing needs attention right now.</p>
      ) : (
        <table className="w-full text-[13px]">
          <Head />
          {filter === 'all'
            ? shown.map((l) => <LaneRows key={l.lane} data={l} now={now} />)
            : <tbody><Rows items={filtered.data?.items ?? []} now={now} /></tbody>}
        </table>
      )}
      {dueSoon > 0 && (
        <p className="border-t border-border/70 px-4 py-2 text-[12.5px] text-muted-foreground">
          A late ISF can draw liquidated damages of up to $5,000.
        </p>
      )}
    </section>
  );
}
