/**
 * LifecycleWidget: where one shipment stands, in four stages (ISF, Manifest,
 * Entry filed, Entry accepted). Each stage says only what is stored: the app
 * never sees CBP release a cargo, so nothing here says cleared or released.
 *
 * Colours follow the rest of the app by state, not by stage: green done, blue
 * in progress, red blocked, amber on hold, grey not started or stopped.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Filing } from '@/types/shipment';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, Ban, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { useCapabilities } from '@/hooks/useBilling';
import { CAPABILITIES } from '@/lib/planMeta';
import { parseRejectionReason } from '@/components/RejectionDetailsCard';

/** One-line label for the lifecycle stage when a filing is rejected.
 *  Picks the cleanest signal in this order:
 *    1. parsed.summary  (e.g. "BOLValidations: BOL Numbers already exist: MAEU…")
 *    2. parsed.errors[0].message  (first user-friendly error)
 *    3. parsed.fallbackRaw  (plain-text rejection with [object Object] cleaned out)
 *    4. 'Rejected'
 *  Truncates to 80 chars so it fits the stage card width. */
function rejectionOneLiner(reason: string | null | undefined): string {
  if (!reason) return 'Rejected';
  const parsed = parseRejectionReason(reason);
  const candidate =
    parsed.summary?.trim() ||
    parsed.errors[0]?.message?.trim() ||
    parsed.fallbackRaw?.trim() ||
    'Rejected';
  return candidate.length > 80 ? candidate.slice(0, 77) + '…' : candidate;
}

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

type Stage = 'isf' | 'manifest' | 'entry' | 'accepted';
type State = 'done' | 'active' | 'pending' | 'blocked' | 'stopped';

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
  index: string;
  title: string;
  state: State;
  /** Overrides the state's colour, for an ISF on hold. */
  tone?: Tone;
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

const AFTER_ISF = 'After the ISF is accepted';
const STOPPED = 'ISF cancelled';

function isfStage(filing: Filing): Omit<StageNode, 'stage' | 'index' | 'title' | 'age'> {
  const edit = `/shipments/${filing.id}/edit`;
  switch (filing.status) {
    case 'accepted': return { state: 'done', detail: 'Accepted by CBP' };
    case 'amended': return { state: 'done', detail: 'Accepted by CBP, amended' };
    case 'submitted':
    case 'pending_cbp': return { state: 'active', detail: 'Sent, waiting for CBP' };
    case 'draft': return { state: 'active', detail: 'Draft, not sent yet', cta: { label: 'Edit and send', to: edit } };
    case 'on_hold': return { state: 'active', tone: 'soon', detail: 'On hold' };
    case 'rejected': return { state: 'blocked', detail: rejectionOneLiner(filing.rejectionReason), cta: { label: 'Fix and resend', to: edit } };
    case 'cancelled': return { state: 'stopped', detail: 'Cancelled' };
    default: return { state: 'active', detail: filing.status };
  }
}

