import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Sparkles, ChevronDown,
  Clock, Inbox, ListChecks, ShieldCheck, Building2, RotateCcw, RefreshCw,
} from 'lucide-react';
import {
  complianceApi,
  type ActionItem,
  type ActionQueueResponse,
  type HealthNarrativeResponse,
} from '@/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * "Overview" tab — replaces the old Health tab.
 *
 * Layout:
 *   1. ScoreHero  — left: large compliance-score number with delta; right:
 *                   3 contextual stats (Awaiting CBP, With issues, High
 *                   risk). All clickable into filtered shipment lists.
 *   2. ActionQueue — vertical list of action items grouped by severity.
 *                   Each row expandable inline. Per-row actions: Open,
 *                   AI coach (opens the existing drawer). Snooze persists
 *                   in localStorage so the same item doesn't keep showing.
 *
 * Deliberate omissions vs. the old design:
 *   • No rejection-trend area chart (retrospective; doesn't drive action)
 *   • No top-5 reasons bar chart (now folded into "bulk-fix" action items)
 *   • No equal-weight KPI grid (broken asymmetric hierarchy instead)
 */

const SNOOZE_LS_KEY = 'mcl_compliance_snoozed_v1';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000;

interface SnoozedRecord { id: string; until: number }

function readSnoozed(): Map<string, number> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = window.localStorage.getItem(SNOOZE_LS_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as SnoozedRecord[];
    return new Map(arr.filter((r) => r.until > Date.now()).map((r) => [r.id, r.until]));
  } catch {
    return new Map();
  }
}
function writeSnoozed(map: Map<string, number>) {
  if (typeof window === 'undefined') return;
  const arr: SnoozedRecord[] = Array.from(map.entries()).map(([id, until]) => ({ id, until }));
  window.localStorage.setItem(SNOOZE_LS_KEY, JSON.stringify(arr));
}

interface OverviewTabProps {
  /** Opens the AI Coach drawer for the given filing. Provided by parent so
   *  one drawer instance lives at page level — no nested mounts. */
  onOpenAiCoach: (filingId: string, mode: 'rejection' | 'draft-review') => void;
}

export function OverviewTab({ onOpenAiCoach }: OverviewTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance', 'action-queue'],
    queryFn: () => complianceApi.actionQueue(),
    staleTime: 60_000,
  });

  const [snoozed, setSnoozed] = useState<Map<string, number>>(() => readSnoozed());

  function snooze(id: string) {
    const next = new Map(snoozed);
    next.set(id, Date.now() + SNOOZE_DURATION_MS);
    setSnoozed(next);
    writeSnoozed(next);
  }
  function unsnoozeAll() {
    setSnoozed(new Map());
    writeSnoozed(new Map());
  }

  const { visible, snoozedItems } = useMemo(() => {
    if (!data) return { visible: [] as ActionItem[], snoozedItems: [] as ActionItem[] };
    return {
      visible:      data.actionQueue.filter((it) => !snoozed.has(it.id)),
      snoozedItems: data.actionQueue.filter((it) =>  snoozed.has(it.id)),
    };
  }, [data, snoozed]);

  if (isLoading || !data) return <OverviewSkeleton />;

  return (
    <div className="space-y-6">
      <HealthBrief />
      <ScoreHero data={data} />
      <ActionQueue items={visible} onSnooze={snooze} onOpenAiCoach={onOpenAiCoach} />
      {snoozedItems.length > 0 && (
        <SnoozedPanel count={snoozedItems.length} onUnsnoozeAll={unsnoozeAll} />
      )}
    </div>
  );
}

// ─── Health Brief (AI 1-line summary) ────────────────────────────────

function HealthBrief() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['compliance', 'health-narrative'],
    queryFn: () => complianceApi.healthNarrative(),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return <Skeleton className="h-[58px] rounded-2xl" />;
  }
  if (!data) return null;

  return <HealthBriefCard data={data} refreshing={isFetching} onRefresh={() => qc.invalidateQueries({ queryKey: ['compliance', 'health-narrative'] })} />;
}

