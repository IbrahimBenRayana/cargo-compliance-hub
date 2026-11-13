import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Archive, Calendar, Clock, FileText, ArrowRight, Search,
  AlertTriangle, type IconType,
} from '@/components/icons';
import { complianceApi, type LiquidationTracked } from '@/api/client';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Records & Liquidation tab: every accepted entry's 314-day liquidation
 * countdown plus 300-day PSC window. Three layout sections:
 *
 *   1. KPI strip (tracked / PSC open / awaiting / liquidated)
 *   2. Filter bar (search + status chips)
 *   3. Entry rows: each shows MBOL, entry date, status pill, days to each
 *      deadline, and a horizontal progress bar showing position within the
 *      314-day liquidation window. Urgent items rise to top.
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

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';

function RecordsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading records">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[96px] rounded-xl" />)}
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
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

// ─── KPI strip ──────────────────────────────────────────────────────

function RecordsKpiStrip({
  total, counts,
}: {
  total: number;
  counts: { psc: number; awaiting: number; liquidated: number; pending: number };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile
        label="Tracked"
        value={total}
        sub="Accepted entries"
        tone="calm"
        Icon={FileText}
      />
      <KpiTile
        label="PSC open"
        value={counts.psc}
        sub="Within 300 days of entry"
        tone="soon"
        Icon={Calendar}
      />
      <KpiTile
        label="Awaiting liquidation"
        value={counts.awaiting}
        sub="Days 300 to 314"
        tone="info"
        Icon={Clock}
      />
      <KpiTile
        label="Liquidated"
        value={counts.liquidated}
        sub="Protest window open 180 days"
        tone="done"
        Icon={Archive}
      />
    </div>
  );
}

const TEXT: Record<Tone, string> = {
  urgent: 'text-urgent', soon: 'text-soon', info: 'text-info', entry: 'text-entry', done: 'text-done', calm: 'text-muted-foreground',
};

function KpiTile({
  label, value, sub, tone, Icon,
}: {
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  Icon: IconType;
}) {
  return (
    <article className={cn(PANEL, 'px-5 py-4')}>
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Icon aria-hidden weight="duotone" className={cn('h-4 w-4 shrink-0', TEXT[tone])} />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 text-[24px] font-semibold leading-8 tabular-nums tracking-[-0.015em] text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="text-[12px] text-muted-foreground">{sub}</p>
    </article>
  );
}

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
      <section aria-label="Liquidation pipeline" className={cn(PANEL, 'px-5 py-10 text-center')}>
        <Archive aria-hidden weight="duotone" className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
        <p className="text-[14px] font-semibold text-foreground">No accepted entries yet</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
          Once CBP accepts an entry, its 314-day liquidation countdown and 300-day PSC window will appear here.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="pipeline-title" className={PANEL}>
      {/* Header */}
      <div className="px-5 pt-3.5">
        <h2 id="pipeline-title" className="text-[14px] font-semibold text-foreground">Liquidation pipeline</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Sorted by urgency. PSC is the Post-Summary Correction window (300 days). Liquidation is when the entry is finalized (314 days).
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search entries by bill number or entry type"
            placeholder="Search by bill number or entry type"
            className="pl-9 text-[13px]"
          />
        </div>
        <StatusChips value={filter} onChange={onFilterChange} counts={counts} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="border-t border-border/70 px-5 py-8 text-center text-[13px] text-muted-foreground">
          No entries match the current filters.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/70">
          {filtered.map((t) => <PipelineRow key={t.id} t={t} />)}
        </ul>
      )}
    </section>
  );
}

