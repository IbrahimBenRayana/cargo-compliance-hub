import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';
import type { DashboardMetrics } from '@/types/dashboard';
import { Columns, SparkArea } from './charts';
import { Delta } from './HealthCard';
import { Surface } from './Surface';

function Figure({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const shown = useCountUp(value, { duration: 1000 });
  return <span className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{prefix}{shown.toLocaleString()}{suffix}</span>;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ExposureTile({ usd, index }: { usd: number; index: number }) {
  const safe = usd === 0;
  const Icon = safe ? ShieldCheck : AlertTriangle;
  return (
    <Surface index={index} core={cn('flex flex-col justify-between gap-3 p-5', !safe && 'bg-[linear-gradient(150deg,hsl(var(--urgent-tint)),transparent_70%),hsl(var(--card))]')}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-muted-foreground">Late ISF exposure</h2>
        <Icon className={cn('h-4 w-4', safe ? 'text-done' : 'text-urgent')} aria-hidden />
      </div>
      <div>
        <Figure value={usd} prefix="$" />
        <p className="mt-1.5 text-[12.5px] leading-[18px] text-muted-foreground" title="Liquidated damages can reach $5,000 per ISF violation. This is an upper figure, not a charge.">
          {safe ? 'Nothing overdue' : 'Up to $5,000 per overdue ISF'}
        </p>
      </div>
    </Surface>
  );
}

function SparkTile({ title, value, suffix, delta, series, sub, index, label }: {
  title: string; value: number | null; suffix?: string; delta: React.ReactNode; series: number[]; sub: string; index: number; label: string;
}) {
  return (
    <Surface index={index} className="lift" core="flex flex-col justify-between gap-2 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-muted-foreground">{title}</h2>
        {delta}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {value === null ? <span className="text-[30px] font-semibold leading-none text-muted-foreground">No data</span> : <Figure value={value} suffix={suffix} />}
          <p className="mt-1.5 truncate text-[12.5px] leading-[18px] text-muted-foreground">{sub}</p>
        </div>
        <SparkArea series={series} label={label} className="w-[44%] shrink-0" />
      </div>
    </Surface>
  );
}

function ArrivalsTile({ arrivals, now, index }: { arrivals: number[]; now: number; index: number }) {
  const total = arrivals.reduce((a, b) => a + b, 0);
  const day = (i: number) => DAY_NAMES[new Date(now + i * 86_400_000).getUTCDay()];
  return (
    <Surface index={index} className="lift" core="flex flex-col justify-between gap-2 p-5">
      <h2 className="text-[13px] font-medium text-muted-foreground">Arriving, next 7 days</h2>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <Figure value={total} />
          <p className="mt-1.5 text-[12.5px] leading-[18px] text-muted-foreground">{total === 1 ? 'Shipment' : 'Shipments'}</p>
        </div>
        <div className="h-[52px] w-[48%] shrink-0">
          <Columns
            values={arrivals}
            tone={() => 'bg-primary'}
            label={`${total} shipments arriving in the next 7 days.`}
            labelFor={(i, v) => `${day(i)}: ${v}`}
          />
        </div>
      </div>
    </Surface>
  );
}

export function KpiRow({ metrics, now, start }: { metrics: DashboardMetrics; now: number; start: number }) {
  const { firstPass, isfSent, windowDays } = metrics;
  return (
    <section aria-label="Key numbers" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ExposureTile usd={metrics.exposureUsd} index={start} />
      <SparkTile
        index={start + 1}
        title="ISFs sent"
        value={isfSent.total}
        sub={`Last ${windowDays} days`}
        delta={<Delta now={isfSent.total} prior={isfSent.prior} unit="%" />}
        series={isfSent.series}
        label={`${isfSent.total} ISFs sent in the last ${windowDays} days, by day.`}
      />
      <SparkTile
        index={start + 2}
        title="Accepted first time"
        value={firstPass.rate}
        suffix="%"
        sub={firstPass.sample ? `Of ${firstPass.sample.toLocaleString()} accepted` : 'Shows once ISFs are accepted'}
        delta={<Delta now={firstPass.rate} prior={firstPass.prior} unit="pts" />}
        series={metrics.outcomes.accepted}
        label={`ISFs accepted per day over the last ${windowDays} days.`}
      />
      <ArrivalsTile arrivals={metrics.arrivals} now={now} index={start + 3} />
    </section>
  );
}
