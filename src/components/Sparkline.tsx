import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  /** Daily series ordered oldest → newest. Ideally 14 points. Empty / single-point is rendered as a flat line. */
  series: number[];
  /** Tone tints the line. Defaults to muted-foreground for neutral KPIs. */
  tone?: 'neutral' | 'emerald' | 'amber' | 'rose' | 'primary';
  /** SVG width / height in px. Default sized for the KPI card slot. */
  width?: number;
  height?: number;
  className?: string;
  /** Filled area under the line, low alpha. Off by default — Stripe/Linear lean line-only. */
  filled?: boolean;
}

const TONE_STROKE: Record<NonNullable<SparklineProps['tone']>, string> = {
  neutral: 'text-muted-foreground/70',
  emerald: 'text-emerald-500',
  amber:   'text-amber-500',
  rose:    'text-red-500',
  primary: 'text-primary',
};

/**
 * Tiny inline trend line. Pure SVG, no chart library.
 * - Smooth quadratic-bezier path between points (looks less jagged than straight lines at this size).
 * - Last point gets a 1.5px filled circle so the user has something to read as "current".
 * - Optional area fill via gradient stop (off by default — too noisy for a KPI strip).
 * - Flat-line fallback when series is empty / has < 2 distinct values.
 */
export function Sparkline({
  series,
  tone = 'neutral',
  width = 64,
  height = 24,
  className,
  filled = false,
}: SparklineProps) {
  const gradientId = useId();
  const points = useMemo(() => normaliseToPoints(series, width, height), [series, width, height]);

  if (points.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn(TONE_STROKE[tone], className)}
        aria-hidden
      >
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const linePath = points.length === 1
    ? `M ${points[0].x} ${points[0].y} L ${width} ${points[0].y}`
    : buildSmoothPath(points);

  const areaPath = filled ? `${linePath} L ${width} ${height} L 0 ${height} Z` : null;
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(TONE_STROKE[tone], className)}
      aria-hidden
    >
      {filled && (
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
      )}

      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx={last.x} cy={last.y} r={1.5} fill="currentColor" />
    </svg>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

interface Point { x: number; y: number }

function normaliseToPoints(series: number[], width: number, height: number): Point[] {
  if (!series || series.length === 0) return [];

  // One point: render at vertical centre.
  if (series.length === 1) {
    return [{ x: 0, y: height / 2 }];
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min;

  // Pad inward by ~1.5px so the line + end-cap don't clip the SVG edges.
  const padX = 1;
  const padY = 2;
  const innerW = Math.max(1, width  - padX * 2);
  const innerH = Math.max(1, height - padY * 2);
  const stepX  = innerW / (series.length - 1);

  return series.map((value, i) => {
    // Flat series → centre the line. Otherwise normalise to [padY, height-padY].
    const norm = span === 0 ? 0.5 : (value - min) / span;
    return {
      x: padX + i * stepX,
      // Flip Y so larger values sit higher.
      y: padY + (1 - norm) * innerH,
    };
  });
}

/**
 * Quadratic-Bezier smoothing using midpoint-as-control: gives a soft curve
 * with no overshoot at endpoints. Cheaper and more stable than a Catmull-Rom
 * spline at this resolution.
 */
function buildSmoothPath(pts: Point[]): string {
  if (pts.length < 2) return '';

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    if (i === 1) {
      d += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
    } else {
      d += ` T ${midX} ${midY}`;
    }
  }
  // Pin the last segment to the final point so the end-cap dot lands on a real value.
  d += ` T ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}