function StatusChips({
  value, onChange, counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: { psc: number; awaiting: number; liquidated: number; pending: number };
}) {
  const chips: Array<{ id: StatusFilter; label: string; count?: number }> = [
    { id: 'all',                  label: 'All' },
    { id: 'psc-window-open',      label: 'PSC',        count: counts.psc },
    { id: 'awaiting-liquidation', label: 'Awaiting',   count: counts.awaiting },
    { id: 'liquidated',           label: 'Liquidated', count: counts.liquidated },
  ];
  return (
    <div role="group" aria-label="Filter by status" className="flex shrink-0 flex-wrap rounded-lg bg-muted p-0.5">
      {chips.map((c) => {
        const isActive = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(c.id)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground can-hover:hover:text-foreground',
            )}
          >
            {c.label}
            {c.count !== undefined && (
              <span className="text-[12px] tabular-nums text-muted-foreground">{c.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Colour by days remaining: past, two weeks, two months, or further out. */
function urgencyOf(days: number): Tone | null {
  if (days < 0) return 'calm';
  if (days <= 14) return 'urgent';
  if (days <= 60) return 'soon';
  return null;
}

const DAYS_TEXT: Record<Tone, string> = {
  ...TEXT,
  urgent: 'text-urgent font-semibold',
  soon: 'text-soon font-medium',
};

function PipelineRow({ t }: { t: LiquidationTracked }) {
  const status = STATUS_TONE[t.status];

  // Position within the 314-day liquidation window (0% = entry, 100% = liquidation).
  const TOTAL = 314;
  const elapsed = TOTAL - Math.max(0, t.daysUntilLiquidation);
  const pct = Math.max(0, Math.min(100, (elapsed / TOTAL) * 100));
  const pscMarker = (300 / TOTAL) * 100; // PSC deadline at 300d
  // Bar fill colour by remaining-days urgency, not status.
  const liqUrgency = urgencyOf(t.daysUntilLiquidation);
  const pscUrgency = urgencyOf(t.daysUntilPscDeadline);
  const barFill = liqUrgency === 'calm' ? 'bg-muted-foreground/40' : FILL[liqUrgency ?? 'info'];

  return (
    <li>
      <Link
        to={t.linkUrl}
        className="group block px-5 py-3.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring can-hover:hover:bg-muted/50"
      >
        {/* Top row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[13px] font-semibold text-foreground">{t.bol}</span>
          <span className={cn('rounded-full px-2 py-px text-[11.5px] font-medium', TINT[status.tone])}>
            {status.label}
          </span>
          <span className="text-[12px] text-muted-foreground">{t.filingType}</span>
          <span className="text-[12px] tabular-nums text-muted-foreground">Entered {fmtDate(t.entryDate)}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-foreground transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-visible:opacity-100">
            Open <ArrowRight aria-hidden className="h-3 w-3" />
          </span>
        </div>

        {/* Deadlines */}
        <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-2">
          <Deadline
            label="PSC deadline"
            color={pscUrgency ? DAYS_TEXT[pscUrgency] : 'text-foreground'}
            value={t.daysUntilPscDeadline < 0 ? 'Expired' : `${t.daysUntilPscDeadline}d`}
            sub={fmtDate(t.pscDeadline)}
          />
          <Deadline
            label="Liquidation"
            color={liqUrgency ? DAYS_TEXT[liqUrgency] : 'text-foreground'}
            value={t.daysUntilLiquidation < 0 ? 'Liquidated' : `${t.daysUntilLiquidation}d`}
            sub={fmtDate(t.estimatedLiquidationAt)}
          />
          {t.daysUntilPscDeadline >= 0 && t.daysUntilPscDeadline <= 14 && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium', TINT.urgent)}>
              <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
              File PSC corrections this week
            </span>
          )}
        </div>

        {/* Progress through 314-day window */}
        <div className="relative mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', barFill)}
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* PSC marker */}
          <div
            aria-hidden
            className="absolute top-[-2px] h-[10px] w-px bg-muted-foreground"
            style={{ left: `${pscMarker}%` }}
            title="PSC deadline (300 days)"
          />
          <div className="mt-1 flex justify-between text-[12px] tabular-nums text-muted-foreground">
            <span>Entry</span>
            {/* PSC (300d) sits too close to liquidation (314d) for its own floating label. */}
            <span>PSC at 300 days, liquidation at 314</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

const STATUS_TONE: Record<LiquidationTracked['status'], { label: string; tone: Tone }> = {
  'psc-window-open':      { label: 'PSC open',             tone: 'soon' },
  'awaiting-liquidation': { label: 'Awaiting liquidation', tone: 'info' },
  'liquidated':           { label: 'Liquidated',           tone: 'done' },
  'pending':              { label: 'Pending',              tone: 'calm' },
};

function Deadline({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="text-[13px] tabular-nums">
        <span className={color}>{value}</span>
        <span className="text-muted-foreground">, {sub}</span>
      </p>
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
