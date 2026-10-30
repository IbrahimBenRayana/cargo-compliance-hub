import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatDuration } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { AwaitingItem, DashboardResponse } from '@/types/dashboard';

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {aside && <span className="text-[12.5px] tabular-nums text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function CutoffPanel({ horizon }: { horizon: NonNullable<DashboardResponse['horizon']> }) {
  const { buckets, bucketHours } = horizon;
  const max = Math.max(...buckets, 1);
  const in24 = buckets.slice(0, 24 / bucketHours).reduce((a, b) => a + b, 0);
  const total = buckets.reduce((a, b) => a + b, 0);
  return (
    <Panel title="ISF cutoffs" aside="Next 72 hours">
      <div role="img" aria-label={`${total} ISF cutoffs in the next 72 hours, ${in24} within 24 hours.`} className="mt-3 flex h-[84px] items-end gap-1">
        {buckets.map((n, i) => {
          const soon = (i + 1) * bucketHours <= 24;
          return (
            <div key={i} className="group/bar relative flex h-full min-w-0 flex-1 items-end">
              <div
                className={cn('w-full rounded-t-[2px]', soon ? 'bg-primary' : 'bg-primary/35', n === 0 && 'bg-border')}
                style={{ height: n ? `${Math.max((n / max) * 100, 8)}%` : '1px' }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[12px] shadow-sm group-hover/bar:block">
                {n} in {i * bucketHours} to {(i + 1) * bucketHours}h
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>Now</span><span>24h</span><span>48h</span><span>72h</span>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{in24}</span> within 24 hours, <span className="font-medium text-foreground tabular-nums">{total}</span> in 72
      </p>
    </Panel>
  );
}

function awaitingWords(a: AwaitingItem, now: number): { text: string; alert: boolean } {
  const ago = a.sentAt ? formatDuration(now - new Date(a.sentAt).getTime()) : null;
  switch (a.state) {
    case 'NO_RESPONSE': return { text: ago ? `No response, ${ago}` : 'No response', alert: true };
    case 'UNKNOWN': return { text: 'Outcome unknown', alert: true };
    case 'CONDITIONAL': return { text: 'Conditional', alert: true };
    case 'QUEUED': return { text: 'Queued', alert: false };
    default: return { text: ago ? `Sent ${ago} ago` : 'Sent', alert: false };
  }
}

const LIST_ROW = 'flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-[13px] last:border-b-0';

export function AwaitingPanel({ awaiting, now }: { awaiting: DashboardResponse['awaiting']; now: number }) {
  return (
    <Panel title="Awaiting response" aside={awaiting.count.toLocaleString()}>
      {awaiting.items.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Nothing is waiting.</p>
      ) : (
        <ul>
          {awaiting.items.map((a) => {
            const { text, alert } = awaitingWords(a, now);
            return (
              <li key={a.id}>
                <Link to={a.href} className={cn(LIST_ROW, 'outline-none can-hover:hover:text-primary focus-visible:underline')}>
                  <span className="min-w-0 truncate font-mono text-[12.5px]">{a.ref}</span>
                  <span className={cn('shrink-0 text-[12.5px] tabular-nums', alert ? 'font-medium text-soon' : 'text-muted-foreground')}>{text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function StagePanel({ flow }: { flow: DashboardResponse['flow'] }) {
  const max = Math.max(...flow.map((s) => s.count), 1);
  return (
    <Panel title="Shipments by stage">
      <ul className="mt-1.5">
        {flow.map((s) => (
          <li key={s.key}>
            <Link to={s.href} className="block rounded-sm py-1 outline-none can-hover:hover:text-primary focus-visible:underline">
              <span className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate">{s.label}</span>
                <span className="shrink-0 font-medium tabular-nums">{s.count.toLocaleString()}</span>
              </span>
              <span className="mt-1 block h-1 rounded-[1px] bg-primary/70" style={{ width: `${Math.max((s.count / max) * 100, s.count ? 2 : 0)}%` }} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function CountPanel({ title, aside, items }: { title: string; aside?: string; items: Array<{ label: string; count: number }> }) {
  if (items.length === 0) return null;
  return (
    <Panel title={title} aside={aside}>
      <ul>
        {items.map((it) => (
          <li key={it.label} className={LIST_ROW}>
            <span className="min-w-0 truncate" title={it.label}>{it.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{it.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
