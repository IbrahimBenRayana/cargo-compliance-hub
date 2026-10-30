import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CountMetric, DashboardMetrics } from '@/types/dashboard';

const HEIGHT = 240;
const M = { top: 12, right: 12, bottom: 26, left: 34 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Straight segments: daily counts are discrete, and a smoothed curve would imply values between days. */
function polyline(pts: Array<[number, number]>): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

const day = (now: number, daysAgo: number) =>
  new Date(now - daysAgo * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function Plot({ metric, name, now }: { metric: CountMetric; name: string; now: number }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = metric.series.length;
  const plotW = Math.max(width - M.left - M.right, 10);
  const plotH = HEIGHT - M.top - M.bottom;
  const max = niceMax(Math.max(...metric.series, ...metric.priorSeries, 1));
  const x = (i: number) => M.left + (i / (n - 1)) * plotW;
  const y = (v: number) => M.top + plotH - (v / max) * plotH;

  const { line, area, prior } = useMemo(() => {
    const pts = metric.series.map((v, i) => [x(i), y(v)] as [number, number]);
    const l = polyline(pts);
    return {
      line: l,
      area: `${l} L${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`,
      prior: polyline(metric.priorSeries.map((v, i) => [x(i), y(v)] as [number, number])),
    };
  // x and y derive from the values listed here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, width, max]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left - M.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  // Glide between measures; a resize should just redraw.
  const lastWidth = useRef(width);
  const resized = lastWidth.current !== width;
  useEffect(() => { lastWidth.current = width; }, [width]);
  const glide = resized ? { duration: 0 } : ({ type: 'spring', bounce: 0, duration: 0.45 } as const);
  const ticks = [0, max / 2, max];
  return (
    <div ref={ref} className="relative">
      <svg
        width={width} height={HEIGHT} role="img"
        aria-label={`${name}: ${metric.total} in the last ${n} days, ${metric.prior} in the ${n} before.`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        className="block touch-pan-y text-primary"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth="1" />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{t}</text>
          </g>
        ))}
        <motion.path initial={false} animate={{ d: prior }} transition={glide} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.55" strokeWidth="1.25" strokeDasharray="3 4" />
        <motion.path initial={false} animate={{ d: area }} transition={glide} fill="currentColor" fillOpacity="0.07" />
        <motion.path initial={false} animate={{ d: line }} transition={glide} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x={M.left} y={HEIGHT - 8} className="fill-muted-foreground text-[11px]">{day(now, n - 1)}</text>
        <text x={M.left + plotW / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">{day(now, Math.floor(n / 2))}</text>
        <text x={width - M.right} y={HEIGHT - 8} textAnchor="end" className="fill-muted-foreground text-[11px]">{day(now, 0)}</text>
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + plotH} stroke="hsl(var(--foreground))" strokeOpacity="0.2" />
            <circle cx={x(hover)} cy={y(metric.series[hover])} r="3.5" fill="currentColor" stroke="hsl(var(--card))" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-[12px] shadow-sm"
          style={{ left: Math.min(Math.max(x(hover), 70), width - 70), transform: 'translateX(-50%)' }}
        >
          <p className="text-muted-foreground">{day(now, n - 1 - hover)}</p>
          <p className="font-medium tabular-nums">{metric.series[hover]} {name}</p>
          <p className="tabular-nums text-muted-foreground">Previous {metric.priorSeries[hover]}</p>
        </div>
      )}
    </div>
  );
}

function change({ total, prior }: CountMetric): string {
  if (prior === 0) return total === 0 ? 'No change' : 'New this period';
  const pct = Math.round(((total - prior) / prior) * 100);
  return pct === 0 ? 'No change' : `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}%`;
}

export function ActivityChart({ metrics, now, usage }: { metrics: DashboardMetrics; now: number; usage: string | null }) {
  const tabs = [
    { key: 'sent', name: 'ISFs sent', metric: metrics.isfSent },
    { key: 'accepted', name: 'ISFs accepted', metric: metrics.isfAccepted },
    { key: 'rejected', name: 'ISFs rejected', metric: metrics.isfRejected },
    ...(metrics.entriesAccepted ? [{ key: 'entries', name: 'Entries accepted', metric: metrics.entriesAccepted }] : []),
  ];
  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <section aria-labelledby="activity-title" className="min-w-0 rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 pt-3">
        <h2 id="activity-title" className="text-[14px] font-semibold">Filing activity</h2>
        <p className="text-[12.5px] text-muted-foreground">{usage ?? `Last ${metrics.windowDays} days`}</p>
      </div>
      <div role="tablist" aria-label="Measure" className="mt-3 flex overflow-x-auto border-b border-border px-4 [scrollbar-width:none]">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className="relative min-w-[120px] flex-1 pb-3 pr-4 text-left outline-none focus-visible:underline"
            >
              <span className="block text-[12.5px] text-muted-foreground">{t.name}</span>
              <span className={cn('mt-0.5 block text-[20px] font-semibold leading-7 tracking-[-0.015em] tabular-nums transition-colors duration-100', on ? 'text-foreground' : 'text-muted-foreground can-hover:hover:text-foreground')}>{t.metric.total.toLocaleString()}</span>
              <span className="block text-[12px] tabular-nums text-muted-foreground">{change(t.metric)}</span>
              {on && <motion.span layoutId="activity-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" transition={{ type: 'spring', bounce: 0, duration: 0.3 }} />}
            </button>
          );
        })}
      </div>
      <div className="px-3 pb-2 pt-3">
        <Plot metric={current.metric} name={current.name} now={now} />
        <div className="flex gap-4 px-1 pb-1 pl-[34px] text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-3.5 bg-primary" />This period</span>
          <span className="flex items-center gap-1.5"><i className="w-3.5 border-t border-dashed border-muted-foreground" />Previous {metrics.windowDays} days</span>
        </div>
      </div>
    </section>
  );
}