function HealthBriefCard({
  data, refreshing, onRefresh,
}: {
  data: HealthNarrativeResponse;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const isAi = !!data.model;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      {/* Subtle gold→transparent wash from the right — the brief is AI-attributed, so we lean amber */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-[55%] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(43 96% 56% / 0.07), transparent 70%)',
        }}
      />
      <div className="relative px-5 py-3.5 flex items-center gap-4">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 shadow-[0_8px_20px_-10px_rgba(245,158,11,0.5)] flex items-center justify-center shrink-0">
          <Sparkles className="h-[18px] w-[18px] text-amber-950" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400 mb-0.5">
            Today's brief
            {isAi ? (
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 normal-case tracking-normal">· AI-generated</span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 normal-case tracking-normal">· rules-based</span>
            )}
          </div>
          <p className="text-[13.5px] text-slate-800 dark:text-slate-100 leading-relaxed truncate sm:whitespace-normal">
            {data.narrative}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
          aria-label="Regenerate today's brief"
          title="Regenerate"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>
    </article>
  );
}

// ─── Snoozed panel ──────────────────────────────────────────────────

function SnoozedPanel({
  count,
  onUnsnoozeAll,
}: {
  count: number;
  onUnsnoozeAll: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-[12.5px]">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{count}</span>{' '}
          {count === 1 ? 'item' : 'items'} snoozed for 24h
        </span>
      </div>
      <button
        type="button"
        onClick={onUnsnoozeAll}
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors duration-200"
      >
        <RotateCcw className="h-3 w-3" />
        Un-snooze all
      </button>
    </div>
  );
}

// ─── ScoreHero ───────────────────────────────────────────────────────

function ScoreHero({ data }: { data: ActionQueueResponse }) {
  const reduceMotion = useReducedMotion();
  const target = data.score ?? 0;
  const [display, setDisplay] = useState(reduceMotion ? target : 0);
  // Mount-only count-up. Skip on refetch — we only want the entrance to feel alive.
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current || reduceMotion) {
      setDisplay(target);
      return;
    }
    hasAnimated.current = true;
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduceMotion]);

  const tone =
    data.score === null ? 'neutral'
    : data.score >= 90 ? 'emerald'
    : data.score >= 70 ? 'amber'
    : 'rose';

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      {/* Subtle radial wash — Stripe-style. Confined to the hero, not page-wide,
          so the rest of the tab content reads on a clean surface. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 18% 0%, hsl(43 96% 56% / 0.10), transparent 70%), radial-gradient(ellipse 60% 60% at 95% 100%, hsl(222 47% 22% / 0.06), transparent 70%)',
        }}
      />
      <div className="relative px-6 sm:px-7 py-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Score number */}
        <div className="lg:col-span-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Compliance score
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                'text-[56px] font-semibold leading-none tabular-nums tracking-tight',
                tone === 'emerald' && 'text-emerald-700 dark:text-emerald-300',
                tone === 'amber'   && 'text-amber-700   dark:text-amber-300',
                tone === 'rose'    && 'text-rose-700    dark:text-rose-300',
                tone === 'neutral' && 'text-slate-900   dark:text-slate-50',
              )}
            >
              {data.score === null ? '—' : display}
            </span>
            <span className="text-[20px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
              / 100
            </span>
          </div>
          <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            {data.score === null
              ? 'Not enough recent filings to compute a score.'
              : data.score >= 90
                ? 'Strong — filings are clearing cleanly.'
                : data.score >= 70
                  ? 'Solid, but a few patterns are dragging it down. Check the action queue.'
                  : 'Action needed. Multiple recent filings hit issues — see below.'}
          </p>
        </div>

        {/* 3-stat strip */}
        <div className="lg:col-span-7 grid grid-cols-3 gap-3">
          <StatTile
            icon={<Inbox className="h-3.5 w-3.5" />}
            label="Awaiting CBP"
            value={data.stats.awaitingCbp}
            href="/shipments?status=submitted"
          />
          <StatTile
            icon={<ListChecks className="h-3.5 w-3.5" />}
            label="With issues"
            value={data.stats.withIssues}
            tone={data.stats.withIssues > 0 ? 'amber' : 'neutral'}
            href="/shipments?status=rejected"
          />
          <StatTile
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="High risk"
            value={data.stats.highRisk}
            tone={data.stats.highRisk > 0 ? 'rose' : 'neutral'}
            href="/compliance?tab=risk"
          />
        </div>
      </div>
    </section>
  );
}

