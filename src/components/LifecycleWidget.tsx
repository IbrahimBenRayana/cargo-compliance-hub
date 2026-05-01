/**
 * LifecycleWidget — horizontal stage tracker for a single shipment.
 *
 * Drops into ShipmentDetails right after the page header. Shows the
 * 4-stage import lifecycle (ISF Filed → Manifest Verified → Entry
 * Filed → Cleared) with the current shipment's progress overlaid:
 *
 *   ●─────●─────⊙─────○
 *   done  done  active pending
 *
 * The visual language matches the Dashboard pipeline:
 *   ISF      = blue   (cool, beginning)
 *   Manifest = amber  (warm, action)
 *   Entry    = violet (formal, serious)
 *   Cleared  = emerald (success, complete)
 *
 * Each stage shows: title, status detail, age, and (when applicable)
 * a contextual CTA button. The horizontal connector line fills with
 * stage-tinted gradient as stages complete.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Filing } from '@/types/shipment';
import { Button } from '@/components/ui/button';
import { Check, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── ExpandableDetail — long status text with show-more/less ────────

const DETAIL_CHAR_LIMIT = 140;

function ExpandableDetail({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DETAIL_CHAR_LIMIT;

  // Try to extract a readable summary from CC-style JSON error blobs.
  // CC sometimes returns rejection details like:
  //   {"summary":"...short msg...","errors":[{...}]}
  // If we can pull `summary`, that's a much better preview than the raw JSON.
  const friendly = (() => {
    if (!text || text.trim()[0] !== '{') return null;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.summary === 'string') return parsed.summary;
      if (typeof parsed?.message === 'string') return parsed.message;
    } catch { /* fall through to raw */ }
    return null;
  })();

  const preview = friendly ?? text;
  const previewIsLong = preview.length > DETAIL_CHAR_LIMIT;

  if (!isLong && !previewIsLong) {
    return <p className={cn(className, 'break-words')}>{preview}</p>;
  }

  return (
    <div className={cn('w-full', className)}>
      <p
        className={cn(
          'break-words',
          !expanded && 'line-clamp-3',
        )}
      >
        {expanded ? text : preview}
      </p>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(v => !v); }}
        className="mt-1 text-[10.5px] font-medium text-primary/80 hover:text-primary hover:underline focus-visible:outline-none focus-visible:underline"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

// ─── stage definition + computation ──────────────────────────────────

type Stage = 'isf' | 'manifest' | 'entry' | 'cleared';
type State = 'done' | 'active' | 'pending' | 'blocked';

interface AbiLite {
  id: string;
  filingId: string | null;
  status: string;
  updatedAt: string;
  entrySummaryStatus: string | null;
  cargoReleaseStatus: string | null;
}

