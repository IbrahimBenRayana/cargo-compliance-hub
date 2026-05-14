import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Sparkles, ChevronDown,
  Clock, Inbox, ListChecks, ShieldCheck, Building2, RotateCcw,
} from 'lucide-react';
import {
  complianceApi,
  type ActionItem,
  type ActionQueueResponse,
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
      <ScoreHero data={data} />
      <ActionQueue items={visible} onSnooze={snooze} onOpenAiCoach={onOpenAiCoach} />
      {snoozedItems.length > 0 && (
        <SnoozedPanel count={snoozedItems.length} onUnsnoozeAll={unsnoozeAll} />
      )}
    </div>
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

// ─── ActionQueue ─────────────────────────────────────────────────────

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
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
      <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
            Action queue
          </h2>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            Sorted by urgency. Snooze pushes an item out for 24 hours.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px] font-semibold">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Badge>
      </header>
      <ol className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((it, idx) => (
          <ActionRow
            key={it.id}
            item={it}
            index={idx}
            onSnooze={onSnooze}
            onOpenAiCoach={onOpenAiCoach}
          />
        ))}
      </ol>
    </section>
  );
}

const SEV_STYLES: Record<ActionItem['severity'], { dot: string; ring: string; label: string }> = {
  critical: { dot: 'bg-rose-500',   ring: 'ring-rose-500/30',   label: 'text-rose-700 dark:text-rose-300' },
  high:     { dot: 'bg-rose-400',   ring: 'ring-rose-400/25',   label: 'text-rose-700 dark:text-rose-300' },
  medium:   { dot: 'bg-amber-500',  ring: 'ring-amber-500/30',  label: 'text-amber-700 dark:text-amber-300' },
  low:      { dot: 'bg-slate-400',  ring: 'ring-slate-400/30',  label: 'text-slate-700 dark:text-slate-300' },
};

function ActionRow({
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
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const sev = SEV_STYLES[item.severity];

  // "Mode" for the AI coach button — rejection items get the rejection
  // coach, everything else gets the pre-flight reviewer.
  const coachMode: 'rejection' | 'draft-review' =
    item.kind === 'rejection' ? 'rejection' : 'draft-review';

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }}
      className="group transition-colors duration-200 hover:bg-slate-50/60 dark:hover:bg-slate-900/40"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-3.5 flex items-start gap-3 text-left cursor-pointer focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-900/40"
      >
        {/* Severity dot — single pulse if new */}
        <span className="relative flex h-2 w-2 shrink-0 mt-2">
          {item.isNew && !reduceMotion && (
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', sev.dot)} />
          )}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full ring-2', sev.dot, sev.ring)} />
        </span>

        <div className="flex-1 min-w-0">
          {/* Top line: title + isNew chip + score badge (right) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-50 leading-tight">
              {item.title}
            </span>
            {item.isNew && (
              <Badge variant="outline" className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
                New
              </Badge>
            )}
            <span className="flex-1" />
            {item.score !== null && <ScoreChip score={item.score} />}
          </div>

          {/* Middle line: origin metadata — company + country */}
          {(item.originCompany || item.originCountry) && (
            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11.5px] text-slate-500 dark:text-slate-400">
              {item.originCompany && (
                <span className="inline-flex items-center gap-1 max-w-[280px] truncate">
                  <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{item.originCompany}</span>
                </span>
              )}
              {item.originCompany && item.originCountry && (
                <span className="text-slate-300 dark:text-slate-700">·</span>
              )}
              {item.originCountry && <CountryChip code={item.originCountry} />}
            </div>
          )}

          {/* Bottom line: 1-line context */}
          <p className={cn('mt-1 text-[12px] leading-relaxed truncate', open && 'whitespace-normal', 'text-slate-600 dark:text-slate-400')}>
            {item.context}
          </p>
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 mt-1',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="px-6 pb-4 -mt-1"
        >
          <div className="pl-5 flex items-center gap-2 flex-wrap">
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAiCoach(item.filingId!, coachMode);
                    }}
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
              onClick={(e) => {
                e.stopPropagation();
                onSnooze(item.id);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
            >
              <Clock className="h-3 w-3" /> Snooze 24h
            </button>
          </div>
        </motion.div>
      )}
    </motion.li>
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

// ─── Score chip + country chip ──────────────────────────────────────

function ScoreChip({ score }: { score: number }) {
  const tone =
    score >= 90 ? { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200/60 dark:ring-emerald-500/20' }
    : score >= 70 ? { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200/60 dark:ring-amber-500/20' }
    : { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-200/60 dark:ring-rose-500/20' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 ring-1 tabular-nums',
        'text-[11px] font-semibold leading-none',
        tone.bg, tone.text, tone.ring,
      )}
      title={`Compliance score for this filing: ${score}/100`}
    >
      <span>{score}</span>
      <span className="text-[9px] font-medium opacity-60">/100</span>
    </span>
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
