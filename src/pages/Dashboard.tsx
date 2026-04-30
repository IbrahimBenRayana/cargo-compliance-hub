import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFilings, useFilingStats } from '@/hooks/useFilings';
import { useAbiDocumentsList } from '@/hooks/useAbiDocument';
import { useManifestQueries } from '@/hooks/useManifestQuery';
import { Filing } from '@/types/shipment';
import { useCurrentUser } from '@/hooks/useAuth';
import { CelebrationModal } from '@/components/CelebrationModal';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowUpRight, ArrowDownRight, Plus, ArrowRight, Minus,
  CheckCircle2, AlertTriangle, FileCheck, Search, Ship,
  Inbox, Clock, ListChecks, Sparkles,
} from 'lucide-react';
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
      return null;
  }
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60)        return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)        return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)         return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7)         return `${day}d ago`;
  if (day < 30)        return `${Math.floor(day / 7)}w ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

function daysUntil(ts: string) {
  return Math.ceil((new Date(ts).getTime() - Date.now()) / 86400000);
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
  const w = 280, h = 36;
  const max = Math.max(...data.map(d => d.v), 1);
  const min = Math.min(...data.map(d => d.v), 0);
  const range = Math.max(max - min, 1);
  const stepX = w / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: h - ((d.v - min) / range) * (h - 4) - 2,
  }));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${(data.length - 1) * stepX},${h} L0,${h} Z`;

  const stroke =
    tone === 'positive' ? 'hsl(142 71% 45%)' :
    tone === 'negative' ? 'hsl(0 72% 51%)' :
    tone === 'gold'     ? 'hsl(43 96% 56%)' :
    'hsl(var(--primary))';
  const fillId = `spark-${tone}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9 overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric card — KPI tile with trend, sparkline, count-up animation
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
// Lifecycle dots — 4-stage compact indicator (ISF → MQ → Entry → Cleared)
// ─────────────────────────────────────────────────────────────────────────────

type StageState = 'done' | 'active' | 'pending' | 'blocked';

function LifecycleDots({ stages }: { stages: StageState[] }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0" aria-label="Shipment lifecycle stage">
      {stages.map((s, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            s === 'done' ? 'w-4 bg-emerald-500' :
            s === 'active' ? 'w-4 bg-primary' :
            s === 'blocked' ? 'w-4 bg-red-500' :
            'w-2 bg-border',
          )}
        />
      ))}
    </div>
  );
}

/** Compute the 4-stage lifecycle for an ISF filing using ABI + MQ context. */
function computeStages(args: {
  filing: Filing;
  abiByFilingId: Map<string, { status: string }>;
  mqByMbol: Map<string, { status: string }>;
}): StageState[] {
  const { filing, abiByFilingId, mqByMbol } = args;
  const isf =
    filing.status === 'accepted' ? 'done' :
    filing.status === 'rejected' ? 'blocked' :
    filing.status === 'cancelled' ? 'pending' :
    'active';

  const mqStatus = filing.masterBol ? mqByMbol.get(filing.masterBol)?.status : undefined;
  const mq: StageState =
    isf !== 'done' ? 'pending' :
    mqStatus === 'completed' ? 'done' :
    mqStatus ? 'active' :
    'pending';

  const abi = abiByFilingId.get(filing.id);
  const entry: StageState =
    !abi ? 'pending' :
    abi.status === 'ACCEPTED' ? 'done' :
    abi.status === 'REJECTED' ? 'blocked' :
    'active';

  const cleared: StageState =
    abi?.status === 'ACCEPTED' ? 'done' :
    'pending';

  return [isf, mq, entry, cleared] as StageState[];
}

// ─────────────────────────────────────────────────────────────────────────────
// "Needs attention" — derive actionable items across ISF + MQ + ABI
// ─────────────────────────────────────────────────────────────────────────────

type AttentionItem = {
  id: string;
  severity: 'critical' | 'warn' | 'info';
  icon: typeof AlertTriangle;
  title: string;
  sub: string;
  to: string;
  age?: string;
};

function buildAttention(args: {
  filings: Filing[];
  abiDocs: Array<{ id: string; status: string; mbolNumber: string | null; entryNumber: string | null; updatedAt: string; lastError: string | null }>;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { filings, abiDocs } = args;

  // ISF: rejected (high), drafts with deadline, drafts old, accepted-without-entry
  for (const f of filings) {
    const ref = f.houseBol || f.masterBol || f.id.slice(0, 8);

    if (f.status === 'rejected') {
      items.push({
        id: `f-rej-${f.id}`, severity: 'critical', icon: AlertTriangle,
        title: `ISF rejected: ${ref}`,
        sub: f.rejectionReason || 'Review CBP response and resubmit',
        to: `/shipments/${f.id}`,
        age: relativeTime(f.updatedAt),
      });
      continue;
    }

    if (f.status === 'draft' && f.filingDeadline) {
      const days = daysUntil(f.filingDeadline);
      if (days <= 2) {
        items.push({
          id: `f-deadline-${f.id}`,
          severity: days <= 0 ? 'critical' : 'warn',
          icon: Clock,
          title: days <= 0 ? `ISF overdue: ${ref}` : `ISF due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`}: ${ref}`,
          sub: f.importerName || 'Complete and submit before deadline',
          to: `/shipments/${f.id}/edit`,
        });
      }
    }
  }

  // ABI: drafts ready to transmit, rejections
  for (const doc of abiDocs) {
    const ref = doc.entryNumber || doc.mbolNumber || doc.id.slice(0, 8);
    if (doc.status === 'REJECTED') {
      items.push({
        id: `a-rej-${doc.id}`, severity: 'critical', icon: AlertTriangle,
        title: `Entry rejected: ${ref}`,
        sub: doc.lastError || 'Review CBP response',
        to: `/abi-documents/${doc.id}`,
        age: relativeTime(doc.updatedAt),
      });
    } else if (doc.status === 'DRAFT' && doc.entryNumber && doc.mbolNumber) {
      items.push({
        id: `a-draft-${doc.id}`, severity: 'info', icon: FileCheck,
        title: `Entry draft ready: ${ref}`,
        sub: 'All required fields complete — ready to transmit to CBP',
        to: `/abi-documents/${doc.id}`,
      });
    }
  }

  // ISF accepted but no Entry yet — strongest call to action
  const abiByFilingId = new Map<string, { status: string }>();
  for (const d of abiDocs) {
    // (we pass filingId on AbiDocument shape; falls back to MBOL match below)
  }
  for (const f of filings) {
    if (f.status !== 'accepted') continue;
    const hasEntry = abiDocs.some(d =>
      (d as any).filingId === f.id ||
      (f.masterBol && d.mbolNumber === f.masterBol),
    );
    if (!hasEntry) {
      const ref = f.houseBol || f.masterBol || f.id.slice(0, 8);
      items.push({
        id: `f-noentry-${f.id}`, severity: 'warn', icon: FileCheck,
        title: `Ready to file Entry: ${ref}`,
        sub: 'ISF accepted by CBP — file 7501 + 3461 to clear cargo',
        to: `/abi-documents/new?fromShipment=${f.id}`,
      });
    }
  }

  // Sort: critical first, then warn, then info
  const sevOrder = { critical: 0, warn: 1, info: 2 };
  items.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity feed — merged events across ISF + MQ + ABI, sorted by date
