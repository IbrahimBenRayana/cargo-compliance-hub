import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { complianceApi, type ScoreHistoryPoint } from '@/api/client';
import { cn } from '@/lib/utils';
import { statusOf } from '@/components/shipments/status';
import { StatusPill } from '@/components/shipments/StatusPill';

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
const PANEL = 'rounded-xl border border-border/70 bg-card p-5 shadow-card';

function Title() {
  return (
    <h2 className="text-[15px] font-semibold">Compliance score history</h2>
  );
}

export function ScoreHistoryCard({ filingId }: { filingId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['compliance', 'score-history', filingId],
    queryFn: () => complianceApi.scoreHistory(filingId),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="dash-sk h-32 rounded-xl" />;
  if (isError || !data) return null;

  // Nothing meaningful to show if there's only one point.
  if (data.points.length < 2) {
    return (
      <section aria-label="Compliance score history" className={PANEL}>
        <Title />
        <p className="mt-2 text-[13px] text-muted-foreground">
          The score's history shows here once this ISF has been sent and CBP has answered.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Compliance score history" className={PANEL}>
      <div className="flex items-center justify-between gap-2">
        <Title />
        <span className="rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium tabular-nums">Now {data.currentScore}/100</span>
      </div>
      <div className="mt-4 space-y-4">
        <Sparkline points={data.points} />
        <EventTicker points={data.points} />
        <div className="flex items-start gap-1.5 border-t border-border/70 pt-2.5 text-[12px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{data.note}</span>
        </div>
      </div>
    </section>
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
            <title>{`${fmtAt(p.at)} · ${statusOf(p.status).word} · ${p.score}/100`}</title>
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
            <StatusPill status={p.status} className="shrink-0" />
            <span className="text-slate-700 dark:text-slate-300 tabular-nums w-12 shrink-0">{p.score}/100</span>
            <span className={cn('font-semibold tabular-nums w-10 shrink-0', deltaColor)}>{deltaLabel}</span>
            {/* Snapshot enrichment: validation breakdown shown inline when available */}
            {p.breakdown && (p.breakdown.critical + p.breakdown.warning + p.breakdown.info) > 0 && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                {p.breakdown.critical > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">{p.breakdown.critical}c</span>
                )}
                {p.breakdown.warning > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">{p.breakdown.warning}w</span>
                )}
                {p.breakdown.info > 0 && (
                  <span className="text-slate-500 dark:text-slate-400">{p.breakdown.info}i</span>
                )}
              </span>
            )}
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

function fmtAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}
