import type { LucideIcon } from 'lucide-react';
import { AlertCircle, BadgeCheck, PauseCircle, Send, Ship, Timer } from 'lucide-react';
import { formatDuration, urgencyOf } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { DashboardResponse, RateMetric } from '@/types/dashboard';
import { TINT, type Tone } from './tones';

interface Stat {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: Tone;
  badge?: { text: string; tone: Tone };
}

function changeBadge(m: RateMetric): Stat['badge'] {
  if (m.rate === null || m.prior === null || m.rate === m.prior) return undefined;
  const change = m.rate - m.prior;
  return { text: `${change > 0 ? '+' : ''}${change} pts`, tone: change > 0 ? 'done' : 'urgent' };
}

function rate(label: string, m: RateMetric, unit: string, icon: LucideIcon): Stat {
  return {
    label, icon, tone: 'done',
    value: m.rate === null ? 'No data' : `${m.rate}%`,
    note: m.rate === null ? 'Not enough filings yet' : `${m.sample.toLocaleString()} ${unit}`,
    badge: changeBadge(m),
  };
}

function buildStats(d: DashboardResponse, now: number): Stat[] {
  const { attention: a, metrics: m, holds, arrivingWithoutEntry } = d;
  const cutoff = a.nextCutoffAt ? new Date(a.nextCutoffAt) : null;
  const left = cutoff ? cutoff.getTime() - now : null;
  const arriving = m.arrivals.reduce((x, y) => x + y, 0);
  const cutoffLevel = left === null ? 'calm' : urgencyOf(left);
  return [
    {
      label: 'Needs attention',
      value: a.now.toLocaleString(),
      note: a.overdue ? '' : a.soon ? `${a.soon} coming up` : 'Nothing urgent',
      icon: AlertCircle,
      tone: a.overdue ? 'urgent' : a.now ? 'soon' : 'done',
      badge: a.overdue ? { text: `${a.overdue} overdue`, tone: 'urgent' } : undefined,
    },
    {
      label: 'Next ISF cutoff',
      value: left !== null ? formatDuration(left) : 'None',
      note: cutoff ? cutoff.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No open ISFs',
      icon: Timer,
      tone: cutoffLevel === 'urgent' || cutoffLevel === 'overdue' ? 'urgent' : cutoffLevel === 'soon' ? 'soon' : 'info',
    },
    rate('Sent before cutoff', m.sentOnTime, 'ISFs', Send),
    rate('Accepted first time', m.firstPass, 'accepted', BadgeCheck),
    arrivingWithoutEntry === null
      ? { label: 'Arriving', value: arriving.toLocaleString(), note: 'Next 7 days', icon: Ship, tone: 'info' }
      : { label: 'Arriving, no entry', value: arrivingWithoutEntry.toLocaleString(), note: 'Next 7 days', icon: Ship, tone: arrivingWithoutEntry ? 'entry' : 'calm' },
    {
      label: 'On hold',
      value: holds.total.toLocaleString(),
      note: holds.lastFreeDaySoon ? `${holds.lastFreeDaySoon} near last free day` : 'CBP and terminal',
      icon: PauseCircle,
      tone: holds.total ? 'soon' : 'calm',
    },
  ];
}

export function StatStrip({ data, now }: { data: DashboardResponse; now: number }) {
  return (
    <dl className="dash-in grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 shadow-card sm:grid-cols-3 xl:grid-cols-6" style={{ '--i': 1 } as React.CSSProperties}>
      {buildStats(data, now).map((s) => (
        <div key={s.label} className="min-w-0 bg-card p-4 transition-colors duration-150 can-hover:hover:bg-muted/30">
          <dt className="flex items-start justify-between gap-1.5 text-[12px] leading-[18px] text-muted-foreground sm:gap-2 sm:text-[12.5px]">
            <span className="min-w-0 truncate">{s.label}</span>
            <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-lg sm:h-7 sm:w-7', TINT[s.tone])}>
              <s.icon className="h-3.5 w-3.5" aria-hidden />
            </span>
          </dt>
          <dd className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.015em] tabular-nums">{s.value}</dd>
          <dd className="mt-1 flex min-h-[20px] items-center gap-1.5 text-[12px] tabular-nums text-muted-foreground">
            {s.note && <span className="min-w-0 truncate" title={s.note}>{s.note}</span>}
            {s.badge && <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', TINT[s.badge.tone])}>{s.badge.text}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