export function computeShipmentLifecycle(args: {
  filing: Filing;
  linkedAbi: AbiLite | null;
  linkedMq: MqLite | null;
  // ABI Entry is a gated capability (Entry+ tiers). When false, the Entry
  // stage still shows as part of the lifecycle but we omit the "File entry"
  // action so ISF-only orgs aren't sent to a feature they can't use. Defaults
  // true to preserve behavior for any caller that doesn't pass it.
  canFileEntry?: boolean;
}): StageNode[] {
  const { filing, linkedAbi, linkedMq, canFileEntry = true } = args;
  const isf = isfStage(filing);
  const isfDone = isf.state === 'done';
  const stopped = isf.state === 'stopped';
  const waiting = (): Omit<StageNode, 'stage' | 'index' | 'title'> =>
    stopped ? { state: 'stopped', detail: STOPPED, age: null } : { state: 'pending', detail: AFTER_ISF, age: null };

  // ── Manifest: the latest query for this master bill.
  let manifest: Omit<StageNode, 'stage' | 'index' | 'title'>;
  const query = filing.masterBol ? `/manifest-query?bol=${encodeURIComponent(filing.masterBol)}` : null;
  if (!isfDone) manifest = waiting();
  else if (linkedMq?.status === 'completed') manifest = { state: 'done', detail: 'Manifest checked', age: relTime(linkedMq.completedAt || linkedMq.createdAt) };
  else if (linkedMq?.status === 'pending') manifest = { state: 'active', detail: 'Lookup running', age: relTime(linkedMq.createdAt) };
  else if (linkedMq?.status === 'failed' || linkedMq?.status === 'timeout') {
    manifest = {
      state: 'blocked',
      detail: linkedMq.status === 'failed' ? 'Lookup failed' : 'Lookup timed out',
      age: relTime(linkedMq.createdAt),
      cta: query ? { label: 'Try again', to: query } : undefined,
    };
  } else manifest = { state: 'active', detail: 'Not checked yet', age: null, cta: query ? { label: 'Check manifest', to: query, variant: 'outline' } : undefined };

  // ── Entry filed, and entry accepted: the latest entry made from this shipment.
  let entry: Omit<StageNode, 'stage' | 'index' | 'title'>;
  let accepted: Omit<StageNode, 'stage' | 'index' | 'title'>;
  const open = linkedAbi ? { label: 'Open entry', to: `/abi-documents/${linkedAbi.id}` } : undefined;
  const at = relTime(linkedAbi?.updatedAt);
  if (!isfDone) {
    entry = waiting();
    accepted = waiting();
  } else if (!linkedAbi) {
    entry = { state: 'active', detail: 'Not filed yet', age: null, cta: canFileEntry ? { label: 'File entry', to: `/abi-documents/new?fromShipment=${filing.id}` } : undefined };
    accepted = { state: 'pending', detail: 'After the entry is filed', age: null };
  } else {
    switch (linkedAbi.status) {
      case 'ACCEPTED':
        entry = { state: 'done', detail: 'Sent to CBP', age: null };
        accepted = { state: 'done', detail: 'Accepted by CBP', age: at, cta: open };
        break;
      case 'SENT':
        entry = { state: 'done', detail: 'Sent to CBP', age: at };
        accepted = { state: 'active', detail: 'Waiting for CBP', age: null, cta: open };
        break;
      case 'SENDING':
        entry = { state: 'active', detail: 'Sending to CBP', age: at, cta: open };
        accepted = { state: 'pending', detail: 'After the entry is filed', age: null };
        break;
      case 'REJECTED':
        entry = { state: 'blocked', detail: 'Rejected by CBP', age: at, cta: open };
        accepted = { state: 'blocked', detail: 'Entry rejected', age: null };
        break;
      case 'DRAFT':
        entry = { state: 'active', detail: 'Entry draft, not sent yet', age: at, cta: open };
        accepted = { state: 'pending', detail: 'After the entry is filed', age: null };
        break;
      default:
        entry = { state: 'active', detail: `Entry ${linkedAbi.status.toLowerCase()}`, age: at, cta: open };
        accepted = { state: 'pending', detail: 'After the entry is filed', age: null };
    }
  }

  return [
    { stage: 'isf', index: '1', title: 'ISF', ...isf, age: relTime(filing.submittedAt || filing.updatedAt) },
    { stage: 'manifest', index: '2', title: 'Manifest', ...manifest },
    { stage: 'entry', index: '3', title: 'Entry filed', ...entry },
    { stage: 'accepted', index: '4', title: 'Entry accepted', ...accepted },
  ];
}

// ─── presentation ────────────────────────────────────────────────────

/** "Blocked at the ISF", not "Blocked at isf". */
const AT: Record<Stage, string> = { isf: 'the ISF', manifest: 'the manifest', entry: 'the entry', accepted: 'entry acceptance' };

export function lifecycleSummary(stages: StageNode[]): string {
  const done = stages.filter(s => s.state === 'done').length;
  const blocked = stages.find(s => s.state === 'blocked');
  if (stages[0].state === 'stopped') return 'The ISF was cancelled';
  if (blocked) return `Blocked at ${AT[blocked.stage]}`;
  return done === stages.length ? 'Every stage done' : `${done} of ${stages.length} done`;
}

const STATE_TONE: Record<State, Tone> = { done: 'done', active: 'info', blocked: 'urgent', pending: 'calm', stopped: 'calm' };
const RING: Record<Tone, string> = {
  urgent: 'ring-[hsl(var(--urgent-fill)/0.4)]', soon: 'ring-[hsl(var(--soon-fill)/0.45)]', info: 'ring-[hsl(var(--info-fill)/0.45)]',
  entry: 'ring-[hsl(var(--entry-fill)/0.45)]', done: 'ring-[hsl(var(--done-fill)/0.45)]', calm: 'ring-border',
};
const toneOf = (node: StageNode) => node.tone ?? STATE_TONE[node.state];

