import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Archive, Calendar, Clock, FileText, ArrowRight, Search,
  AlertTriangle, type LucideIcon,
} from 'lucide-react';
import { complianceApi, type LiquidationTracked } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Records & Liquidation tab — every accepted filing's 314-day liquidation
 * countdown plus 270-day PSC window. Three layout sections:
 *
 *   1. KPI strip (tracked / PSC open / awaiting / liquidated)
 *   2. Filter bar (search + status chips)
 *   3. Entry cards — each shows MBOL, entry date, status pill, days-to-
 *      deadline pills, and a horizontal progress bar showing position
 *      within the 314-day liquidation window. Urgent items rise to top.
 *
 * Regulatory references: 19 CFR § 159.11 (liquidation) and 19 USC § 1514
 * (protest), via the existing computeLiquidation server service.
 */
export function RecordsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance', 'liquidation-tracker'],
    queryFn: () => complianceApi.liquidationTracker(),
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) return <RecordsSkeleton />;

  return <RecordsContent tracked={data.tracked} />;
}

function RecordsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[112px] rounded-2xl" />)}
      </div>
      <Skeleton className="h-[400px] rounded-2xl" />
    </div>
  );
}

// ─── Content ────────────────────────────────────────────────────────

type StatusFilter = LiquidationTracked['status'] | 'all';

function RecordsContent({ tracked }: { tracked: LiquidationTracked[] }) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c = { psc: 0, awaiting: 0, liquidated: 0, pending: 0 };
    for (const t of tracked) {
      if (t.status === 'psc-window-open') c.psc++;
      else if (t.status === 'awaiting-liquidation') c.awaiting++;
      else if (t.status === 'liquidated') c.liquidated++;
      else if (t.status === 'pending') c.pending++;
    }
    return c;
  }, [tracked]);

  const sorted = useMemo(() => {
    return [...tracked].sort((a, b) => {
      const order = { 'psc-window-open': 0, 'awaiting-liquidation': 1, 'liquidated': 2, 'pending': 3 };
      const cmp = order[a.status] - order[b.status];
      if (cmp !== 0) return cmp;
      return a.daysUntilLiquidation - b.daysUntilLiquidation;
    });
  }, [tracked]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.bol.toLowerCase().includes(q) ||
        t.filingType.toLowerCase().includes(q)
      );
    });
  }, [sorted, filter, search]);

  return (
    <div className="space-y-5">
      <RecordsKpiStrip total={tracked.length} counts={counts} />
      <PipelineCard
        all={sorted}
        filtered={filtered}
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        search={search}
        onSearchChange={setSearch}
      />
    </div>
  );
}

// ─── KPI hero strip ─────────────────────────────────────────────────

function RecordsKpiStrip({
  total, counts,
}: {
  total: number;
  counts: { psc: number; awaiting: number; liquidated: number; pending: number };
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiTile
        label="Tracked"
        value={total}
        sub="accepted entries"
        tone="slate"
        Icon={FileText}
      />
      <KpiTile
        label="PSC open"
        value={counts.psc}
        sub="≤ 270 days post-entry"
        tone="amber"
        Icon={Calendar}
      />
      <KpiTile
        label="Awaiting liquidation"
        value={counts.awaiting}
        sub="270 – 314 days"
        tone="blue"
        Icon={Clock}
      />
      <KpiTile
        label="Liquidated"
        value={counts.liquidated}
        sub="protest open 180d"
        tone="emerald"
        Icon={Archive}
      />
    </div>
  );
}

type KpiTone = 'slate' | 'amber' | 'blue' | 'emerald';

function KpiTile({
  label, value, sub, tone, Icon,
}: {
  label: string;
  value: number;
  sub: string;
  tone: KpiTone;
  Icon: LucideIcon;
}) {
  const palette = TONE_PALETTE[tone];
  const animated = useCountUp(value, 700);

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-950 px-5 py-4',
        palette.border,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-[60%] pointer-events-none"
        style={{ background: palette.wash }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            'h-9 w-9 rounded-xl ring-1 flex items-center justify-center shrink-0',
            palette.iconBg,
          )}
        >
          <Icon className={cn('h-[18px] w-[18px]', palette.iconFg)} strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[10.5px] font-semibold uppercase tracking-[0.1em]', palette.labelFg)}>
            {label}
          </p>
          <p className="text-[28px] font-semibold tabular-nums leading-none mt-1 text-slate-900 dark:text-slate-50">
            {animated.toLocaleString()}
          </p>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">
            {sub}
          </p>
        </div>
      </div>
    </article>
  );
}