function StatTile({
  icon, label, value, tone = 'neutral', href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'neutral' | 'amber' | 'rose';
  href: string;
}) {
  const navigate = useNavigate();
  const colors =
    tone === 'rose'  ? 'hover:bg-rose-50/60  dark:hover:bg-rose-500/[0.06]  text-rose-700  dark:text-rose-300'
  : tone === 'amber' ? 'hover:bg-amber-50/60 dark:hover:bg-amber-500/[0.06] text-amber-700 dark:text-amber-300'
  :                    'hover:bg-slate-50    dark:hover:bg-slate-900/60     text-slate-900 dark:text-slate-50';
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={cn(
        'group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-4 py-3 text-left transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        colors,
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] opacity-70">
          {label}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[26px] font-semibold leading-none tabular-nums">{value}</span>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity duration-200 mb-1" />
      </div>
    </button>
  );
}

// ─── ActionQueue (card grid) ─────────────────────────────────────────

function ActionQueue({
  items,
  onSnooze,
  onOpenAiCoach,
}: {
  items: ActionItem[];
  onSnooze: (id: string) => void;
  onOpenAiCoach: (filingId: string, mode: 'rejection' | 'draft-review') => void;
}) {
  if (items.length === 0) return <EmptyActionQueue />;

  return (
    <section>
      <header className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
            Filings needing attention
          </h2>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            Sorted by urgency. Click a card to expand · Snooze pushes it out 24 hours.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px] font-semibold shrink-0">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Badge>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map((it, idx) => (
          <ActionCard
            key={it.id}
            item={it}
            index={idx}
            onSnooze={onSnooze}
            onOpenAiCoach={onOpenAiCoach}
          />
        ))}
      </div>
    </section>
  );
}

const SEV_STYLES: Record<ActionItem['severity'], { dot: string; ring: string; label: string }> = {
  critical: { dot: 'bg-rose-500',   ring: 'ring-rose-500/30',   label: 'text-rose-700 dark:text-rose-300' },
  high:     { dot: 'bg-rose-400',   ring: 'ring-rose-400/25',   label: 'text-rose-700 dark:text-rose-300' },
  medium:   { dot: 'bg-amber-500',  ring: 'ring-amber-500/30',  label: 'text-amber-700 dark:text-amber-300' },
  low:      { dot: 'bg-slate-400',  ring: 'ring-slate-400/30',  label: 'text-slate-700 dark:text-slate-300' },
};