// ─────────────────────────────────────────────────────────────────────────────

type ActivityEvent = {
  id: string;
  ts: string;
  kind: 'isf' | 'mq' | 'abi';
  status: string;
  title: string;
  sub: string;
  to: string;
};

function buildActivity(args: {
  filings: Filing[];
  abiDocs: Array<{ id: string; status: string; mbolNumber: string | null; entryNumber: string | null; updatedAt: string; createdAt: string }>;
  mqs: Array<{ id: string; status: string; bolNumber: string; createdAt: string; completedAt: string | null }>;
}): ActivityEvent[] {
  const out: ActivityEvent[] = [];

  for (const f of args.filings) {
    out.push({
      id: `isf-${f.id}`,
      ts: f.updatedAt,
      kind: 'isf',
      status: f.status,
      title: `ISF ${f.status}: ${f.houseBol || f.masterBol || f.id.slice(0, 8)}`,
      sub: f.importerName || f.filingType,
      to: `/shipments/${f.id}`,
    });
  }

  for (const d of args.abiDocs) {
    out.push({
      id: `abi-${d.id}`,
      ts: d.updatedAt,
      kind: 'abi',
      status: d.status,
      title: `Entry ${d.status.toLowerCase()}: ${d.entryNumber || d.mbolNumber || d.id.slice(0, 8)}`,
      sub: d.mbolNumber ? `MBOL ${d.mbolNumber}` : 'ABI document',
      to: `/abi-documents/${d.id}`,
    });
  }

  for (const q of args.mqs) {
    out.push({
      id: `mq-${q.id}`,
      ts: q.completedAt || q.createdAt,
      kind: 'mq',
      status: q.status,
      title: `Manifest ${q.status}: ${q.bolNumber}`,
      sub: 'CBP manifest lookup',
      to: `/manifest-query`,
    });
  }

  out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return out.slice(0, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: statsData, isLoading: statsLoading } = useFilingStats();
  const { data: filingsData, isLoading: filingsLoading } = useFilings({
    sortBy: 'updatedAt', sortOrder: 'desc', limit: 200,
  });
  const { data: abiData, isLoading: abiLoading } = useAbiDocumentsList({ take: 50 });
  const { data: mqData, isLoading: mqLoading } = useManifestQueries({ limit: 30 });
  const { data: profile } = useCurrentUser();

  // Welcome modal (post-upgrade redirect)
  const [searchParams, setSearchParams] = useSearchParams();
  const welcomePlanId = searchParams.get('welcome');
  function handleModalClose() {
    setSearchParams(p => { p.delete('welcome'); return p; });
  }

  const greeting = useGreeting();

  // ── Source data ─────────────────────────────────────────────────────────
  const filings: Filing[] = filingsData?.data ?? [];
  const abiDocs = (abiData?.data ?? []) as Array<{
    id: string; status: string; mbolNumber: string | null; entryNumber: string | null;
    updatedAt: string; createdAt: string; lastError: string | null; filingId: string | null;
    iorName: string | null; consigneeName: string | null;
  }>;
  const mqs = ((mqData as any)?.data ?? []) as Array<{
    id: string; status: string; bolNumber: string; createdAt: string; completedAt: string | null;
  }>;

  const statusCounts = statsData?.statusCounts ?? {};
  const total = statsData?.total ?? 0;
  const accepted  = statusCounts['accepted']  ?? 0;
  const rejected  = statusCounts['rejected']  ?? 0;
  const cancelled = statusCounts['cancelled'] ?? 0;

  // ── KPIs (lifecycle-aware) ──────────────────────────────────────────────
  const activeShipments = useMemo(
    () => filings.filter(f => f.status !== 'accepted' && f.status !== 'cancelled').length
       + abiDocs.filter(d => d.status === 'DRAFT' || d.status === 'SENDING' || d.status === 'SENT' || d.status === 'REJECTED').length,
    [filings, abiDocs],
  );

  const attention = useMemo(() => buildAttention({ filings, abiDocs }), [filings, abiDocs]);
  const attentionCount = attention.length;

  const filedThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const isfFiled = filings.filter(f => f.submittedAt && new Date(f.submittedAt).getTime() >= monthStart).length;
    const abiFiled = abiDocs.filter(d => d.status !== 'DRAFT' && d.updatedAt && new Date(d.updatedAt).getTime() >= monthStart).length;
    return isfFiled + abiFiled;
  }, [filings, abiDocs]);

  const acceptanceRate = useMemo(() => {
    const resolved = accepted + rejected;
    return resolved === 0 ? 100 : Math.round((accepted / resolved) * 100);
  }, [accepted, rejected]);

  // ── Sparkline series (30-day daily buckets) ─────────────────────────────
  const series30d = useMemo(() => {
    const buckets = new Array(30).fill(0).map((_, i) => ({
      ts: new Date(Date.now() - (29 - i) * 86400000).setHours(0, 0, 0, 0),
      total: 0, accepted: 0, rejected: 0,
    }));
    const now = new Date(); now.setHours(0, 0, 0, 0);
    filings.forEach(f => {
      const d = new Date(f.createdAt); d.setHours(0, 0, 0, 0);
      const idx = 29 - Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (idx >= 0 && idx < 30) {
        buckets[idx].total += 1;
        if (f.status === 'accepted') buckets[idx].accepted += 1;
        if (f.status === 'rejected') buckets[idx].rejected += 1;
      }
    });
    return buckets;
  }, [filings]);

  const totalSeries     = series30d.map(b => ({ v: b.total }));
  const acceptedSeries  = series30d.map(b => ({ v: b.accepted }));
  const rejectedSeries  = series30d.map(b => ({ v: b.rejected }));
  const cumulativeSeries = series30d.map((_, i) =>
    ({ v: series30d.slice(0, i + 1).reduce((s, b) => s + b.total - b.accepted, 0) }),
  );

  // ── Active shipments rows (with lifecycle stages) ───────────────────────
  const abiByFilingId = useMemo(() => {
    const map = new Map<string, { status: string }>();
    for (const d of abiDocs) if (d.filingId) map.set(d.filingId, { status: d.status });
    return map;
  }, [abiDocs]);

  const mqByMbol = useMemo(() => {
    const map = new Map<string, { status: string }>();
    for (const q of mqs) map.set(q.bolNumber, { status: q.status });
    return map;
  }, [mqs]);

  const activeShipmentRows = useMemo(() => {
    return filings
      .filter(f => f.status !== 'cancelled')
      .slice(0, 6)
      .map(f => ({
        filing: f,
        stages: computeStages({ filing: f, abiByFilingId, mqByMbol }),
        next: computeNextStep(f),
      }));
  }, [filings, abiByFilingId, mqByMbol]);

  // ── Activity feed ───────────────────────────────────────────────────────
  const activity = useMemo(
    () => buildActivity({ filings, abiDocs, mqs }),
    [filings, abiDocs, mqs],
  );

  // ── Status breakdown ────────────────────────────────────────────────────
  const statusBars = useMemo(() => {
    const draft     = statusCounts['draft']     ?? 0;
    const submitted = statusCounts['submitted'] ?? 0;
    const pending   = statusCounts['pending_cbp'] ?? 0;
    const onHold    = statusCounts['on_hold']   ?? 0;
    const atCbp = submitted + pending + onHold;
    const rows = [
      { key: 'accepted',  label: 'Accepted',   count: accepted,  color: 'bg-emerald-500' },
      { key: 'submitted', label: 'At CBP',     count: atCbp,     color: 'bg-blue-500'    },
      { key: 'draft',     label: 'Draft',      count: draft,     color: 'bg-slate-400'   },
      { key: 'rejected',  label: 'Rejected',   count: rejected,  color: 'bg-red-500'     },
      { key: 'cancelled', label: 'Cancelled',  count: cancelled, color: 'bg-muted-foreground/40' },
    ];
    const max = Math.max(...rows.map(r => r.count), 1);
    return rows.map(r => ({ ...r, pct: (r.count / max) * 100 }));
  }, [statusCounts, accepted, rejected, cancelled]);

  const isLoading = statsLoading || filingsLoading || abiLoading || mqLoading;
  const firstName = profile?.firstName?.trim() || null;

  // ── Loading skeleton ────────────────────────────────────────────────────
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
        <Skeleton className="h-64 rounded-2xl" />
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
        <div className="space-y-1.5 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Overview
          </p>
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-tight text-foreground">
            {greeting}{firstName ? <>, <span className="text-gradient-gold">{firstName}</span></> : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}
            <span className="text-foreground/80 font-medium">
              {activeShipments.toLocaleString()} active {activeShipments === 1 ? 'shipment' : 'shipments'}
            </span>
            {attentionCount > 0 && <>{' · '}<span className="text-amber-600 dark:text-amber-400 font-medium">{attentionCount} need attention</span></>}
          </p>
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/manifest-query">
            <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-lg">
              <Search className="h-3.5 w-3.5" /> Manifest Query
            </Button>
          </Link>
          <Link to="/abi-documents/new">
            <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-lg">
              <FileCheck className="h-3.5 w-3.5" /> New Entry
            </Button>
          </Link>
          <Link to="/shipments/new">
            <Button
              size="default"
              className={cn(
                'gap-1.5 h-10 px-4 rounded-xl font-semibold',
                'shadow-[0_1px_2px_0_hsl(var(--foreground)/0.08),0_0_0_1px_hsl(43_96%_56%/0.1)]',
                'hover:shadow-gold transition-all duration-200',
              )}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> New Shipment
            </Button>
          </Link>
        </div>
      </header>

      {/* ─── Metrics ──────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Shipments"
          value={activeShipments}
          trend="flat"
          trendLabel={activeShipments === 0 ? 'all clear' : 'in flight'}
          series={cumulativeSeries}
          tone="neutral"
          delay={60}
        />
        <MetricCard
          label="Needs Attention"
          value={attentionCount}
          trend={attentionCount > 0 ? 'up' : 'flat'}
          trendValue={attentionCount > 0 ? `${attention.filter(a => a.severity === 'critical').length} critical` : undefined}
          trendLabel={attentionCount === 0 ? 'inbox empty' : 'review below'}
          series={rejectedSeries}
          tone={attentionCount > 0 ? 'negative' : 'neutral'}
          delay={140}
        />
        <MetricCard
          label="Filed This Month"
          value={filedThisMonth}
          trend="flat"
          trendLabel={`${total} total all-time`}
          series={totalSeries}
          tone="gold"
          delay={220}
        />
        <MetricCard
          label="Acceptance Rate"
          value={acceptanceRate}
          format="percent"
          trend={acceptanceRate >= 90 ? 'up' : acceptanceRate >= 70 ? 'flat' : 'down'}
          trendLabel={
            acceptanceRate >= 90 ? 'excellent' :
            acceptanceRate >= 70 ? 'acceptable' :
            accepted + rejected === 0 ? 'no data yet' :
            'needs review'
          }
          series={acceptedSeries}
          tone={acceptanceRate >= 70 ? 'positive' : 'negative'}
          delay={300}
        />
      </section>

      {/* ─── Needs your attention (unified inbox) ─────────────────────── */}
      <section
        className="rounded-2xl border border-border/60 bg-card opacity-0 animate-fade-in-up"
        style={{ animationDelay: '360ms', animationFillMode: 'forwards' }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center',
              attentionCount === 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            )}>
              {attentionCount === 0
                ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                : <Inbox className="h-4 w-4" strokeWidth={2.5} />}
            </div>
            <div>
              <p className="text-sm font-semibold">Needs your attention</p>
              <p className="text-xs text-muted-foreground">
                {attentionCount === 0
                  ? 'Everything is on track. Nothing needs your action right now.'
                  : `${attentionCount} item${attentionCount === 1 ? '' : 's'} across ISF, manifest, and entry stages`}
              </p>
            </div>
          </div>
        </div>

        {attentionCount === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-3">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              When a filing is rejected, a draft is approaching its deadline, or an ISF clears CBP and is ready for entry, you'll see it here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {attention.slice(0, 6).map(item => {
              const Icon = item.icon;
              const sevColor =
                item.severity === 'critical' ? 'text-red-600 dark:text-red-400 bg-red-500/10' :
                item.severity === 'warn'     ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' :
                'text-blue-600 dark:text-blue-400 bg-blue-500/10';
              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className="group flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', sevColor)}>
                      <Icon className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.sub}</p>
                    </div>
                    {item.age && (
                      <span className="hidden sm:inline text-[11px] tabular-nums text-muted-foreground shrink-0">
                        {item.age}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                </li>
              );
            })}
            {attention.length > 6 && (
              <li className="px-6 py-3 bg-muted/20">
                <p className="text-xs text-muted-foreground text-center">
                  +{attention.length - 6} more item{attention.length - 6 === 1 ? '' : 's'} — scroll the relevant page to address them
                </p>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* ─── Active shipments + Recent activity ───────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Active shipments — lifecycle list */}
        <div
          className="lg:col-span-2 rounded-2xl border border-border/60 bg-card opacity-0 animate-fade-in-up"
          style={{ animationDelay: '440ms', animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Ship className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold">Active shipments</p>
                <p className="text-xs text-muted-foreground">Lifecycle position across ISF · Manifest · Entry · Cleared</p>
              </div>
            </div>
            <Link to="/shipments">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground h-8">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {activeShipmentRows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No active shipments</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first ISF filing to start the workflow</p>
              <Link to="/shipments/new">
                <Button size="sm" className="mt-4">Create shipment</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {activeShipmentRows.map(({ filing: f, stages, next }) => (
                <li key={f.id}>
                  <div className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/30">
                    <Link to={`/shipments/${f.id}`} className="flex-1 min-w-0">
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

                    <LifecycleDots stages={stages} />

                    <div className="hidden sm:block shrink-0">
                      <StatusBadge status={f.status} />
                    </div>

                    {next && (
                      <Link
                        to={next.to}
                        className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors shrink-0"
                      >
                        {next.label}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}

                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div
          className="rounded-2xl border border-border/60 bg-card opacity-0 animate-fade-in-up"
          style={{ animationDelay: '520ms', animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                <ListChecks className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold">Recent activity</p>
                <p className="text-xs text-muted-foreground">Latest events</p>
              </div>
            </div>
          </div>

          {activity.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-muted-foreground">
              Activity will appear here as you file ISFs, run manifest queries, and transmit entries.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {activity.slice(0, 8).map(ev => {
                const dotColor =
                  ev.kind === 'isf' ? 'bg-blue-500' :
                  ev.kind === 'mq'  ? 'bg-amber-500' :
                  ev.status === 'ACCEPTED' ? 'bg-emerald-500' :
                  ev.status === 'REJECTED' ? 'bg-red-500' :
                  'bg-primary';
                return (
                  <li key={ev.id}>
                    <Link to={ev.to} className="group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/30">
                      <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 shrink-0', dotColor)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{ev.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{ev.sub}</p>
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground/70 shrink-0">
                        {relativeTime(ev.ts)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ─── Status breakdown footer ──────────────────────────────────── */}
      <section
        className="rounded-2xl border border-border/60 bg-card p-6 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}
      >
        <div className="flex items-start justify-between gap-6 mb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
              ISF status breakdown
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">All-time distribution across {total.toLocaleString()} filings</p>
          </div>
          <div className={cn(
            'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
            acceptanceRate >= 90 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
            acceptanceRate >= 70 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
            'bg-red-500/10 text-red-600 dark:text-red-400',
          )}>
            {acceptanceRate >= 70
              ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
              : <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {statusBars.map(s => (
            <div key={s.key} className="space-y-1.5">
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
      </section>
    </div>
  );
}
