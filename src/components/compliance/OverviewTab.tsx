/**
 * Overview: today's brief, the score with what feeds it, then the filings
 * that need attention. Snoozing hides an item for a day (kept in this
 * browser).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, ChevronRight, Clock, ListChecks, RefreshCw, RotateCcw, ShieldCheck, Sparkles } from '@/components/icons';
import { complianceApi, type ActionItem, type ActionQueueResponse, type HealthNarrativeResponse } from '@/api/client';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { StatusPill } from '@/components/shipments/StatusPill';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const TEXT: Record<Tone, string> = {
  urgent: 'text-urgent', soon: 'text-soon', info: 'text-info', entry: 'text-entry', done: 'text-done', calm: 'text-foreground',
};

/** A score in the page's colours: 90 and up is good, 70 and up is watch, below is act. */
const scoreTone = (score: number | null, good = 90, watch = 70): Tone =>
  score === null ? 'calm' : score >= good ? 'done' : score >= watch ? 'soon' : 'urgent';

const SEVERITY: Record<ActionItem['severity'], Tone> = { critical: 'urgent', high: 'urgent', medium: 'soon', low: 'calm' };

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

  // ?focus=<actionItemId> deep-link from notifications — keep it in state
  // so it survives one render after we clear the URL param (otherwise
  // ActionCard never sees a non-null focusId).
  const [params, setParams] = useSearchParams();
  const initialFocus = params.get('focus');
  const [focusId, setFocusId] = useState<string | null>(initialFocus);
  useEffect(() => {
    if (!initialFocus) return;
    // Clear the param once consumed so refreshes don't re-pulse.
    const next = new URLSearchParams(params);
    next.delete('focus');
    setParams(next, { replace: true });
    // Drop focusId after the pulse animation has had time to play.
    const t = setTimeout(() => setFocusId(null), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocus]);

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
    <div className="flex flex-col gap-5">
      <HealthBrief />
      <ScoreHero data={data} />
      <ActionQueue items={visible} focusId={focusId} onSnooze={snooze} onOpenAiCoach={onOpenAiCoach} />
      {snoozedItems.length > 0 && (
        <SnoozedPanel count={snoozedItems.length} onUnsnoozeAll={unsnoozeAll} />
      )}
    </div>
  );
}

// ─── Today's brief ───────────────────────────────────────────────────

function HealthBrief() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['compliance', 'health-narrative'],
    queryFn: () => complianceApi.healthNarrative(),
    staleTime: 5 * 60_000,
  });
  if (isLoading) return <Skeleton className="h-[58px] rounded-xl" />;
  if (!data) return null;
  return <Brief data={data} refreshing={isFetching} onRefresh={() => qc.invalidateQueries({ queryKey: ['compliance', 'health-narrative'] })} />;
}

function Brief({ data, refreshing, onRefresh }: { data: HealthNarrativeResponse; refreshing: boolean; onRefresh: () => void }) {
  return (
    <section aria-label="Today's brief" className={cn(PANEL, 'flex items-center gap-3 px-5 py-3.5')}>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-muted-foreground">Today's brief, {data.model ? 'written by AI from your filings' : 'worked out from your filings'}</p>
        <p className="mt-0.5 text-[14px] font-medium leading-6">{data.narrative}</p>
      </div>
      <button
        type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh today's brief"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 can-hover:hover:bg-muted can-hover:hover:text-foreground"
      >
        <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin motion-reduce:animate-none')} aria-hidden />
      </button>
    </section>
  );
}

// ─── Score and what feeds it ─────────────────────────────────────────