function ActionCard({
  item,
  index,
  onSnooze,
  onOpenAiCoach,
}: {
  item: ActionItem;
  index: number;
  onSnooze: (id: string) => void;
  onOpenAiCoach: (filingId: string, mode: 'rejection' | 'draft-review') => void;
}) {
  const reduceMotion = useReducedMotion();
  const sev = SEV_STYLES[item.severity];

  // AI coach mode — rejected → rejection coach; everything else → pre-flight.
  const coachMode: 'rejection' | 'draft-review' =
    item.kind === 'rejection' ? 'rejection' : 'draft-review';

  // Top-left accent line tone — visual signal of urgency without dominating
  // the card. Sits flush with the left edge, 3px wide.
  const accent =
    item.severity === 'critical' ? 'bg-rose-500'
    : item.severity === 'high'   ? 'bg-rose-400'
    : item.severity === 'medium' ? 'bg-amber-500'
    :                              'bg-slate-300';

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-200"
    >
      {/* Left accent bar */}
      <span className={cn('absolute left-0 top-0 bottom-0 w-1', accent)} aria-hidden />

      <div className="pl-5 pr-5 py-4">
        {/* Top row: donut + title + status badge */}
        <div className="flex items-start gap-4">
          {item.score !== null ? (
            <ScoreDonut score={item.score} pulse={item.isNew && !reduceMotion} />
          ) : (
            <BulkFixIcon />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-50 leading-tight truncate">
                {item.title}
              </h3>
              {item.isNew && (
                <Badge variant="outline" className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
                  New
                </Badge>
              )}
            </div>
            {item.status && <StatusPill status={item.status} className="mt-1.5" />}

            {/* Origin row — company + country chip */}
            {(item.originCompany || item.originCountry) && (
              <div className="mt-2 flex items-center gap-2 flex-wrap text-[11.5px] text-slate-500 dark:text-slate-400">
                {item.originCompany && (
                  <span className="inline-flex items-center gap-1 max-w-full min-w-0">
                    <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{item.originCompany}</span>
                  </span>
                )}
                {item.originCountry && <CountryChip code={item.originCountry} />}
              </div>
            )}
          </div>
        </div>

        {/* Context */}
        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
          {item.context}
        </p>

        {/* Actions footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 flex-wrap">
          {item.actions.map((a, i) => {
            if (a.kind === 'open' && a.href) {
              return (
                <Link
                  key={i}
                  to={a.href}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
                >
                  {a.label} <ArrowRight className="h-3 w-3" />
                </Link>
              );
            }
            if (a.kind === 'coach' && item.filingId) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onOpenAiCoach(item.filingId!, coachMode)}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-colors duration-200"
                >
                  <Sparkles className="h-3 w-3" /> {a.label}
                </button>
              );
            }
            return null;
          })}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => onSnooze(item.id)}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
            title="Hide this card for 24 hours"
          >
            <Clock className="h-3 w-3" /> Snooze
          </button>
        </div>
      </div>

      {/* Sev pulse echo — single pulse for new items, behind the accent bar */}
      {item.isNew && !reduceMotion && (
        <span className={cn('absolute left-0 top-0 bottom-0 w-1 opacity-60 animate-pulse', sev.dot)} aria-hidden />
      )}
    </motion.article>
  );
}

// ─── Status pill (filing status badge on the card) ──────────────────

function StatusPill({ status, className }: { status: string; className?: string }) {
  const map: Record<string, { label: string; bg: string; text: string; ring: string }> = {
    rejected:    { label: 'Rejected',     bg: 'bg-rose-50 dark:bg-rose-500/10',       text: 'text-rose-700 dark:text-rose-300',       ring: 'ring-rose-200/60 dark:ring-rose-500/20' },
    draft:       { label: 'Draft',        bg: 'bg-slate-50 dark:bg-slate-500/10',     text: 'text-slate-700 dark:text-slate-300',     ring: 'ring-slate-200 dark:ring-slate-700' },
    submitted:   { label: 'Submitted',    bg: 'bg-blue-50 dark:bg-blue-500/10',       text: 'text-blue-700 dark:text-blue-300',       ring: 'ring-blue-200/60 dark:ring-blue-500/20' },
    pending_cbp: { label: 'Pending CBP',  bg: 'bg-blue-50 dark:bg-blue-500/10',       text: 'text-blue-700 dark:text-blue-300',       ring: 'ring-blue-200/60 dark:ring-blue-500/20' },
    on_hold:     { label: 'On Hold',      bg: 'bg-amber-50 dark:bg-amber-500/10',     text: 'text-amber-700 dark:text-amber-300',     ring: 'ring-amber-200/60 dark:ring-amber-500/20' },
    accepted:    { label: 'Accepted',     bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200/60 dark:ring-emerald-500/20' },
    amended:     { label: 'Amended',      bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200/60 dark:ring-emerald-500/20' },
    cancelled:   { label: 'Cancelled',    bg: 'bg-slate-50 dark:bg-slate-500/10',     text: 'text-slate-500 dark:text-slate-400',     ring: 'ring-slate-200 dark:ring-slate-700' },
  };
  const cfg = map[status] ?? { label: status, bg: 'bg-slate-50 dark:bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', ring: 'ring-slate-200 dark:ring-slate-700' };
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded ring-1',
      'text-[10px] font-semibold uppercase tracking-[0.06em]',
      cfg.bg, cfg.text, cfg.ring,
      className,
    )}>
      {cfg.label}
    </span>
  );
}

