import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFilings, useFilingStats } from '@/hooks/useFilings';
import { Filing } from '@/types/shipment';
import { useCurrentUser } from '@/hooks/useAuth';
import { CelebrationModal } from '@/components/CelebrationModal';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowUpRight, ArrowDownRight, Plus, ArrowRight, Minus,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map an ISF filing's status to the next user action in the import
 * lifecycle (ISF → Manifest Query → ABI Entry). Returns null when there
 * is nothing actionable (cancelled, or awaiting CBP).
 */
function computeNextStep(f: { id: string; status: string; masterBol?: string | null }): { label: string; to: string } | null {
  switch (f.status) {
    case 'draft':
      return { label: 'Complete ISF', to: `/shipments/${f.id}/edit` };
    case 'rejected':
      return { label: 'Review & resubmit', to: `/shipments/${f.id}` };
    case 'accepted':
      return { label: 'File Entry Documents', to: `/abi-documents/new?fromShipment=${f.id}` };
    default:
      return null; // submitted (awaiting CBP), cancelled, etc.
  }
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(ts: string) {
  return Math.ceil((new Date(ts).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function useGreeting() {
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
}

// Smooth count-up for numeric values. Respects reduced motion.
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline — minimal inline area chart for metric cards
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ data, tone = 'neutral' }: {
  data: { v: number }[];
  tone?: 'neutral' | 'positive' | 'negative' | 'gold';
}) {
  if (!data.length) return null;
  const color =
    tone === 'positive' ? 'hsl(142 71% 45%)'
    : tone === 'negative' ? 'hsl(0 72% 51%)'
    : tone === 'gold' ? 'hsl(43 96% 56%)'
    : 'hsl(var(--muted-foreground))';

  const gradId = `spark-${tone}-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <div className="h-10 w-full -mb-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card — Stripe-style: label, big number, delta, subtle sparkline
// ─────────────────────────────────────────────────────────────────────────────

type Trend = 'up' | 'down' | 'flat';

function MetricCard({
  label, value, format = 'number', trend, trendValue, trendLabel, series, tone = 'neutral', delay,
}: {
  label: string;
  value: number;
  format?: 'number' | 'percent';
  trend: Trend;
  trendValue?: string;
  trendLabel: string;
  series: { v: number }[];
  tone?: 'neutral' | 'positive' | 'negative' | 'gold';
  delay: number;
}) {
  const count = useCountUp(value);
  const display = format === 'percent' ? `${count}%` : count.toLocaleString();

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    tone === 'negative' && trend === 'up' ? 'text-red-600 dark:text-red-400'
    : trend === 'up' ? 'text-emerald-600 dark:text-emerald-400'
    : trend === 'down' ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'group relative rounded-2xl border border-border/60 bg-card p-5',
        'transition-all duration-300 hover:border-border hover:shadow-card',
        'opacity-0 animate-fade-in-up',
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
        {label}
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[34px] leading-none font-semibold tracking-tight tabular-nums">
          {display}
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium">
        {trendValue && (
          <span className={cn('inline-flex items-center gap-0.5', trendColor)}>
            <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
            {trendValue}
          </span>
        )}
        <span className="text-muted-foreground">{trendLabel}</span>
      </div>

      <div className="mt-3">
        <Sparkline data={series} tone={tone} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d';

export default function Dashboard() {
  const { data: statsData, isLoading: statsLoading } = useFilingStats();
  const { data: filingsData, isLoading: filingsLoading } = useFilings({
    sortBy: 'createdAt', sortOrder: 'desc', limit: 200,
  });
  const { data: profile } = useCurrentUser();

  const [range, setRange] = useState<Range>('30d');

  // ── Welcome modal (post-upgrade redirect) ────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const welcomePlanId = searchParams.get('welcome');

  function handleModalClose() {
    setSearchParams(p => { p.delete('welcome'); return p; });
  }
  const greeting = useGreeting();

  const filings: Filing[] = filingsData?.data ?? [];
  const statusCounts = statsData?.statusCounts ?? {};
  const total = statsData?.total ?? 0;

  const draft     = statusCounts['draft'] ?? 0;
  const submitted = statusCounts['submitted'] ?? 0;
  const pending   = statusCounts['pending_cbp'] ?? 0;
  const accepted  = statusCounts['accepted'] ?? 0;
  const rejected  = statusCounts['rejected'] ?? 0;
  const onHold    = statusCounts['on_hold'] ?? 0;

  const atCbp = submitted + pending + onHold;
  const needsAttention = rejected + draft;

  // Compliance: accepted / (accepted + rejected). If no resolved, neutral.
  const complianceRate = useMemo(() => {
    const resolved = accepted + rejected;
    if (resolved === 0) return 100;
    return Math.round((accepted / resolved) * 100);
  }, [accepted, rejected]);

  // ── Bucket filings into a time series for the selected range ─────────────
  const daysInRange = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const timeSeries = useMemo(() => {
    const buckets: Array<{ key: string; label: string; total: number; accepted: number; rejected: number }> = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const msDay = 86400000;
    const bucketCount = range === '90d' ? 13 : daysInRange; // weekly for 90d, daily otherwise
    const bucketDays = range === '90d' ? 7 : 1;

    for (let i = bucketCount - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * bucketDays * msDay);
      const start = new Date(end.getTime() - (bucketDays - 1) * msDay);
      const label = bucketDays === 1
        ? end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      buckets.push({
        key: end.toISOString(),
        label,
        total: 0,
        accepted: 0,
        rejected: 0,
      });
    }

    filings.forEach(f => {
      const created = new Date(f.createdAt);
      created.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((now.getTime() - created.getTime()) / msDay);
      if (diffDays < 0 || diffDays >= daysInRange) return;
      const idx = bucketCount - 1 - Math.floor(diffDays / bucketDays);
      if (idx < 0 || idx >= bucketCount) return;
      buckets[idx].total += 1;
      if (f.status === 'accepted') buckets[idx].accepted += 1;
      if (f.status === 'rejected') buckets[idx].rejected += 1;
    });

    return buckets;
  }, [filings, range, daysInRange]);

  const periodTotal = timeSeries.reduce((s, b) => s + b.total, 0);
  const periodAccepted = timeSeries.reduce((s, b) => s + b.accepted, 0);

  // Compare against prior equivalent window
  const prevPeriodTotal = useMemo(() => {
    const msDay = 86400000;
    const now = Date.now();
    const prevStart = now - 2 * daysInRange * msDay;
    const prevEnd = now - daysInRange * msDay;
    return filings.filter(f => {
      const t = new Date(f.createdAt).getTime();
      return t >= prevStart && t < prevEnd;
    }).length;
  }, [filings, daysInRange]);

  const periodDelta = periodTotal - prevPeriodTotal;

  // ── Sparkline data for metric cards ──────────────────────────────────────
  const totalSeries = useMemo(() => timeSeries.map(b => ({ v: b.total })), [timeSeries]);
  const acceptedSeries = useMemo(() => timeSeries.map(b => ({ v: b.accepted })), [timeSeries]);
  const atCbpSeries = useMemo(() => {
    // running count of "at CBP" created in this window (submitted/pending)
    return timeSeries.map((_b, i) => ({
      v: timeSeries.slice(0, i + 1).reduce((s, x) => s + x.total - x.accepted - x.rejected, 0),
    }));
  }, [timeSeries]);
  const rejectedSeries = useMemo(() => timeSeries.map(b => ({ v: b.rejected })), [timeSeries]);

  // ── Recent filings (top 6, Notion-clean list) ────────────────────────────
  const recent = useMemo(() => filings.slice(0, 6), [filings]);

  // ── Deadlines within 7 days ──────────────────────────────────────────────
  const urgent = useMemo(() => {
    return filings
      .filter(f => (f.status === 'draft' || f.status === 'submitted') && f.filingDeadline)
      .map(f => ({ f, days: daysUntil(f.filingDeadline!) }))
      .filter(x => x.days <= 7)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [filings]);

  // ── Status breakdown bars ────────────────────────────────────────────────
  const statusBars = useMemo(() => {
    const rows = [
      { key: 'accepted',  label: 'Accepted',  count: accepted,          color: 'bg-emerald-500' },
      { key: 'submitted', label: 'At CBP',    count: atCbp,             color: 'bg-blue-500'    },
      { key: 'draft',     label: 'Draft',     count: draft,             color: 'bg-slate-400'   },
      { key: 'rejected',  label: 'Rejected',  count: rejected,          color: 'bg-red-500'     },
    ];
    const max = Math.max(...rows.map(r => r.count), 1);
    return rows.map(r => ({ ...r, pct: (r.count / max) * 100 }));
  }, [accepted, atCbp, draft, rejected]);

  const isLoading = statsLoading || filingsLoading;
  const firstName = profile?.firstName?.trim() || null;

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-8 max-w-[1400px] mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-3 w-60" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-4">
      {/* ─── Post-upgrade celebration modal ───────────────────────────── */}
      <CelebrationModal planId={welcomePlanId} onClose={handleModalClose} />

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <header
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards' }}
      >
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Overview
          </p>
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-tight text-foreground">
            {greeting}{firstName ? <>, <span className="text-gradient-gold">{firstName}</span></> : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}
            <span className="text-foreground/80 font-medium">{total.toLocaleString()} total filings</span>
          </p>
        </div>

        <Link to="/shipments/new">
          <Button
            size="default"
            className={cn(
              'gap-1.5 h-10 px-4 rounded-xl font-semibold',
              'shadow-[0_1px_2px_0_hsl(var(--foreground)/0.08),0_0_0_1px_hsl(43_96%_56%/0.1)]',
              'hover:shadow-gold transition-all duration-200',
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> New Filing
          </Button>
        </Link>
      </header>

      {/* ─── Metrics ──────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Filings"
          value={total}
          trend={periodDelta > 0 ? 'up' : periodDelta < 0 ? 'down' : 'flat'}
          trendValue={periodDelta !== 0 ? `${Math.abs(periodDelta)}` : undefined}
          trendLabel={`vs previous ${range}`}
          series={totalSeries}
          tone="neutral"
          delay={60}
        />
        <MetricCard
          label="Compliance"
          value={complianceRate}
          format="percent"
          trend={complianceRate >= 90 ? 'up' : complianceRate >= 70 ? 'flat' : 'down'}
          trendLabel={complianceRate >= 90 ? 'excellent' : complianceRate >= 70 ? 'acceptable' : 'needs attention'}
          series={acceptedSeries}
          tone={complianceRate >= 70 ? 'positive' : 'negative'}
          delay={140}
        />
        <MetricCard
          label="At CBP"
          value={atCbp}
          trend="flat"
          trendLabel={atCbp > 0 ? 'awaiting response' : 'none pending'}
          series={atCbpSeries}
          tone="gold"
          delay={220}
        />
        <MetricCard
          label="Needs Attention"
          value={needsAttention}
          trend={needsAttention > 0 ? 'up' : 'flat'}
          trendValue={rejected > 0 ? `${rejected} rejected` : undefined}
          trendLabel={needsAttention === 0 ? 'all clear' : `${draft} draft`}
          series={rejectedSeries}
          tone={needsAttention > 0 ? 'negative' : 'neutral'}
          delay={300}
        />
      </section>

      {/* ─── Urgent Deadlines (conditional, prominent when present) ───── */}
      {urgent.length > 0 && (
        <section
          className="rounded-2xl border border-gold bg-gradient-to-br from-amber-50/40 to-transparent dark:from-amber-500/5 p-5 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '360ms', animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gold/10 flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 text-gold-dark" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold">Upcoming deadlines</p>
                <p className="text-xs text-muted-foreground">{urgent.length} filing{urgent.length === 1 ? '' : 's'} due within 7 days</p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {urgent.map(({ f, days }) => {
              const overdue = days <= 0;
              const critical = days <= 2;
              return (
                <Link
                  key={f.id}
                  to={`/shipments/${f.id}`}
                  className={cn(
                    'group rounded-xl border bg-card px-3 py-2.5 transition-all hover:shadow-card',
                    overdue ? 'border-red-300 dark:border-red-900/50' :
                    critical ? 'border-amber-300 dark:border-amber-900/50' :
                    'border-border/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {f.houseBol || f.masterBol || f.id.slice(0, 8)}
                    </span>
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider shrink-0',
                      overdue ? 'text-red-600 dark:text-red-400' :
                      critical ? 'text-amber-600 dark:text-amber-500' :
                      'text-muted-foreground',
                    )}>
                      {overdue ? 'Overdue' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{f.importerName || 'Unnamed importer'}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Filing Activity (main area chart) ────────────────────────── */}
      <section
        className="rounded-2xl border border-border/60 bg-card p-6 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '420ms', animationFillMode: 'forwards' }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
              Filing Activity
            </p>
            <div className="mt-2.5 flex items-baseline gap-3">
              <span className="text-[34px] leading-none font-semibold tabular-nums tracking-tight">
                {periodTotal}
              </span>
              <span className="text-sm text-muted-foreground">filings this period</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{periodAccepted} accepted</span>
              {' · '}
              <span>{periodTotal - periodAccepted} in progress or rejected</span>
            </p>
          </div>

          {/* Range toggle — segmented control */}
          <div className="inline-flex items-center rounded-xl border border-border/60 bg-muted/30 p-1">
            {(['7d', '30d', '90d'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  range === r
                    ? 'bg-card text-foreground shadow-[0_1px_2px_0_hsl(var(--foreground)/0.08)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[260px] -ml-2">
          {periodTotal > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashAreaTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashAreaAccepted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: '0 4px 12px hsl(var(--foreground) / 0.08)',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#dashAreaTotal)"
                  name="Total"
                />
                <Area
                  type="monotone"
                  dataKey="accepted"
                  stroke="hsl(142 71% 45%)"
                  strokeWidth={1.5}
                  fill="url(#dashAreaAccepted)"
                  name="Accepted"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium">No activity in this period</p>
              <p className="text-xs">Filings you create will appear here</p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Recent Filings + Status Breakdown ───────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Recent filings list */}
        <div
          className="lg:col-span-2 rounded-2xl border border-border/60 bg-card opacity-0 animate-fade-in-up"
          style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                Recent Filings
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Latest activity across your organization</p>
            </div>
            <Link to="/shipments">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground h-8">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No filings yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first ISF filing to get started</p>
              <Link to="/shipments/new">
                <Button size="sm" className="mt-4">Create filing</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {recent.map(f => {
                const next = computeNextStep(f);
                return (
                  <li key={f.id}>
                    <div className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/30">
                      <Link
                        to={`/shipments/${f.id}`}
                        className="flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {f.houseBol || f.masterBol || 'Untitled filing'}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                            {f.filingType}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {f.importerName || 'No importer set'}
                        </p>
                      </Link>

                      <div className="hidden sm:block shrink-0">
                        <StatusBadge status={f.status} />
                      </div>

                      {/* Lifecycle next-step CTA. Visible only when there's
                          an actionable next step (skipped for terminal /
                          waiting states). */}
                      {next && (
                        <Link
                          to={next.to}
                          className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors shrink-0"
                        >
                          {next.label}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}

                      <div className="shrink-0 text-right min-w-[70px]">
                        <p className="text-xs tabular-nums text-foreground/80">
                          {relativeTime(f.createdAt)}
                        </p>
                      </div>

                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Status breakdown */}
        <div
          className="rounded-2xl border border-border/60 bg-card p-6 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '580ms', animationFillMode: 'forwards' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            By Status
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">All-time distribution</p>

          <div className="mt-5 space-y-4">
            {statusBars.map((s, i) => (
              <div key={s.key} className="space-y-1.5" style={{ animationDelay: `${620 + i * 60}ms` }}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', s.color)} />
                    <span className="font-medium text-foreground">{s.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700 origin-left', s.color)}
                    style={{ width: `${s.pct}%`, opacity: s.count === 0 ? 0.25 : 0.9 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Compliance score footer */}
          <div className="mt-6 pt-5 border-t border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                  Compliance
                </p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {complianceRate}%
                </p>
              </div>
              <div className={cn(
                'h-9 w-9 rounded-xl flex items-center justify-center',
                complianceRate >= 90 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                complianceRate >= 70 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                'bg-red-500/10 text-red-600 dark:text-red-400',
              )}>
                {complianceRate >= 70
                  ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                  : <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {accepted} accepted out of {accepted + rejected} resolved
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