function ScoreHero({ data }: { data: ActionQueueResponse }) {
  const tone = scoreTone(data.score);
  const reading =
    data.score === null ? 'Not enough recent filings to work out a score.'
    : data.score >= 90 ? 'Strong. Recent filings are being accepted without issues.'
    : data.score >= 70 ? 'Solid, with a few patterns pulling it down. They are listed below.'
    : 'Needs work. Several recent filings ran into issues, listed below.';
  const stats: Array<{ label: string; value: number; tone: Tone; to: string }> = [
    { label: 'Sent, awaiting an answer', value: data.stats.awaitingCbp, tone: 'calm', to: '/shipments?tab=sent' },
    { label: 'Rejected', value: data.stats.withIssues, tone: data.stats.withIssues > 0 ? 'soon' : 'calm', to: '/shipments?tab=rejected' },
    { label: 'High risk', value: data.stats.highRisk, tone: data.stats.highRisk > 0 ? 'urgent' : 'calm', to: '/compliance?tab=risk' },
  ];
  return (
    <section aria-label="Compliance score" className={cn(PANEL, 'grid grid-cols-1 lg:grid-cols-12')}>
      <div className="px-5 py-5 lg:col-span-5">
        <p className="text-[13px] font-medium text-muted-foreground">Compliance score</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className={cn('text-[40px] font-semibold leading-none tracking-[-0.02em] tabular-nums', TEXT[tone])}>{data.score ?? 'None yet'}</span>
          {data.score !== null && <span className="text-[16px] tabular-nums text-muted-foreground">out of 100</span>}
        </p>
        <p className="mt-2 max-w-sm text-[13px] text-foreground/75">{reading}</p>
      </div>
      <ul className="grid grid-cols-3 divide-x divide-border/70 border-t border-border/70 lg:col-span-7 lg:border-l lg:border-t-0">
        {stats.map((s) => (
          <li key={s.label}>
            <Link
              to={s.to}
              className="group flex h-full flex-col justify-center gap-1 px-5 py-4 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring can-hover:hover:bg-muted/50"
            >
              <span className="text-[12px] text-muted-foreground">{s.label}</span>
              <span className="flex items-center justify-between gap-2">
                <span className={cn('text-[24px] font-semibold leading-8 tabular-nums', TEXT[s.tone])}>{s.value.toLocaleString()}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-focus-visible:opacity-100 can-hover:group-hover:opacity-100" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Filings needing attention ───────────────────────────────────────

function ActionQueue({ items, focusId, onSnooze, onOpenAiCoach }: {
  items: ActionItem[];
  focusId: string | null;
  onSnooze: (id: string) => void;
  onOpenAiCoach: (filingId: string, mode: 'rejection' | 'draft-review') => void;
}) {
  if (items.length === 0) return <EmptyActionQueue />;
  return (
    <section aria-labelledby="attention-title">
      <header className="mb-3">
        <h2 id="attention-title" className="text-[14px] font-semibold">
          Filings needing attention <span className="font-normal tabular-nums text-muted-foreground">{items.length}</span>
        </h2>
        <p className="text-[13px] text-muted-foreground">Most urgent first. Snooze hides one for 24 hours.</p>
      </header>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((it) => (
          <ActionCard key={it.id} item={it} isFocused={focusId === it.id} onSnooze={onSnooze} onOpenAiCoach={onOpenAiCoach} />
        ))}
      </ul>
    </section>
  );
}

function ActionCard({ item, isFocused, onSnooze, onOpenAiCoach }: {
  item: ActionItem;
  isFocused: boolean;
  onSnooze: (id: string) => void;
  onOpenAiCoach: (filingId: string, mode: 'rejection' | 'draft-review') => void;
}) {
  const cardRef = useRef<HTMLLIElement>(null);

  // A notification links here with ?focus=<id>: bring that card into view.
  useEffect(() => {
    if (!isFocused) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const raf = requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' }));
    return () => cancelAnimationFrame(raf);
  }, [isFocused]);

  const coachMode = item.kind === 'rejection' ? 'rejection' : 'draft-review';
  const tone = SEVERITY[item.severity];

  return (
    <li ref={cardRef} className={cn(PANEL, 'flex flex-col px-5 py-4', isFocused && 'mcl-focus-pulse')}>
      <div className="flex items-start gap-3">
        {item.score !== null ? (
          <span
            title={`This filing scores ${item.score} out of 100`}
            className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[15px] font-semibold tabular-nums', TINT[scoreTone(item.score, 80, 50)])}
          >
            {item.score}<span className="sr-only"> out of 100</span>
          </span>
        ) : (
          <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', TINT.urgent)}>
            <ListChecks weight="duotone" className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="flex items-start gap-2 text-[14px] font-semibold leading-5">
            <span aria-hidden className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', FILL[tone])} />
            <span className="min-w-0">{item.title}</span>
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
            {item.status && <StatusPill status={item.status} />}
            {item.isNew && <span className={cn('rounded-md px-2 py-0.5 text-[12px] font-medium', TINT.info)}>New</span>}
            {item.originCompany && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{item.originCompany}</span>
              </span>
            )}
            {item.originCountry && <span className="font-mono text-[12px]">{item.originCountry}</span>}
          </div>
        </div>
      </div>

      <p className="mt-3 flex-1 text-[13px] text-foreground/80">{item.context}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        {item.actions.map((a, i) => {
          if (a.kind === 'open' && a.href) {
            return <Button key={i} asChild size="sm" variant="outline" className="h-8"><Link to={a.href}>{a.label}<ArrowRight aria-hidden /></Link></Button>;
          }
          if (a.kind === 'coach' && item.filingId) {
            return (
              <Button key={i} type="button" size="sm" variant="outline" className="h-8" onClick={() => onOpenAiCoach(item.filingId!, coachMode)}>
                <Sparkles aria-hidden />{a.label}
              </Button>
            );
          }
          return null;
        })}
        <Button type="button" size="sm" variant="ghost" className="ml-auto h-8 text-muted-foreground" onClick={() => onSnooze(item.id)}>
          <Clock aria-hidden />Snooze
        </Button>
      </div>
    </li>
  );
}

function EmptyActionQueue() {
  return (
    <section className={cn(PANEL, 'flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-5')}>
      <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-white dark:text-background', FILL.done)}>
        <ShieldCheck weight="duotone" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="text-[16px] font-semibold leading-6">Nothing needs your attention.</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Cutoffs, rejections and forced-labor risks show here when they come up.</p>
      </div>
      <Button asChild size="sm" variant="outline"><Link to="/shipments/new">New shipment<ArrowRight aria-hidden /></Link></Button>
    </section>
  );
}

function SnoozedPanel({ count, onUnsnoozeAll }: { count: number; onUnsnoozeAll: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-5 py-2.5">
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        <span><span className="font-medium tabular-nums text-foreground">{count}</span> {count === 1 ? 'item' : 'items'} snoozed for 24 hours</span>
      </p>
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onUnsnoozeAll}><RotateCcw aria-hidden />Show again</Button>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-[58px] rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
