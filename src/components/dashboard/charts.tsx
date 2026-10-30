/** Small charts drawn to scale from real series. Each one states its data in words too. */
import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Sums a daily series into wider steps, so the shape reads as a trend rather than noise. */
function coarsen(series: number[], step: number): number[] {
  const out: number[] = [];
  for (let end = series.length; end > 0; end -= step) {
    out.unshift(series.slice(Math.max(0, end - step), end).reduce((a, b) => a + b, 0));
  }
  return out;
}

/** A curve through the points that never overshoots them, so it cannot imply a value that did not happen. */
function smoothPath(pts: number[][]): string {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mid = (x0 + x1) / 2;
    d += ` C${mid.toFixed(1)} ${y0.toFixed(1)} ${mid.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

/** A filled trend line that ends on an emphasised latest point. */
export function SparkArea({ series, label, className }: { series: number[]; label: string; className?: string }) {
  const id = useId();
  const w = 120;
  const h = 44;
  const pad = 5;
  const points = coarsen(series, 3);
  const max = Math.max(...points, 1);
  const pts = points.map((v, i) => [
    pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2),
    h - pad - (v / max) * (h - pad * 2),
  ]);
  const line = smoothPath(pts);
  const end = pts[pts.length - 1];
  const area = `${line} L${end[0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={cn('draw-line h-11 w-full text-primary', className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={end[0]} cy={end[1]} r="2.5" fill="currentColor" className="fade-late" />
    </svg>
  );
}

/** A progress ring. Null means there is nothing to measure yet, which draws an empty ring. */
export function Ring({ percent, size = 132, stroke = 10, children }: { percent: number | null; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const offset = length * (1 - (percent ?? 0) / 100);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--foreground) / 0.07)" strokeWidth={stroke} />
        {percent !== null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--done-fg))" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={length} strokeDashoffset={offset} className="draw-ring"
            style={{ '--ring-length': length } as React.CSSProperties}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Thin columns with a hover readout. `tone` picks each column's colour. */
export function Columns({ values, labelFor, tone, label, className }: {
  values: number[];
  labelFor: (i: number, v: number) => string;
  tone: (i: number) => string;
  label: string;
  className?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div role="img" aria-label={label} className={cn('flex h-full items-end gap-[3px]', className)}>
      {values.map((v, i) => (
        <div key={i} className="group/bar relative flex h-full min-w-0 flex-1 items-end">
          <div
            className={cn('grow-y w-full rounded-t-[3px] rounded-b-[1px] transition-opacity duration-150 can-hover:group-hover/bar:opacity-80', tone(i))}
            style={{ height: v ? `${Math.max((v / max) * 100, 7)}%` : '2px', opacity: v ? undefined : 0.3, '--i': i } as React.CSSProperties}
          />
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[12px] font-medium text-popover-foreground shadow-popover group-hover/bar:block">
            {labelFor(i, v)}
          </span>
        </div>
      ))}
    </div>
  );
}
