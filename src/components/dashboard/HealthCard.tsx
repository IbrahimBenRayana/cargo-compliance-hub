import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import type { DashboardMetrics } from '@/types/dashboard';
import { Ring } from './charts';
import { PanelTitle, Surface } from './Surface';

/** Change against the window before. Better is green either way the number moves. */
export function Delta({ now, prior, unit, goodWhenUp = true }: { now: number | null; prior: number | null; unit: '%' | 'pts'; goodWhenUp?: boolean }) {
  if (now === null || prior === null) return null;
  const change = unit === 'pts' ? now - prior : prior === 0 ? null : Math.round(((now - prior) / prior) * 100);
  if (change === null || change === 0) return <span className="text-[12.5px] text-muted-foreground">No change</span>;
  const up = change > 0;
  const good = up === goodWhenUp;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12.5px] font-medium tabular-nums', good ? 'text-done' : 'text-urgent')}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {up ? '+' : ''}{change}{unit === 'pts' ? ' pts' : '%'}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-[15px] font-semibold tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}

export function HealthCard({ metrics, index }: { metrics: DashboardMetrics; index: number }) {
  const { sentOnTime: m, outcomes, entriesAccepted, windowDays } = metrics;
  const shown = useCountUp(m.rate ?? 0, { duration: 1100 });
  return (
    <Surface index={index} className="h-full" core="flex flex-col gap-5 p-5 sm:p-6">
      <PanelTitle aside={`${windowDays} days`}>Filing health</PanelTitle>
      <div className="flex items-center gap-5">
        <Ring percent={m.rate}>
          {m.rate === null ? (
            <span className="px-5 text-[12.5px] leading-4 text-muted-foreground">No sends yet</span>
          ) : (
            <span className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{shown}<span className="text-[17px]">%</span></span>
          )}
        </Ring>
        <div className="min-w-0 space-y-1">
          <p className="text-[14px] font-semibold leading-5">Sent before cutoff</p>
          <p className="text-[12.5px] leading-[18px] text-muted-foreground">
            {m.sample ? `${m.sample.toLocaleString()} ${m.sample === 1 ? 'ISF' : 'ISFs'} with a cutoff` : 'Shows once ISFs are sent'}
          </p>
          <Delta now={m.rate} prior={m.prior} unit="pts" />
        </div>
      </div>
      <dl className="mt-auto space-y-2 border-t border-border/60 pt-4">
        <Fact label="ISFs accepted" value={outcomes.acceptedTotal} />
        <Fact label="ISFs rejected" value={outcomes.rejectedTotal} />
        {entriesAccepted && <Fact label="Entries accepted" value={entriesAccepted.total} />}
      </dl>
    </Surface>
  );
}