// ─── BulkFixIcon (placeholder for items without a score, e.g. bulk-fix) ──

function BulkFixIcon() {
  return (
    <div className="h-12 w-12 rounded-full bg-rose-50 dark:bg-rose-500/10 ring-1 ring-rose-200/60 dark:ring-rose-500/20 flex items-center justify-center shrink-0">
      <ListChecks className="h-5 w-5 text-rose-600 dark:text-rose-400" />
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyActionQueue() {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-10 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-200/60 dark:ring-emerald-500/20 flex items-center justify-center mb-4">
        <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50 mb-1.5">
        Nothing needs your attention right now.
      </h3>
      <p className="text-[12.5px] text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
        New filings, deadlines, rejections, and UFLPA risks will show up here when they appear. Check back later, or
        <Link to="/shipments/new" className="ml-1 underline text-primary hover:opacity-80">
          start a new ISF
        </Link>.
      </p>
    </section>
  );
}

// ─── Score donut + country chip ─────────────────────────────────────

/**
 * Small SVG donut showing the compliance score 0–100 with the percentage
 * in the middle. Stroke is color-toned by score tier (emerald ≥80 / amber ≥50
 * / rose <50). Animates the arc on first mount only (skipped if
 * prefers-reduced-motion).
 */
function ScoreDonut({ score, pulse = false }: { score: number; pulse?: boolean }) {
  const reduceMotion = useReducedMotion();
  // Animate stroke on mount only.
  const [drawn, setDrawn] = useState(reduceMotion ? score : 0);
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current || reduceMotion) {
      setDrawn(score);
      return;
    }
    hasAnimated.current = true;
    const duration = 700;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDrawn(Math.round(score * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score, reduceMotion]);

  const size = 48;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, drawn)) / 100) * c;

  const tone =
    score >= 80 ? { stroke: 'stroke-emerald-500 dark:stroke-emerald-400', text: 'text-emerald-700 dark:text-emerald-300' }
    : score >= 50 ? { stroke: 'stroke-amber-500 dark:stroke-amber-400',  text: 'text-amber-700 dark:text-amber-300' }
    :              { stroke: 'stroke-rose-500 dark:stroke-rose-400',    text: 'text-rose-700 dark:text-rose-300' };

  return (
    <div className={cn('relative shrink-0', pulse && 'animate-pulse')} title={`Compliance score: ${score}/100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className={cn(tone.stroke, 'transition-[stroke-dashoffset] duration-700 ease-out')}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="none"
        />
      </svg>
      <div className={cn(
        'absolute inset-0 flex items-center justify-center font-semibold tabular-nums leading-none',
        'text-[12px]',
        tone.text,
      )}>
        {drawn}
        <span className="text-[8px] font-medium ml-0.5 opacity-60">%</span>
      </div>
    </div>
  );
}

function CountryChip({ code }: { code: string }) {
  // ISO-2 chip — small, restrained, monospace. No flag emoji (per app convention).
  return (
    <span className="inline-flex items-center font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 uppercase tracking-wider">
      {code}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
