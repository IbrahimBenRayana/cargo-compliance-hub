import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { dashboardApi } from '@/api/client';
import { cn } from '@/lib/utils';
import type { ActionItem, Lane, LaneData } from '@/types/dashboard';
import { ActionRow, GroupRow } from './ActionRow';

const LANE_NAME: Record<Lane, string> = { now: 'Now', soon: 'Soon', later: 'Later' };
/** Beyond this the full lists are the better tool, and the page stays quick. */
const MAX_LOADED = 100;

export function Rows({ items, firstIsCurrent, now }: { items: ActionItem[]; firstIsCurrent: boolean; now: number }) {
  return (
    <ul>
      {items.map((item, i) => {
        const Row = item.group ? GroupRow : ActionRow;
        return <Row key={item.id} item={item} current={firstIsCurrent && i === 0} now={now} />;
      })}
    </ul>
  );
}

function QueueLane({ data, first, now, showCount }: { data: LaneData; first: boolean; now: number; showCount: boolean }) {
  const [more, setMore] = useState<ActionItem[]>([]);
  const [cursor, setCursor] = useState(data.nextCursor);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(data.lane !== 'later');

  const items = [...data.items, ...more];
  const left = data.total - items.length;

  async function loadMore() {
    if (!cursor) return;
    setBusy(true);
    try {
      const page = await dashboardApi.actions({ lane: data.lane, cursor, limit: 25 });
      setMore((m) => [...m, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`lane-${data.lane}`} className="border-t border-border/70 first:border-t-0">
      <h2 id={`lane-${data.lane}`}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between px-3 sm:px-4 pb-2 pt-3 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.14em] text-muted-foreground"
        >
          <span>{LANE_NAME[data.lane]}</span>
          <span className="flex items-center gap-1 tabular-nums">
            {showCount && data.total}
            <ChevronDown aria-hidden className={cn('h-3 w-3', !open && '-rotate-90')} />
          </span>
        </button>
      </h2>
      {open && <Rows items={items} firstIsCurrent={first} now={now} />}
      {open && cursor && items.length < MAX_LOADED && (
        <button
          type="button"
          disabled={busy}
          onClick={loadMore}
          className="flex min-h-11 w-full items-center justify-between border-t border-border/60 px-3 sm:px-4 text-[13px] font-medium text-muted-foreground can-hover:hover:text-foreground"
        >
          <span>{busy ? 'Loading…' : 'Show 25 more'}</span>
          <span className="tabular-nums">{left.toLocaleString()} left</span>
        </button>
      )}
    </section>
  );
}

export function ActionQueue({ lanes, now }: { lanes: LaneData[]; now: number }) {
  const shown = lanes.filter((l) => l.total > 0);
  return (
    <>
      {/* The command panel already holds the Now count. */}
      {shown.map((l, i) => <QueueLane key={l.lane} data={l} first={i === 0} now={now} showCount={l.lane !== 'now'} />)}
    </>
  );
}