interface MqLite {
  id: string;
  bolNumber: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface StageNode {
  stage: Stage;
  index: string;       // "01" / "02" / "03" / "04"
  title: string;
  state: State;
  detail: string;
  age: string | null;
  cta?: { label: string; to: string; variant?: 'default' | 'outline' };
}

function relTime(ts: string | null | undefined) {
  if (!ts) return null;
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60)   return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60)   return `${min}m ago`;
  const hr  = Math.floor(min / 60);
  if (hr < 24)    return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30)   return `${day}d ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

export function computeShipmentLifecycle(args: {
  filing: Filing;
  linkedAbi: AbiLite | null;
  linkedMq: MqLite | null;
}): StageNode[] {
  const { filing, linkedAbi, linkedMq } = args;

  // ── Stage 1: ISF Filed
  const isfState: State =
    filing.status === 'accepted' ? 'done'
    : filing.status === 'rejected' ? 'blocked'
    : filing.status === 'cancelled' ? 'pending'
    : 'active';
  const isfDetail =
    filing.status === 'draft' ? 'Draft'
    : filing.status === 'submitted' ? 'At CBP'
    : filing.status === 'pending_cbp' ? 'At CBP'
    : filing.status === 'on_hold' ? 'On hold'
    : filing.status === 'rejected' ? (filing.rejectionReason || 'Rejected') : filing.status === 'accepted' ? 'Accepted by CBP'
    : filing.status === 'cancelled' ? 'Cancelled'
    : filing.status === 'amended' ? 'Amended'
    : filing.status;
  const isfCta: StageNode['cta'] | undefined =
    filing.status === 'draft' ? { label: 'Edit & submit', to: `/shipments/${filing.id}/edit` }
    : filing.status === 'rejected' ? { label: 'Review & resubmit', to: `/shipments/${filing.id}/edit` }
    : undefined;

  // ── Stage 2: Manifest Verified
  let manifestState: State;
  let manifestDetail: string;
  let manifestAge: string | null = null;
  let manifestCta: StageNode['cta'] | undefined;
  if (isfState !== 'done') {
    manifestState = 'pending';
    manifestDetail = 'Awaiting ISF acceptance';
  } else if (linkedMq?.status === 'completed') {
    manifestState = 'done';
    manifestDetail = 'Verified at CBP';
    manifestAge = relTime(linkedMq.completedAt || linkedMq.createdAt);
  } else if (linkedMq?.status === 'pending') {
    manifestState = 'active';
    manifestDetail = 'CBP lookup in progress';
    manifestAge = relTime(linkedMq.createdAt);
  } else if (linkedMq?.status === 'failed' || linkedMq?.status === 'timeout') {
    manifestState = 'blocked';
    manifestDetail = `Lookup ${linkedMq.status}`;
    manifestAge = relTime(linkedMq.createdAt);
    manifestCta = filing.masterBol
      ? { label: 'Retry lookup', to: `/manifest-query?bol=${encodeURIComponent(filing.masterBol)}` }
      : undefined;
  } else {
    manifestState = 'active';
    manifestDetail = 'Run a manifest query';
    manifestCta = filing.masterBol
      ? { label: 'Run query', to: `/manifest-query?bol=${encodeURIComponent(filing.masterBol)}`, variant: 'outline' }
      : undefined;
  }

  // ── Stage 3: Entry Filed
  let entryState: State;
  let entryDetail: string;
  let entryAge: string | null = null;
  let entryCta: StageNode['cta'] | undefined;
  if (isfState !== 'done') {
    entryState = 'pending';
    entryDetail = 'Awaiting ISF acceptance';
  } else if (!linkedAbi) {
    entryState = 'active';
    entryDetail = 'Ready to file 7501 + 3461';
    entryCta = { label: 'File Entry', to: `/abi-documents/new?fromShipment=${filing.id}` };
  } else if (linkedAbi.status === 'ACCEPTED') {
    entryState = 'done';
    entryDetail = 'Transmitted to CBP';
    entryAge = relTime(linkedAbi.updatedAt);
  } else if (linkedAbi.status === 'REJECTED') {
    entryState = 'blocked';
    entryDetail = 'Rejected by CBP';
    entryAge = relTime(linkedAbi.updatedAt);
    entryCta = { label: 'Open entry', to: `/abi-documents/${linkedAbi.id}` };
  } else if (linkedAbi.status === 'DRAFT') {
    entryState = 'active';
    entryDetail = 'Draft — ready to transmit';
    entryAge = relTime(linkedAbi.updatedAt);
    entryCta = { label: 'Open entry', to: `/abi-documents/${linkedAbi.id}` };
  } else if (linkedAbi.status === 'SENDING') {
    entryState = 'active';
    entryDetail = 'Transmitting…';
    entryAge = relTime(linkedAbi.updatedAt);
    entryCta = { label: 'Open entry', to: `/abi-documents/${linkedAbi.id}` };
  } else if (linkedAbi.status === 'SENT') {
    entryState = 'active';
    entryDetail = 'Awaiting CBP disposition';
    entryAge = relTime(linkedAbi.updatedAt);
    entryCta = { label: 'Open entry', to: `/abi-documents/${linkedAbi.id}` };
  } else {
    entryState = 'active';
    entryDetail = `Entry ${linkedAbi.status.toLowerCase()}`;
    entryAge = relTime(linkedAbi.updatedAt);
  }

  // ── Stage 4: Cleared
  let clearedState: State;
  let clearedDetail: string;
  let clearedAge: string | null = null;
  if (linkedAbi?.status === 'ACCEPTED') {
    clearedState = 'done';
    clearedDetail = 'Cleared by CBP';
    clearedAge = relTime(linkedAbi.updatedAt);
  } else if (entryState === 'blocked') {
    clearedState = 'blocked';
    clearedDetail = 'Blocked by entry rejection';
  } else {
    clearedState = 'pending';
    clearedDetail = 'Awaiting entry acceptance';
  }

  return [
    { stage: 'isf',      index: '01', title: 'ISF Filed',         state: isfState,      detail: isfDetail,      age: relTime(filing.submittedAt || filing.updatedAt), cta: isfCta },
    { stage: 'manifest', index: '02', title: 'Manifest Verified', state: manifestState, detail: manifestDetail, age: manifestAge,                                    cta: manifestCta },
    { stage: 'entry',    index: '03', title: 'Entry Filed',       state: entryState,    detail: entryDetail,    age: entryAge,                                       cta: entryCta },
    { stage: 'cleared',  index: '04', title: 'Cleared',           state: clearedState,  detail: clearedDetail,  age: clearedAge,                                     cta: undefined },
  ];
}

// ─── stage style maps ────────────────────────────────────────────────

const STAGE_HEX: Record<Stage, { fill: string; ring: string; glow: string }> = {
  isf:      { fill: 'hsl(217 91% 60%)', ring: 'hsl(217 91% 60% / 0.25)', glow: 'hsl(217 91% 60% / 0.55)' },
  manifest: { fill: 'hsl(38 92% 55%)',  ring: 'hsl(38 92% 55% / 0.25)',  glow: 'hsl(38 92% 55% / 0.55)' },
  entry:    { fill: 'hsl(262 83% 58%)', ring: 'hsl(262 83% 58% / 0.25)', glow: 'hsl(262 83% 58% / 0.55)' },
  cleared:  { fill: 'hsl(160 84% 39%)', ring: 'hsl(160 84% 39% / 0.25)', glow: 'hsl(160 84% 39% / 0.55)' },
};

const STAGE_LABEL_TINT: Record<Stage, string> = {
  isf:      'text-blue-700    dark:text-blue-300',
  manifest: 'text-amber-700   dark:text-amber-400',
  entry:    'text-violet-700  dark:text-violet-300',
  cleared:  'text-emerald-700 dark:text-emerald-400',
};

// ─── stage circle component ──────────────────────────────────────────

function StageCircle({ node }: { node: StageNode }) {
  const colors = STAGE_HEX[node.stage];
  const { state } = node;

  if (state === 'done') {
    return (
      <div
        className="relative h-12 w-12 rounded-full flex items-center justify-center text-white shadow-md transition-transform duration-300 group-hover:scale-105"
        style={{ background: colors.fill, boxShadow: `0 4px 14px -4px ${colors.glow}` }}
        aria-label={`${node.title} done`}
      >
        <Check className="h-5 w-5" strokeWidth={3} />
      </div>
    );
  }

  if (state === 'active') {
    return (
      <div
        className="relative h-12 w-12 rounded-full flex items-center justify-center bg-card border-[2px] transition-all duration-300 group-hover:scale-105"
        style={{ borderColor: colors.fill, boxShadow: `0 0 0 4px ${colors.ring}` }}
        aria-label={`${node.title} active`}
      >
        {/* inner pulsing dot */}
        <span className="relative flex h-3 w-3">
          <span
            className="absolute inset-0 rounded-full opacity-60 animate-ping motion-reduce:animate-none"
            style={{ background: colors.fill }}
          />
          <span className="relative h-3 w-3 rounded-full" style={{ background: colors.fill }} />
        </span>
      </div>
    );
  }

  if (state === 'blocked') {
    return (
      <div
        className="relative h-12 w-12 rounded-full flex items-center justify-center bg-card border-[2px] border-red-500 text-red-600 dark:text-red-400 transition-transform duration-300 group-hover:scale-105"
        style={{ boxShadow: '0 0 0 4px hsl(0 84% 60% / 0.18)' }}
        aria-label={`${node.title} blocked`}
      >
        <AlertTriangle className="h-5 w-5" strokeWidth={2.5} />
      </div>
    );
  }

  // pending
  return (
    <div
      className="relative h-12 w-12 rounded-full flex items-center justify-center bg-card border-[1.5px] border-dashed border-border text-muted-foreground/50 transition-transform duration-300 group-hover:scale-105"
      aria-label={`${node.title} pending`}
    >
      <span className="text-[11px] font-mono font-semibold tabular-nums">{node.index}</span>
    </div>
  );
}

// ─── main widget ─────────────────────────────────────────────────────

interface LifecycleWidgetProps {
  filing: Filing;
  abiDocs?: AbiLite[];
  manifestQueries?: MqLite[];
}

export function LifecycleWidget({ filing, abiDocs = [], manifestQueries = [] }: LifecycleWidgetProps) {
  // Find most-recent linked ABI doc (by filingId)
  const linkedAbi = abiDocs
    .filter(d => d.filingId === filing.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
    ?? null;

  // Find most-recent manifest query (by master BOL)
  const linkedMq = filing.masterBol
    ? manifestQueries
        .filter(q => q.bolNumber === filing.masterBol)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        ?? null
    : null;

  const stages = computeShipmentLifecycle({ filing, linkedAbi, linkedMq });
  const doneCount = stages.filter(s => s.state === 'done').length;
  const blocked = stages.find(s => s.state === 'blocked');

  // Connector progress: how far the colored line should reach.
  // 0 done → 0%, 1 done → 33%, 2 done → 67%, 3+ done → 100%.
  const progress = Math.min(doneCount, 3) / 3;

  return (
    <section className="relative rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Subtle ambient gradient based on overall progress */}
      <div
        className="absolute inset-x-0 top-0 h-24 pointer-events-none opacity-50"
        aria-hidden
        style={{
          background:
            doneCount === 4 ? 'radial-gradient(ellipse 60% 80% at 50% 0%, hsl(160 84% 45% / 0.15), transparent 70%)'
            : blocked ? 'radial-gradient(ellipse 60% 80% at 50% 0%, hsl(0 84% 60% / 0.12), transparent 70%)'
            : 'radial-gradient(ellipse 60% 80% at 50% 0%, hsl(var(--primary) / 0.10), transparent 70%)',
        }}
      />

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/15 flex items-center justify-center">
              {doneCount === 4 ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
              ) : blocked ? (
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" strokeWidth={2.5} />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin motion-reduce:animate-none" strokeWidth={2.5} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">Shipment lifecycle</p>
              <p className="text-xs text-muted-foreground">
                {doneCount === 4 ? 'All four stages complete'
                 : blocked ? `Blocked at ${blocked.title}`
                 : `${doneCount} of 4 stages complete`}
              </p>
            </div>
          </div>
          <div className="text-[11px] tabular-nums text-muted-foreground/70">
            {doneCount}/4
          </div>
        </div>

        {/* Pipeline */}
        <div className="relative">
          {/* Connector line layer (SVG) — sits behind the circles, top-aligned with them */}
          <svg
            className="absolute inset-x-0 w-full pointer-events-none"
            style={{ top: 18, height: 2 }}
            preserveAspectRatio="none"
            aria-hidden
          >
            {/* base track from circle 1 center to circle 4 center */}
            <line
              x1="12.5%" y1="1" x2="87.5%" y2="1"
              stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="3 3"
            />
            {/* progress overlay — gradient that fades through stage colors */}
            {progress > 0 && (
              <line
                x1="12.5%" y1="1"
                x2={`${12.5 + progress * 75}%`} y2="1"
                stroke="url(#lifecycleGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transition: 'all 0.6s ease-out' }}
              />
            )}
            <defs>
              <linearGradient id="lifecycleGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="hsl(217 91% 60%)" />
                <stop offset="40%"  stopColor="hsl(38 92% 55%)" />
                <stop offset="75%"  stopColor="hsl(262 83% 58%)" />
                <stop offset="100%" stopColor="hsl(160 84% 39%)" />
              </linearGradient>
            </defs>
          </svg>

          {/* Stage nodes */}
          <div className="grid grid-cols-4 gap-3 relative">
            {stages.map((node) => (
              <div key={node.stage} className="group flex flex-col items-center text-center min-w-0">
                {/* Circle */}
                <StageCircle node={node} />

                {/* Label */}
                <div className="mt-3 space-y-0.5 max-w-full">
                  <p className={cn(
                    'text-[10.5px] font-semibold uppercase tracking-[0.18em]',
                    node.state === 'done' || node.state === 'active' ? STAGE_LABEL_TINT[node.stage] : 'text-muted-foreground/60',
                  )}>
                    {node.title}
                  </p>
                  <ExpandableDetail
                    text={node.detail}
                    className={cn(
                      'text-[12.5px] font-medium leading-snug px-1',
                      node.state === 'pending' ? 'text-muted-foreground/60' : 'text-foreground',
                    )}
                  />
                  {node.age && (
                    <p className="text-[10.5px] text-muted-foreground/60 tabular-nums">
                      {node.age}
                    </p>
                  )}
                </div>

                {/* CTA */}
                {node.cta && (
                  <Link to={node.cta.to} className="mt-2.5 max-w-full">
                    <Button
                      size="sm"
                      variant={node.cta.variant === 'outline' ? 'outline' : 'default'}
                      className="h-7 px-2.5 text-[11px] gap-1 rounded-lg font-medium"
                    >
                      {node.cta.label}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
