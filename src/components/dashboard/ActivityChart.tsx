import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CountMetric, DashboardMetrics } from '@/types/dashboard';
import { FILL, TINT } from './tones';

const HEIGHT = 240;
const M = { top: 12, right: 12, bottom: 26, left: 34 };
/** The crosshair follows the pointer closely enough to feel attached. */
const FOLLOW = 'transform 110ms cubic-bezier(0.23, 1, 0.32, 1)';

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

function Plot({ metric, name, now, colour }: { metric: CountMetric; name: string; now: number; colour: string }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  // The readout fades out where it last was, rather than vanishing.
  const last = useRef(0);
  if (hover !== null) last.current = hover;
  const at = last.current;
  const gradient = useId();
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
    <div ref={ref} className="relative" style={{ color: colour }}>
      <svg
        width={width} height={HEIGHT} role="img"
        aria-label={`${name}: ${metric.total} in the last ${n} days, ${metric.prior} in the ${n} before.`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        className="block touch-pan-y"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray={t === 0 ? undefined : '2 4'} />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{t}</text>
          </g>
        ))}
        <g className="dash-draw">
          <motion.path initial={false} animate={{ d: prior }} transition={glide} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.55" strokeWidth="1.25" strokeDasharray="3 4" />
          <motion.path initial={false} animate={{ d: area }} transition={glide} fill={`url(#${gradient})`} />
          <motion.path initial={false} animate={{ d: line }} transition={glide} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text x={M.left} y={HEIGHT - 8} className="fill-muted-foreground text-[11px]">{day(now, n - 1)}</text>
        <text x={M.left + plotW / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">{day(now, Math.floor(n / 2))}</text>
        <text x={width - M.right} y={HEIGHT - 8} textAnchor="end" className="fill-muted-foreground text-[11px]">{day(now, 0)}</text>
        <g className="transition-opacity duration-150" style={{ opacity: hover === null ? 0 : 1 }}>
          <line
            y1={M.top} y2={M.top + plotH} stroke="hsl(var(--foreground))" strokeOpacity="0.2"
            style={{ transform: `translateX(${x(at)}px)`, transition: FOLLOW }}
          />
          <circle
            r="4" fill="currentColor" stroke="hsl(var(--card))" strokeWidth="2"
            style={{ transform: `translate(${x(at)}px, ${y(metric.series[at])}px)`, transition: FOLLOW }}
          />
        </g>
      </svg>
      <div
        className="pointer-events-none absolute left-0 top-2 z-10 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[12px] text-popover-foreground shadow-sm"
        style={{
          opacity: hover === null ? 0 : 1,
          transform: `translateX(calc(${Math.min(Math.max(x(at), 70), width - 70)}px - 50%))`,
          transition: `${FOLLOW}, opacity 125ms ease`,
        }}
      >
        <p className="text-muted-foreground">{day(now, n - 1 - at)}</p>
        <p className="font-medium tabular-nums">{metric.series[at]} {name}</p>
        <p className="tabular-nums text-muted-foreground">Previous {metric.priorSeries[at]}</p>
      </div>
    </div>
  );
}

function change({ total, prior }: CountMetric): string {
  if (prior === 0) return total === 0 ? 'No change' : 'New this period';
  const pct = Math.round(((total - prior) / prior) * 100);
  return pct === 0 ? 'No change' : `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}%`;
}

function changeBadge(metric: CountMetric, goodWhenUp: boolean) {
  const text = change(metric);
  const up = text.startsWith('Up');
  const down = text.startsWith('Down');
  const tone = !up && !down ? 'calm' : up === goodWhenUp ? 'done' : 'urgent';
  return <span className={cn('rounded-md px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums', TINT[tone])}>{text}</span>;
}

export function ActivityChart({ metrics, now, usage, index }: { metrics: DashboardMetrics; now: number; usage: string | null; index: number }) {
  const tabs = [
    { key: 'sent', name: 'ISFs sent', metric: metrics.isfSent, colour: 'hsl(var(--info-fill))', bar: FILL.info, goodWhenUp: true },
    { key: 'accepted', name: 'ISFs accepted', metric: metrics.isfAccepted, colour: 'hsl(var(--done-fill))', bar: FILL.done, goodWhenUp: true },
    { key: 'rejected', name: 'ISFs rejected', metric: metrics.isfRejected, colour: 'hsl(var(--urgent-fill))', bar: FILL.urgent, goodWhenUp: false },
    ...(metrics.entriesAccepted ? [{ key: 'entries', name: 'Entries accepted', metric: metrics.entriesAccepted, colour: 'hsl(var(--entry-fill))', bar: FILL.entry, goodWhenUp: true }] : []),
  ];
  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <section aria-labelledby="activity-title" className="dash-in min-w-0 rounded-xl border border-border/70 bg-card shadow-card" style={{ '--i': index } as React.CSSProperties}>
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
              className="relative min-w-[132px] flex-1 pb-3 pr-4 text-left outline-none focus-visible:underline"
            >
              <span className="block text-[12.5px] text-muted-foreground">{t.name}</span>
              <span className={cn('mt-0.5 block text-[20px] font-semibold leading-7 tracking-[-0.015em] tabular-nums transition-colors duration-150', on ? 'text-foreground' : 'text-muted-foreground can-hover:hover:text-foreground')}>{t.metric.total.toLocaleString()}</span>
              <span className="mt-1 block">{changeBadge(t.metric, t.goodWhenUp)}</span>
              {on && <motion.span layoutId="activity-tab" className={cn('absolute inset-x-0 -bottom-px h-0.5 rounded-full', t.bar)} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} />}
            </button>
          );
        })}
      </div>
      <div className="px-3 pb-2 pt-3">
        <Plot metric={current.metric} name={current.name} now={now} colour={current.colour} />
        <div className="flex gap-4 px-1 pb-1 pl-[34px] text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className={cn('h-0.5 w-3.5 rounded-full transition-colors duration-150', current.bar)} />This period</span>
          <span className="flex items-center gap-1.5"><i className="w-3.5 border-t border-dashed border-muted-foreground" />Previous {metrics.windowDays} days</span>
        </div>
      </div>
    </section>
  );
}