function StageDot({ node }: { node: StageNode }) {
  const tone = toneOf(node);
  const base = 'relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums';
  if (node.state === 'done') {
    return <span className={cn(base, FILL.done, 'text-white dark:text-background')}><Check className="h-4 w-4" strokeWidth={3} aria-hidden /></span>;
  }
  if (node.state === 'blocked') return <span className={cn(base, TINT.urgent, 'ring-1 ring-inset', RING.urgent)}><AlertTriangle className="h-4 w-4" aria-hidden /></span>;
  if (node.state === 'stopped') return <span className={cn(base, 'bg-muted text-muted-foreground')}><Ban className="h-4 w-4" aria-hidden /></span>;
  if (node.state === 'active') {
    return (
      <span className={cn(base, TINT[tone], 'ring-2 ring-inset', RING[tone])}>
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className={cn('absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping', FILL[tone])} />
          <span className={cn('relative h-2.5 w-2.5 rounded-full', FILL[tone])} />
        </span>
      </span>
    );
  }
  return <span className={cn(base, 'border border-dashed border-border bg-card text-muted-foreground')}>{node.index}</span>;
}

const DETAIL_TEXT: Record<Tone, string> = {
  done: 'text-done', info: 'text-info', urgent: 'text-urgent', soon: 'text-soon', entry: 'text-entry', calm: 'text-muted-foreground',
};

interface LifecycleWidgetProps {
  filing: Filing;
  abiDocs?: AbiLite[];
  manifestQueries?: MqLite[];
}

export function LifecycleWidget({ filing, abiDocs = [], manifestQueries = [] }: LifecycleWidgetProps) {
  // The most recent entry made from this shipment, and query for its master bill.
  const linkedAbi = abiDocs
    .filter(d => d.filingId === filing.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
    ?? null;
  const linkedMq = filing.masterBol
    ? manifestQueries
        .filter(q => q.bolNumber === filing.masterBol)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        ?? null
    : null;
  const { can } = useCapabilities();
  const stages = computeShipmentLifecycle({ filing, linkedAbi, linkedMq, canFileEntry: can(CAPABILITIES.ABI_ENTRY) });

  const done = stages.filter(s => s.state === 'done').length;
  const blocked = stages.find(s => s.state === 'blocked');
  const summary = lifecycleSummary(stages);

  return (
    <section aria-labelledby="lifecycle-title" className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 id="lifecycle-title" className="text-[14px] font-semibold">Shipment lifecycle</h2>
        <p className={cn('text-[12.5px]', blocked ? 'text-urgent' : done === 4 ? 'text-done' : 'text-muted-foreground')}>{summary}</p>
      </div>
      <ol className="grid gap-5 sm:grid-cols-4 sm:gap-3">
        {stages.map((node, i) => {
          const next = stages[i + 1];
          // The line to the next stage is coloured once this one is done.
          const line = node.state === 'done' && next ? (next.state === 'pending' || next.state === 'stopped' ? 'bg-[linear-gradient(90deg,hsl(var(--done-fill)),hsl(var(--border)))] max-sm:bg-[linear-gradient(180deg,hsl(var(--done-fill)),hsl(var(--border)))]' : FILL.done) : 'bg-border';
          return (
            <li key={node.stage} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
              {next && (
                <span
                  aria-hidden
                  className={cn('absolute rounded-full max-sm:bottom-[-20px] max-sm:left-[17px] max-sm:top-10 max-sm:w-0.5 sm:left-[calc(50%+24px)] sm:right-[calc(-50%+12px)] sm:top-[17px] sm:h-0.5', line)}
                />
              )}
              <StageDot node={node} />
              <div className="min-w-0 sm:mt-2.5">
                <p className="text-[13px] font-semibold">{node.title}</p>
                <ExpandableDetail text={node.detail} className={cn('text-[12.5px] font-medium leading-snug', DETAIL_TEXT[toneOf(node)])} />
                {node.age && <p className="mt-0.5 text-[11.5px] tabular-nums text-muted-foreground">{node.age}</p>}
                {node.cta && (
                  <Button asChild size="sm" variant={node.cta.variant === 'outline' ? 'outline' : 'default'} className="mt-2 h-7 gap-1 px-2.5 text-[12px]">
                    <Link to={node.cta.to}>
                      {node.cta.label}
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
