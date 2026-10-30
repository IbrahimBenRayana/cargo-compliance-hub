import { formatDuration } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { DashboardResponse, RateMetric } from '@/types/dashboard';

interface Stat { label: string; value: string; note: string; alert?: boolean }

function rateNote(m: RateMetric, unit: string): string {
  if (m.rate === null) return 'Not enough filings yet';
  const base = `${m.sample.toLocaleString()} ${unit}`;
  if (m.prior === null || m.prior === m.rate) return base;
  const change = m.rate - m.prior;
  return `${base}, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)} pts`;
}

function buildStats(d: DashboardResponse, now: number): Stat[] {
  const { attention: a, metrics: m, holds, arrivingWithoutEntry } = d;
  const cutoff = a.nextCutoffAt ? new Date(a.nextCutoffAt) : null;
  const arriving = m.arrivals.reduce((x, y) => x + y, 0);
  return [
    {
      label: 'Needs attention',
      value: a.now.toLocaleString(),
      note: a.overdue ? `${a.overdue} overdue` : a.soon ? `${a.soon} coming up` : 'Nothing urgent',
      alert: a.overdue > 0,
    },
    {
      label: 'Next ISF cutoff',
      value: cutoff ? formatDuration(cutoff.getTime() - now) : 'None',
      note: cutoff ? cutoff.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No open ISFs',
    },
    {
      label: 'Sent before cutoff',
      value: m.sentOnTime.rate === null ? 'No data' : `${m.sentOnTime.rate}%`,
      note: rateNote(m.sentOnTime, 'ISFs'),
    },
    {
      label: 'Accepted first time',
      value: m.firstPass.rate === null ? 'No data' : `${m.firstPass.rate}%`,
      note: rateNote(m.firstPass, 'accepted'),
    },
    arrivingWithoutEntry === null
      ? { label: 'Arriving', value: arriving.toLocaleString(), note: 'Next 7 days' }
      : { label: 'Arriving without entry', value: arrivingWithoutEntry.toLocaleString(), note: 'Next 7 days' },
    {
      label: 'On hold',
      value: holds.total.toLocaleString(),
      note: holds.lastFreeDaySoon ? `${holds.lastFreeDaySoon} near last free day` : 'CBP and terminal',
    },
  ];
}

export function StatStrip({ data, now }: { data: DashboardResponse; now: number }) {
  return (
    <dl className="grid grid-cols-2 rounded-lg border border-border bg-card sm:grid-cols-3 xl:grid-cols-6">
      {buildStats(data, now).map((s) => (
        <div key={s.label} className="min-w-0 border-border p-4 xl:border-l xl:first:border-l-0">
          <dt className="truncate text-[12.5px] text-muted-foreground">{s.label}</dt>
          <dd className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.015em] tabular-nums">{s.value}</dd>
          <dd className={cn('mt-0.5 truncate text-[12px] tabular-nums', s.alert ? 'font-medium text-urgent' : 'text-muted-foreground')} title={s.note}>{s.note}</dd>
        </div>
      ))}
    </dl>
  );
}
