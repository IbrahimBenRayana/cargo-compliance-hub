import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Archive, Calendar, Clock, FileText, ArrowRight } from 'lucide-react';
import { complianceApi, type LiquidationTracked } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Records & Liquidation tab.
 *
 * Liquidation tracker is the main feature: every accepted filing gets its
 * 314-day liquidation countdown + 270-day PSC window + (post-liquidation)
 * 180-day protest deadline. CBP regulations (19 CFR § 159.11 + 19 USC §
 * 1514) define these windows; the UI helps the importer plan PSCs and
 * protests before they expire.
 */
export function RecordsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance', 'liquidation-tracker'],
    queryFn: () => complianceApi.liquidationTracker(),
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      <LiquidationOverview tracked={data.tracked} />
      <LiquidationTable tracked={data.tracked} />
    </div>
  );
}

// ─── Overview tiles ─────────────────────────────────────────────────

function LiquidationOverview({ tracked }: { tracked: LiquidationTracked[] }) {
  const counts = useMemo(() => {
    const c = { psc: 0, awaiting: 0, liquidated: 0, totalDuties: 0 };
    for (const t of tracked) {
      if (t.status === 'psc-window-open') c.psc++;
      else if (t.status === 'awaiting-liquidation') c.awaiting++;
      else if (t.status === 'liquidated') c.liquidated++;
    }
    return c;
  }, [tracked]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <OverviewTile
        icon={<FileText className="h-3.5 w-3.5" />}
        label="Tracked entries"
        value={tracked.length}
        sub="Accepted filings"
        tone="neutral"
      />
      <OverviewTile
        icon={<Calendar className="h-3.5 w-3.5" />}
        label="PSC open"
        value={counts.psc}
        sub="≤ 270 days post-entry"
        tone="amber"
      />
      <OverviewTile
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Awaiting liquidation"
        value={counts.awaiting}
        sub="270 – 314 days"
        tone="amber"
      />
      <OverviewTile
        icon={<Archive className="h-3.5 w-3.5" />}
        label="Liquidated"
        value={counts.liquidated}
        sub="Protest window open 180d"
        tone="emerald"
      />
    </div>
  );
}

type Tone = 'neutral' | 'amber' | 'emerald';
function OverviewTile({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  tone: Tone;
}) {
  const colors =
    tone === 'amber'    ? 'bg-amber-50/80 ring-amber-200/60 text-amber-700 dark:bg-amber-500/10 dark:ring-amber-500/20 dark:text-amber-300'
    : tone === 'emerald' ? 'bg-emerald-50/80 ring-emerald-200/60 text-emerald-700 dark:bg-emerald-500/10 dark:ring-emerald-500/20 dark:text-emerald-300'
    :                      'bg-slate-50 ring-slate-200 text-slate-900 dark:bg-slate-900 dark:ring-slate-800 dark:text-slate-50';
  return (
    <div className={cn('rounded-xl px-4 py-3 ring-1', colors)}>
      <div className="flex items-center gap-1.5 mb-1.5 opacity-80">
        {icon}
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <div className="text-[22px] font-semibold leading-none tabular-nums">{value}</div>
      <div className="text-[11px] opacity-70 mt-1">{sub}</div>
    </div>
  );
}

// ─── Table ──────────────────────────────────────────────────────────

function LiquidationTable({ tracked }: { tracked: LiquidationTracked[] }) {
  // Sort: most-urgent PSC deadlines first, then days until liquidation.
  // useMemo before any early return so the hook order stays stable across renders.
  const sorted = useMemo(
    () =>
      [...tracked].sort((a, b) => {
        const order = { 'psc-window-open': 0, 'awaiting-liquidation': 1, 'liquidated': 2, 'pending': 3 };
        const cmp = order[a.status] - order[b.status];
        if (cmp !== 0) return cmp;
        return a.daysUntilLiquidation - b.daysUntilLiquidation;
      }),
    [tracked],
  );

  if (tracked.length === 0) {
    return (
      <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-10 text-center">
        <Archive className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1">
          No accepted entries yet
        </p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Once CBP accepts an entry, its liquidation countdown will appear here.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 ring-1 ring-slate-500/40 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.5)] flex items-center justify-center shrink-0">
          <Archive className="h-5 w-5 text-slate-50" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
            Liquidation tracker
          </h3>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Sorted by urgency. PSC = Post-Summary Correction (270d); liquidation = entry finalization (314d).
          </p>
        </div>
      </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] font-semibold text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2.5">Filing</th>
                <th className="px-4 py-2.5">Entry date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">PSC deadline</th>
                <th className="px-4 py-2.5">Liquidation</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sorted.map((t) => (
                <LiquidationRow key={t.filingId} t={t} />
              ))}
            </tbody>
          </table>
        </div>
    </article>
  );
}

function LiquidationRow({ t }: { t: LiquidationTracked }) {
  const sevBadge =
    t.status === 'psc-window-open'      ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
    : t.status === 'awaiting-liquidation' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30'
    : t.status === 'liquidated'           ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
    :                                       'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30';
  const statusLabel =
    t.status === 'psc-window-open'      ? 'PSC open'
    : t.status === 'awaiting-liquidation' ? 'Awaiting liq.'
    : t.status === 'liquidated'           ? 'Liquidated'
    :                                       'Pending';

  const pscColor =
    t.daysUntilPscDeadline < 0 ? 'text-slate-400'
    : t.daysUntilPscDeadline <= 14 ? 'text-rose-600 dark:text-rose-400 font-semibold'
    : t.daysUntilPscDeadline <= 60 ? 'text-amber-700 dark:text-amber-400 font-medium'
    : 'text-slate-700 dark:text-slate-300';
  const liqColor =
    t.daysUntilLiquidation < 0 ? 'text-slate-400'
    : t.daysUntilLiquidation <= 14 ? 'text-rose-600 dark:text-rose-400 font-semibold'
    : t.daysUntilLiquidation <= 60 ? 'text-amber-700 dark:text-amber-400 font-medium'
    : 'text-slate-700 dark:text-slate-300';

  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-2.5 font-mono font-semibold text-slate-900 dark:text-slate-50">
        {t.bol}
      </td>
      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 tabular-nums">
        {fmtDate(t.entryDate)}
      </td>
      <td className="px-4 py-2.5">
        <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', sevBadge)}>
          {statusLabel}
        </Badge>
      </td>
      <td className={cn('px-4 py-2.5 tabular-nums', pscColor)}>
        {t.daysUntilPscDeadline < 0
          ? 'expired'
          : `${t.daysUntilPscDeadline}d (${fmtDate(t.pscDeadline)})`}
      </td>
      <td className={cn('px-4 py-2.5 tabular-nums', liqColor)}>
        {t.daysUntilLiquidation < 0
          ? 'liquidated'
          : `${t.daysUntilLiquidation}d (${fmtDate(t.estimatedLiquidationAt)})`}
      </td>
      <td className="px-4 py-2.5 text-right">
        <Link
          to={`/shipments/${t.filingId}`}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}