const TONE_PALETTE: Record<KpiTone, {
  border: string; wash: string; iconBg: string; iconFg: string; labelFg: string;
}> = {
  slate: {
    border:  'border-slate-200 dark:border-slate-800',
    wash:    'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(215 16% 47% / 0.06), transparent 70%)',
    iconBg:  'bg-slate-100 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700/60',
    iconFg:  'text-slate-600 dark:text-slate-300',
    labelFg: 'text-slate-500 dark:text-slate-400',
  },
  amber: {
    border:  'border-amber-200/70 dark:border-amber-500/25',
    wash:    'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(43 96% 56% / 0.10), transparent 70%)',
    iconBg:  'bg-amber-100 ring-amber-200/60 dark:bg-amber-500/15 dark:ring-amber-500/30',
    iconFg:  'text-amber-700 dark:text-amber-300',
    labelFg: 'text-amber-700 dark:text-amber-300',
  },
  blue: {
    border:  'border-blue-200/70 dark:border-blue-500/25',
    wash:    'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(217 91% 60% / 0.09), transparent 70%)',
    iconBg:  'bg-blue-100 ring-blue-200/60 dark:bg-blue-500/15 dark:ring-blue-500/30',
    iconFg:  'text-blue-700 dark:text-blue-300',
    labelFg: 'text-blue-700 dark:text-blue-300',
  },
  emerald: {
    border:  'border-emerald-200/70 dark:border-emerald-500/25',
    wash:    'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(160 70% 40% / 0.09), transparent 70%)',
    iconBg:  'bg-emerald-100 ring-emerald-200/60 dark:bg-emerald-500/15 dark:ring-emerald-500/30',
    iconFg:  'text-emerald-700 dark:text-emerald-300',
    labelFg: 'text-emerald-700 dark:text-emerald-300',
  },
};

// ─── Pipeline (filter + list) ───────────────────────────────────────

function PipelineCard({
  all, filtered, filter, onFilterChange, counts, search, onSearchChange,
}: {
  all: LiquidationTracked[];
  filtered: LiquidationTracked[];
  filter: StatusFilter;
  onFilterChange: (s: StatusFilter) => void;
  counts: { psc: number; awaiting: number; liquidated: number; pending: number };
  search: string;
  onSearchChange: (s: string) => void;
}) {
  if (all.length === 0) {
    return (
      <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 ring-1 ring-slate-300/60 dark:ring-slate-500/40 shadow-[0_8px_20px_-10px_rgba(71,85,105,0.5)] flex items-center justify-center mb-3">
          <Archive className="h-6 w-6 text-slate-50" strokeWidth={2.5} />
        </div>
        <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-50 mb-1">
          No accepted entries yet
        </p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          Once CBP accepts an entry, its 314-day liquidation countdown and 270-day PSC window will appear here.
        </p>
      </article>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 0%, hsl(217 91% 60% / 0.06), transparent 70%)',
        }}
      />
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 ring-1 ring-slate-500/40 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.5)] flex items-center justify-center shrink-0">
            <Archive className="h-5 w-5 text-slate-50" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
              Liquidation pipeline
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              Sorted by urgency. PSC = Post-Summary Correction (270d); liquidation = entry finalization (314d).
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search BOL or filing type…"
              className="pl-9 text-[13px]"
            />
          </div>
          <StatusChips value={filter} onChange={onFilterChange} counts={counts} />
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-6 py-10 text-center">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              No entries match the current filters.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((t) => <PipelineRow key={t.filingId} t={t} />)}
          </ul>
        )}
      </div>
    </article>
  );
}

