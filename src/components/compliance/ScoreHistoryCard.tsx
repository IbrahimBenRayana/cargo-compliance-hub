import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Info } from 'lucide-react';
import { complianceApi, type ScoreHistoryPoint } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Compliance score trajectory for a single filing.
 *
 * Renders a 200×64 SVG sparkline of the filing's status-band scores over
 * time, plus a compact event ticker (one row per status transition). The
 * line is rounded; positive trends are emerald, negative are rose, flat
 * is slate. Hover the chart to read the value at each transition.
 *
 * Scores are status-band approximations — see the backend route
 * (GET /filings/:id/score-history) for the mapping rationale.
 */
export function ScoreHistoryCard({ filingId }: { filingId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['compliance', 'score-history', filingId],
    queryFn: () => complianceApi.scoreHistory(filingId),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  if (isError || !data) return null;

  // Nothing meaningful to show if there's only one point.
  if (data.points.length < 2) {
    return (
      <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '250ms', animationFillMode: 'forwards' }}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Compliance score history</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[12.5px] text-muted-foreground">
            Score trajectory will appear here once this filing has been submitted and reviewed by CBP.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '250ms', animationFillMode: 'forwards' }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Compliance score history</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10.5px] font-bold uppercase tabular-nums">
            Now {data.currentScore}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Sparkline points={data.points} />
        <EventTicker points={data.points} />
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground border-t border-slate-200 dark:border-slate-800 pt-2.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{data.note}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sparkline ──────────────────────────────────────────────────────

function Sparkline({ points }: { points: ScoreHistoryPoint[] }) {
  const W = 600;
  const H = 80;
  const PAD_X = 6;
  const PAD_Y = 10;

  const layout = useMemo(() => {
    const xs = points.map((_, i) => PAD_X + (i / Math.max(1, points.length - 1)) * (W - 2 * PAD_X));
    // Map 0-100 → top-bottom (higher score = higher on screen).
    const ys = points.map((p) => PAD_Y + (1 - p.score / 100) * (H - 2 * PAD_Y));
    return { xs, ys };
  }, [points]);

  const path = useMemo(() => {
    if (points.length === 0) return '';
    return layout.xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${layout.ys[i]!.toFixed(1)}`).join(' ');
  }, [layout, points]);

  const fillPath = useMemo(() => {
    if (points.length === 0) return '';
    return `${path} L${layout.xs[layout.xs.length - 1]!.toFixed(1)} ${H - PAD_Y} L${layout.xs[0]!.toFixed(1)} ${H - PAD_Y} Z`;
  }, [path, layout, points.length]);

  // Trend colour: compare first and last score.
  const trend =
    points[points.length - 1]!.score > points[0]!.score ? 'up'
    : points[points.length - 1]!.score < points[0]!.score ? 'down'
    : 'flat';
  const stroke =
    trend === 'up'   ? 'hsl(160 70% 40%)'   // emerald
    : trend === 'down' ? 'hsl(0 70% 50%)'   // rose
    : 'hsl(215 16% 47%)';                   // slate

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="score-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline at 50 for visual reference */}
        <line
          x1={PAD_X} x2={W - PAD_X}
          y1={PAD_Y + 0.5 * (H - 2 * PAD_Y)} y2={PAD_Y + 0.5 * (H - 2 * PAD_Y)}
          stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3"
        />
        <path d={fillPath} fill="url(#score-fill)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={layout.xs[i]} cy={layout.ys[i]}
              r="3.5"
              fill="white"
              stroke={stroke}
              strokeWidth="1.5"
            />
            <title>{`${fmtAt(p.at)} · ${labelFor(p.status)} · ${p.score}/100`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Event ticker ───────────────────────────────────────────────────

function EventTicker({ points }: { points: ScoreHistoryPoint[] }) {
  // Collapse the synthetic trailing "now" point into the last real event
  // if their statuses match, so the ticker doesn't duplicate the final row.
  const visible = points.filter((p, i, arr) => {
    if (i === arr.length - 1 && i > 0 && arr[i - 1]!.status === p.status) return false;
    return true;
  });

  return (
    <ul className="space-y-1">
      {visible.map((p, i) => {
        const prev = i > 0 ? visible[i - 1]! : null;
        const delta = prev ? p.score - prev.score : 0;
        const deltaLabel =
          delta > 0 ? `+${delta}` :
          delta < 0 ? `${delta}` : '—';
        const deltaColor =
          delta > 0 ? 'text-emerald-600 dark:text-emerald-400' :
          delta < 0 ? 'text-rose-600 dark:text-rose-400' :
          'text-slate-400';
        return (
          <li key={`${p.at}-${i}`} className="flex items-center gap-3 text-[12px]">
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 w-24 shrink-0">
              {fmtAt(p.at)}
            </span>
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded shrink-0',
              STATUS_TONE[p.status] ?? STATUS_TONE.default,
            )}>
              {labelFor(p.status)}
            </span>
            <span className="text-slate-700 dark:text-slate-300 tabular-nums w-12 shrink-0">{p.score}/100</span>
            <span className={cn('font-semibold tabular-nums w-10 shrink-0', deltaColor)}>{deltaLabel}</span>
            {p.message && (
              <span className="text-slate-500 dark:text-slate-400 truncate">{p.message}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  on_hold:   'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  rejected:  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  accepted:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amended:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  default:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function labelFor(status: string): string {
  if (status === 'on_hold') return 'On hold';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function fmtAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}
