import { Link } from 'react-router-dom';
import { formatDuration } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { AwaitingItem, DashboardMetrics, DashboardResponse } from '@/types/dashboard';
import { Columns } from './charts';
import { PanelTitle, Surface } from './Surface';

const ROW = 'flex items-baseline justify-between gap-3 rounded-md py-1.5 text-[13px] outline-none can-hover:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

function awaitingWords(a: AwaitingItem, now: number): { text: string; alert: boolean } {
  const ago = a.sentAt ? formatDuration(now - new Date(a.sentAt).getTime()) : null;
  switch (a.state) {
    case 'NO_RESPONSE': return { text: ago ? `No response yet, ${ago}` : 'No response yet', alert: true };
    case 'UNKNOWN': return { text: 'Outcome unknown', alert: true };
    case 'CONDITIONAL': return { text: 'Conditional response', alert: true };
    case 'QUEUED': return { text: 'Queued', alert: false };
    default: return { text: ago ? `Sent ${ago} ago` : 'Sent', alert: false };
  }
}

export function AwaitingPanel({ awaiting, now, index }: { awaiting: DashboardResponse['awaiting']; now: number; index: number }) {
  return (
    <Surface index={index} core="p-5">
      <PanelTitle aside={awaiting.count.toLocaleString()}>Awaiting response</PanelTitle>
      {awaiting.items.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Nothing sent is waiting.</p>
      ) : (
        <ul className="mt-2">
          {awaiting.items.map((a) => {
            const { text, alert } = awaitingWords(a, now);
            return (
              <li key={a.id}>
                <Link to={a.href} className={ROW}>
                  <span className="min-w-0 truncate font-mono text-[12.5px] font-medium">{a.ref}</span>
                  <span className={cn('shrink-0 text-[12.5px] tabular-nums', alert ? 'font-medium text-soon' : 'text-muted-foreground')}>{text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

export function VolumePanel({ metrics, now, index }: { metrics: DashboardMetrics; now: number; index: number }) {
  const { accepted, rejected, acceptedTotal, rejectedTotal } = metrics.outcomes;
  const days = accepted.length;
  const dayLabel = (i: number) => new Date(now - (days - 1 - i) * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const total = accepted.map((a, i) => a + rejected[i]);
  const max = Math.max(...total, 1);
  return (
    <Surface index={index} core="p-5">
      <PanelTitle aside={`${days} days`}>ISF outcomes</PanelTitle>
      <div
        role="img"
        aria-label={`${acceptedTotal} ISFs accepted and ${rejectedTotal} rejected in the last ${days} days.`}
        className="mt-3 flex h-[92px] items-end gap-[2px]"
      >
        {total.map((t, i) => (
          <div key={i} className="group/bar relative flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px]">
            {rejected[i] > 0 && <div className="grow-y rounded-t-[2px] bg-[hsl(var(--urgent-fg))]" style={{ height: `${(rejected[i] / max) * 100}%`, '--i': i } as React.CSSProperties} />}
            <div
              className={cn('grow-y rounded-[2px] bg-primary', accepted[i] === 0 && 'opacity-20')}
              style={{ height: accepted[i] ? `${(accepted[i] / max) * 100}%` : '2px', '--i': i } as React.CSSProperties}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[12px] font-medium text-popover-foreground shadow-popover group-hover/bar:block">
              {dayLabel(i)}: {accepted[i]} accepted, {rejected[i]} rejected
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-[12.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-primary" />Accepted {acceptedTotal.toLocaleString()}</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[hsl(var(--urgent-fg))]" />Rejected {rejectedTotal.toLocaleString()}</span>
      </div>
    </Surface>
  );
}

function BarList({ items, tone }: { items: Array<{ label: string; count: number }>; tone: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate" title={it.label}>{it.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{it.count.toLocaleString()}</span>
          </div>
          <div className={cn('grow-x mt-1 h-1 rounded-full', tone)} style={{ width: `${(it.count / max) * 100}%`, '--i': i } as React.CSSProperties} aria-hidden />
        </li>
      ))}
    </ul>
  );
}

export function WorkloadPanel({ workload, index }: { workload: DashboardResponse['workload']; index: number }) {
  if (workload.length === 0) return null;
  return (
    <Surface index={index} core="p-5">
      <PanelTitle aside="Open items">Busiest importers</PanelTitle>
      <BarList items={workload.map((w) => ({ label: w.name, count: w.count }))} tone="bg-primary" />
    </Surface>
  );
}

export function ReasonsPanel({ reasons, days, index }: { reasons: DashboardMetrics['rejectionReasons']; days: number; index: number }) {
  if (reasons.length === 0) return null;
  return (
    <Surface index={index} core="p-5">
      <PanelTitle aside={`${days} days`}>Top rejection reasons</PanelTitle>
      <BarList items={reasons.map((r) => ({ label: r.reason, count: r.count }))} tone="bg-[hsl(var(--urgent-fg))]" />
    </Surface>
  );
}

export function RecentPanel({ recent, now, index }: { recent: DashboardResponse['recent']; now: number; index: number }) {
  if (recent.length === 0) return null;
  return (
    <Surface index={index} core="p-5">
      <PanelTitle>Recent</PanelTitle>
      <ul className="mt-2">
        {recent.slice(0, 5).map((r) => (
          <li key={r.id}>
            <Link to={r.href} className={ROW}>
              <span className="min-w-0 truncate">{r.text}</span>
              <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">{formatDuration(now - new Date(r.at).getTime())}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