function StatusChips({
  value, onChange, counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: { psc: number; awaiting: number; liquidated: number; pending: number };
}) {
  const chips: Array<{ id: StatusFilter; label: string; count?: number; active: string }> = [
    { id: 'all',                  label: 'All',         active: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' },
    { id: 'psc-window-open',      label: 'PSC',         count: counts.psc,        active: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950' },
    { id: 'awaiting-liquidation', label: 'Awaiting',    count: counts.awaiting,   active: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-blue-50' },
    { id: 'liquidated',           label: 'Liquidated',  count: counts.liquidated, active: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-50' },
  ];
  return (
    <div className="flex gap-1.5 shrink-0 flex-wrap">
      {chips.map((c) => {
        const isActive = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-[12px] font-semibold transition-colors cursor-pointer',
              isActive
                ? c.active
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            {c.label}
            {c.count !== undefined && (
              <span className={cn(
                'tabular-nums text-[11px] font-semibold',
                isActive ? 'opacity-90' : 'opacity-60',
              )}>
                {c.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PipelineRow({ t }: { t: LiquidationTracked }) {
  const reducedMotion = useReducedMotion();
  const tone = STATUS_TONE[t.status];

  // Position within the 314-day liquidation window (0% = entry, 100% = liquidation).
  const TOTAL = 314;
  const elapsed = TOTAL - Math.max(0, t.daysUntilLiquidation);
  const pct = Math.max(0, Math.min(100, (elapsed / TOTAL) * 100));
  const pscMarker = (270 / TOTAL) * 100; // PSC deadline at 270d
  // Bar fill colour by remaining-days urgency, not status.
  const barFill =
    t.daysUntilLiquidation < 0 ? 'bg-slate-300 dark:bg-slate-700'
    : t.daysUntilLiquidation <= 14 ? 'bg-gradient-to-r from-rose-400 to-rose-600'
    : t.daysUntilLiquidation <= 60 ? 'bg-gradient-to-r from-amber-300 to-amber-500'
    : 'bg-gradient-to-r from-blue-300 to-blue-500';

  const pscColor =
    t.daysUntilPscDeadline < 0 ? 'text-slate-400'
    : t.daysUntilPscDeadline <= 14 ? 'text-rose-600 dark:text-rose-400 font-semibold'
    : t.daysUntilPscDeadline <= 60 ? 'text-amber-700 dark:text-amber-400 font-medium'
    : 'text-slate-600 dark:text-slate-400';
  const liqColor =
    t.daysUntilLiquidation < 0 ? 'text-slate-400'
    : t.daysUntilLiquidation <= 14 ? 'text-rose-600 dark:text-rose-400 font-semibold'
    : t.daysUntilLiquidation <= 60 ? 'text-amber-700 dark:text-amber-400 font-medium'
    : 'text-slate-600 dark:text-slate-400';

  return (
    <motion.li
      layout={reducedMotion ? false : true}
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        to={`/shipments/${t.filingId}`}
        className={cn(
          'group relative block rounded-xl border bg-white dark:bg-slate-900/40 transition-colors',
          tone.ring,
          'hover:border-slate-300 dark:hover:border-slate-700',
        )}
      >
        <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', tone.rail)} />
        <div className="pl-5 pr-4 py-3">
          {/* Top row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-mono font-semibold text-slate-900 dark:text-slate-50">
              {t.bol}
            </span>
            <Badge variant="outline" className={cn('text-[10px] font-bold uppercase tracking-[0.06em]', tone.badge)}>
              {tone.label}
            </Badge>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-[0.06em]">
              {t.filingType}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              entered {fmtDate(t.entryDate)}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight className="h-3 w-3" />
            </span>
          </div>

          {/* Deadline tiles */}
          <div className="flex flex-wrap gap-2 mt-2">
            <DeadlineTile
              label="PSC deadline"
              color={pscColor}
              value={t.daysUntilPscDeadline < 0 ? 'expired' : `${t.daysUntilPscDeadline}d`}
              sub={fmtDate(t.pscDeadline)}
            />
            <DeadlineTile
              label="Liquidation"
              color={liqColor}
              value={t.daysUntilLiquidation < 0 ? 'liquidated' : `${t.daysUntilLiquidation}d`}
              sub={fmtDate(t.estimatedLiquidationAt)}
            />
            {t.daysUntilPscDeadline >= 0 && t.daysUntilPscDeadline <= 14 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/15 px-2 py-1 rounded">
                <AlertTriangle className="h-3 w-3" />
                File PSC corrections this week
              </span>
            )}
          </div>

          {/* Progress through 314-day window */}
          <div className="mt-3 relative">
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
              <div
                className={cn('h-full rounded-full', barFill)}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* PSC marker */}
            <div
              aria-hidden
              className="absolute top-[-2px] h-[10px] w-px bg-slate-400 dark:bg-slate-500"
              style={{ left: `${pscMarker}%` }}
              title="PSC deadline (270d)"
            />
            <div className="flex justify-between text-[10px] tabular-nums text-slate-400 dark:text-slate-500 mt-1">
              <span>entry</span>
              <span style={{ marginLeft: `${pscMarker - 50}%` }}>PSC 270d</span>
              <span>liquidation 314d</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

const STATUS_TONE: Record<LiquidationTracked['status'], {
  label: string; ring: string; rail: string; badge: string;
}> = {
  'psc-window-open': {
    label: 'PSC open',
    ring:  'border-amber-200/70 dark:border-amber-500/25',
    rail:  'bg-gradient-to-b from-amber-300 to-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  },
  'awaiting-liquidation': {
    label: 'Awaiting liq.',
    ring:  'border-blue-200/70 dark:border-blue-500/25',
    rail:  'bg-gradient-to-b from-blue-300 to-blue-500',
    badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  },
  'liquidated': {
    label: 'Liquidated',
    ring:  'border-emerald-200/70 dark:border-emerald-500/25',
    rail:  'bg-gradient-to-b from-emerald-300 to-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  'pending': {
    label: 'Pending',
    ring:  'border-slate-200 dark:border-slate-800',
    rail:  'bg-gradient-to-b from-slate-300 to-slate-500',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
  },
};

function DeadlineTile({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="inline-flex flex-col rounded-md ring-1 ring-slate-200 dark:ring-slate-800 px-2.5 py-1.5 bg-slate-50/60 dark:bg-slate-900/40">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className={cn('text-[12.5px] tabular-nums leading-tight', color)}>
        {value} <span className="text-slate-400 dark:text-slate-500 font-normal">· {sub}</span>
      </span>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(target);
  const startRef = useRef<number | null>(null);
  const startValueRef = useRef(target);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setValue(target);
      return;
    }
    startRef.current = null;
    startValueRef.current = value;
    let raf = 0;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(startValueRef.current + (target - startValueRef.current) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, reducedMotion]);

  return value;
}
