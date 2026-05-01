/**
 * Dashboard — The Shipment Pipeline (v4: bold).
 *
 * 4-column lifecycle view with rich color-per-stage identity, ambient
 * aurora background, animated count-up hero, glowing severity rails,
 * spring-eased tile cascades, and triple-ring "fresh" pulses.
 *
 * Each stage carries its own gradient identity (a journey from cool →
 * warm → formal → success):
 *   ISF Filed         → blue   (cool, beginning)
 *   Manifest Verified → amber  (warm, action)
 *   Entry Filed       → violet (formal, serious)
 *   Cleared           → emerald (success, complete)
 *
 * Color lives in structure (column rails, stage chips, count gradients,
 * hover glows), never in tile bodies — keeps the dashboard rich without
 * becoming noisy. All motion respects `prefers-reduced-motion`.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFilings } from '@/hooks/useFilings';
import { useAbiDocumentsList } from '@/hooks/useAbiDocument';
import { useManifestQueries } from '@/hooks/useManifestQuery';
import { Filing } from '@/types/shipment';
import { useCurrentUser } from '@/hooks/useAuth';
import { CelebrationModal } from '@/components/CelebrationModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Search, FileCheck, ChevronRight, Activity, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── helpers ─────────────────────────────────────────────────────────

function relativeTime(ts: string | null | undefined) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60)  return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m`;
  const hr  = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7)   return `${day}d`;
  if (day < 30)  return `${Math.floor(day / 7)}w`;
  return `${Math.floor(day / 30)}mo`;
}

function isFresh(ts: string | null | undefined) {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < 30 * 60 * 1000;
}

function useGreeting() {
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
}

/** Smooth count-up. Cubic ease-out. Honors reduced motion. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ─── domain types ────────────────────────────────────────────────────

type Stage = 'isf' | 'manifest' | 'entry' | 'cleared';
type Severity = 'critical' | 'warn' | 'success' | 'neutral';

interface AbiLite {
  id: string;
  filingId: string | null;
  mbolNumber: string | null;
  entryNumber: string | null;
  status: string;
  iorName: string | null;
  updatedAt: string;
  createdAt: string;
  lastError: string | null;
}

interface ShipmentTile {
  id: string;
  ref: string;
  subRef?: string | null;
  stage: Stage;
  severity: Severity;
  statusLabel: string;
  ageRef: string;
  to: string;
}

// ─── stage / severity computation ────────────────────────────────────

function buildShipments(args: {
  filings: Filing[];
  abiDocs: AbiLite[];
}): ShipmentTile[] {
  const tiles: ShipmentTile[] = [];

  const abiByFilingId = new Map<string, AbiLite>();
  for (const d of args.abiDocs) {
    if (!d.filingId) continue;
    const existing = abiByFilingId.get(d.filingId);
    if (!existing || new Date(d.updatedAt) > new Date(existing.updatedAt)) {
      abiByFilingId.set(d.filingId, d);
    }
  }

  for (const f of args.filings) {
    if (f.status === 'cancelled') continue;
    const abi = abiByFilingId.get(f.id) ?? null;
    const ref = f.houseBol || f.masterBol || f.id.slice(0, 8);
    const importerName = f.importerName || 'No importer set';

    let stage: Stage;
    let severity: Severity = 'neutral';
    let statusLabel: string;
    let ageRef: string;
    let to: string;

    if (abi?.status === 'ACCEPTED') {
      stage = 'cleared'; severity = 'success'; statusLabel = 'Cleared by CBP';
      ageRef = abi.updatedAt; to = `/abi-documents/${abi.id}`;
    } else if (abi) {
      stage = 'entry';
      severity = abi.status === 'REJECTED' ? 'critical' : abi.status === 'DRAFT' ? 'warn' : 'neutral';
      statusLabel = abi.status === 'DRAFT' ? 'Entry · Draft'
                  : abi.status === 'SENDING' ? 'Entry · Transmitting'
                  : abi.status === 'SENT' ? 'Entry · Awaiting CBP'
                  : abi.status === 'REJECTED' ? 'Entry · Rejected'
                  : `Entry · ${abi.status}`;
      ageRef = abi.updatedAt; to = `/abi-documents/${abi.id}`;
    } else if (f.status === 'accepted') {
      stage = 'manifest'; severity = 'warn'; statusLabel = 'Ready to file Entry';
      ageRef = f.updatedAt; to = `/abi-documents/new?fromShipment=${f.id}`;
    } else {
      stage = 'isf';
      severity = f.status === 'rejected' ? 'critical' : f.status === 'draft' ? 'warn' : 'neutral';
      statusLabel = f.status === 'draft' ? 'ISF · Draft'
                  : f.status === 'rejected' ? 'ISF · Rejected'
                  : f.status === 'submitted' || f.status === 'pending_cbp' ? 'ISF · At CBP'
                  : f.status === 'on_hold' ? 'ISF · On hold'
                  : `ISF · ${f.status}`;
      ageRef = f.updatedAt;
      to = f.status === 'draft' ? `/shipments/${f.id}/edit` : `/shipments/${f.id}`;
    }

    tiles.push({ id: `f-${f.id}`, ref, subRef: importerName, stage, severity, statusLabel, ageRef, to });
  }

  for (const d of args.abiDocs) {
    if (d.filingId) continue;
    if (d.status === 'CANCELLED') continue;
    const ref = d.entryNumber || d.mbolNumber || d.id.slice(0, 8);
    let stage: Stage;
    let severity: Severity = 'neutral';
    let statusLabel: string;
    if (d.status === 'ACCEPTED') {
      stage = 'cleared'; severity = 'success'; statusLabel = 'Cleared by CBP';
    } else {
      stage = 'entry';
      severity = d.status === 'REJECTED' ? 'critical' : d.status === 'DRAFT' ? 'warn' : 'neutral';
      statusLabel = d.status === 'DRAFT' ? 'Entry · Draft'
                  : d.status === 'SENDING' ? 'Entry · Transmitting'
                  : d.status === 'SENT' ? 'Entry · Awaiting CBP'
                  : d.status === 'REJECTED' ? 'Entry · Rejected'
                  : `Entry · ${d.status}`;
    }
    tiles.push({
      id: `a-${d.id}`, ref,
      subRef: d.iorName || (d.mbolNumber ? `MBOL ${d.mbolNumber}` : 'Standalone entry'),
      stage, severity, statusLabel,
      ageRef: d.updatedAt, to: `/abi-documents/${d.id}`,
    });
  }

  const sevOrder: Record<Severity, number> = { critical: 0, warn: 1, neutral: 2, success: 3 };
  tiles.sort((a, b) => {
    if (a.severity !== b.severity) return sevOrder[a.severity] - sevOrder[b.severity];
    return new Date(b.ageRef).getTime() - new Date(a.ageRef).getTime();
  });
  return tiles;
}

// ─── stage style maps ────────────────────────────────────────────────

const STAGE_RAIL_CLASS: Record<Stage, string> = {
  isf:      'stage-rail-isf',
  manifest: 'stage-rail-manifest',
  entry:    'stage-rail-entry',
  cleared:  'stage-rail-cleared',
};
const STAGE_TEXT_GRADIENT: Record<Stage, string> = {
  isf:      'text-gradient-stage-isf',
  manifest: 'text-gradient-stage-manifest',
  entry:    'text-gradient-stage-entry',
  cleared:  'text-gradient-stage-cleared',
};
const STAGE_GLOW_HOVER: Record<Stage, string> = {
  isf:      'glow-hover-isf',
  manifest: 'glow-hover-manifest',
  entry:    'glow-hover-entry',
  cleared:  'glow-hover-cleared',
};
const STAGE_CHIP_TINT: Record<Stage, string> = {
  isf:      'bg-blue-500/10    text-blue-600    dark:text-blue-300    ring-blue-500/20',
  manifest: 'bg-amber-500/10   text-amber-700   dark:text-amber-300   ring-amber-500/20',
  entry:    'bg-violet-500/10  text-violet-700  dark:text-violet-300  ring-violet-500/20',
  cleared:  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
};

const SEVERITY_RAIL_CLASS: Record<Severity, string> = {
  critical: 'rail-critical',
  warn:     'rail-warn',
  success:  'rail-success',
  neutral:  '',
};
const SEVERITY_LABEL_TINT: Record<Severity, string> = {
  critical: 'text-red-600 dark:text-red-400',
  warn:     'text-amber-700 dark:text-amber-400',
  success:  'text-emerald-700 dark:text-emerald-400',
  neutral:  'text-muted-foreground',
};

// ─── tile component ──────────────────────────────────────────────────

function ShipmentCard({ tile, delay }: { tile: ShipmentTile; delay: number }) {
  const fresh = isFresh(tile.ageRef);
  return (
    <Link
      to={tile.to}
      className={cn(
        'group relative block rounded-xl bg-card pl-4 pr-3.5 py-3.5 border border-border/60 overflow-hidden',
        'transition-[transform,box-shadow,border-color] duration-300 ease-out',
        'hover:-translate-y-1 hover:border-foreground/20',
        STAGE_GLOW_HOVER[tile.stage],
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'animate-tile-in',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:animate-none',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Severity rail — glowing gradient bar on the left edge */}
      {tile.severity !== 'neutral' && (
        <span
          className={cn(
            'absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full',
            SEVERITY_RAIL_CLASS[tile.severity],
          )}
          aria-hidden
        />
      )}

      {/* Subtle hover wash — column-tinted gradient that fades in */}
      <span
        className={cn(
          'absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 pointer-events-none',
          'group-hover:opacity-100',
          tile.stage === 'isf' && 'bg-gradient-to-br from-blue-500/[0.04] to-transparent',
          tile.stage === 'manifest' && 'bg-gradient-to-br from-amber-500/[0.05] to-transparent',
          tile.stage === 'entry' && 'bg-gradient-to-br from-violet-500/[0.04] to-transparent',
          tile.stage === 'cleared' && 'bg-gradient-to-br from-emerald-500/[0.04] to-transparent',
        )}
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-[13px] font-semibold tracking-tight truncate transition-colors duration-150 group-hover:text-foreground">
            {tile.ref}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {fresh && (
              <span className="relative flex h-2 w-2" aria-label="Updated recently">
                <span className="absolute inset-0 rounded-full bg-emerald-400/70 animate-ping motion-reduce:animate-none" />
                <span
                  className="absolute inset-0 rounded-full bg-emerald-400/50 animate-ping motion-reduce:animate-none"
                  style={{ animationDelay: '600ms' }}
                />
                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
            {tile.severity === 'critical' && !fresh && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
            )}
          </div>
        </div>
        <p className="text-[11.5px] text-muted-foreground truncate leading-snug">
          {tile.subRef}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
          <span className={cn('font-medium truncate', SEVERITY_LABEL_TINT[tile.severity])}>
            {tile.statusLabel}
          </span>
          <span className="text-muted-foreground/70 tabular-nums shrink-0">
            {relativeTime(tile.ageRef)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── pipeline column ─────────────────────────────────────────────────

interface ColumnDef {
  stage: Stage;
  index: string;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyHint: string;
}

const COLUMNS: ColumnDef[] = [
  { stage: 'isf',      index: '01', title: 'ISF Filed',         subtitle: 'Drafting or with CBP',          emptyTitle: 'No ISF filings in flight',  emptyHint: 'New ISF filings will appear here.' },
  { stage: 'manifest', index: '02', title: 'Manifest Verified', subtitle: 'ISF accepted — file the Entry', emptyTitle: 'Nothing waiting on entry',  emptyHint: 'Once an ISF clears, it lands here.' },
  { stage: 'entry',    index: '03', title: 'Entry Filed',       subtitle: '7501 + 3461 with CBP',          emptyTitle: 'No entries in flight',      emptyHint: 'Transmitted entries appear here.' },
  { stage: 'cleared',  index: '04', title: 'Cleared',           subtitle: 'Accepted by CBP',               emptyTitle: 'No cleared shipments yet',  emptyHint: 'Once CBP accepts an entry, it lands here.' },
];

function PipelineColumn({
  def, tiles, indexOffset,
}: {
  def: ColumnDef;
  tiles: ShipmentTile[];
  indexOffset: number;
}) {
  const animatedCount = useCountUp(tiles.length, 700);
  return (
    <div className="space-y-3 min-w-0">
      {/* Header */}
      <div className="px-1">
        {/* Stage chip + title */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              'inline-flex items-center justify-center text-[9.5px] font-mono font-semibold tabular-nums',
              'h-4 px-1.5 rounded-md ring-1 ring-inset',
              STAGE_CHIP_TINT[def.stage],
            )}
          >
            {def.index}
          </span>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-foreground/85">
            {def.title}
          </p>
        </div>
        {/* Subtitle + count */}
        <div className="flex items-end justify-between gap-3">
          <p className="text-[11.5px] text-muted-foreground/70 leading-snug max-w-[220px]">
            {def.subtitle}
          </p>
          <span
            className={cn(
              'text-[36px] leading-[0.85] font-semibold tabular-nums tracking-[-0.025em]',
              tiles.length > 0 ? STAGE_TEXT_GRADIENT[def.stage] : 'text-muted-foreground/30',
            )}
          >
            {animatedCount}
          </span>
        </div>
        {/* Colored gradient rail under the header */}
        <div className="mt-3 relative h-px overflow-visible">
          <div className={cn(
            'absolute inset-x-0 h-[2px] -top-px rounded-full',
            tiles.length > 0 ? STAGE_RAIL_CLASS[def.stage] : 'bg-border/60',
            tiles.length > 0 && 'opacity-60',
          )} />
        </div>
      </div>

      {/* Tiles */}
      <div className="space-y-2">
        {tiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center">
            <p className="text-[12px] font-medium text-foreground/70">{def.emptyTitle}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{def.emptyHint}</p>
          </div>
        ) : (
          tiles.map((t, i) => (
            <ShipmentCard
              key={t.id}
              tile={t}
              delay={140 + (indexOffset + i) * 36}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── activity strip ──────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  ts: string;
  kind: 'isf' | 'mq' | 'abi';
  text: string;
  to: string;
}

function buildActivity(args: {
  filings: Filing[];
  abiDocs: AbiLite[];
  mqs: Array<{ id: string; status: string; bolNumber: string; createdAt: string; completedAt: string | null }>;
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const f of args.filings.slice(0, 50)) {
    const ref = f.houseBol || f.masterBol || f.id.slice(0, 8);
    events.push({ id: `isf-${f.id}`, ts: f.updatedAt, kind: 'isf', text: `ISF ${f.status}: ${ref}`, to: `/shipments/${f.id}` });
  }
  for (const d of args.abiDocs) {
    const ref = d.entryNumber || d.mbolNumber || d.id.slice(0, 8);
    events.push({ id: `abi-${d.id}`, ts: d.updatedAt, kind: 'abi', text: `Entry ${d.status.toLowerCase()}: ${ref}`, to: `/abi-documents/${d.id}` });
  }
  for (const q of args.mqs) {
    events.push({ id: `mq-${q.id}`, ts: q.completedAt || q.createdAt, kind: 'mq', text: `Manifest ${q.status}: ${q.bolNumber}`, to: '/manifest-query' });
  }
  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return events.slice(0, 12);
}

function ActivityStrip({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-[11.5px] text-muted-foreground/70 leading-relaxed">
        Activity will appear here as you file ISFs, run manifest queries, and transmit entries.
      </p>
    );
  }
  return (
    <div className="relative -mx-1">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent z-10" />

      <ol className="flex items-stretch gap-2 overflow-x-auto pb-2 px-1 [scrollbar-width:thin] [scroll-behavior:smooth]">
        {events.map((ev, i) => {
          const tint =
            ev.kind === 'isf' ? 'bg-blue-500/[0.07]    text-blue-700    dark:text-blue-300    ring-blue-500/20    hover:shadow-[0_4px_16px_-6px_hsl(217_91%_60%/0.35)]'
          : ev.kind === 'mq'  ? 'bg-amber-500/[0.07]   text-amber-700   dark:text-amber-300   ring-amber-500/20   hover:shadow-[0_4px_16px_-6px_hsl(38_92%_55%/0.35)]'
          :                     'bg-violet-500/[0.07]  text-violet-700  dark:text-violet-300  ring-violet-500/20  hover:shadow-[0_4px_16px_-6px_hsl(262_83%_58%/0.35)]';
          return (
            <li key={ev.id} className="shrink-0 opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none" style={{ animationDelay: `${380 + i * 40}ms`, animationFillMode: 'forwards' }}>
              <Link
                to={ev.to}
                className={cn(
                  'group flex items-center gap-2.5 rounded-lg ring-1 ring-inset px-3 py-2 text-[11.5px] font-medium',
                  'transition-[transform,box-shadow] duration-200 ease-out',
                  'hover:scale-[1.03]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'motion-reduce:transition-none motion-reduce:hover:scale-100',
                  tint,
                )}
              >
                <span className="text-[10px] tabular-nums opacity-70 shrink-0 font-mono">{relativeTime(ev.ts)}</span>
                <span className="opacity-40">·</span>
                <span className="truncate max-w-[28ch]">{ev.text}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── empty hero (zero shipments) ─────────────────────────────────────

function EmptyHero({ greeting, firstName }: { greeting: string; firstName: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 px-8 py-16 text-center">
      <div className="absolute inset-0 aurora-bg opacity-50 pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/15 flex items-center justify-center mb-5">
          <Sparkles className="h-5 w-5 text-primary" strokeWidth={2} />
        </div>
        <h2 className="text-[28px] leading-tight font-semibold tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="text-[15px] text-muted-foreground mt-2.5 max-w-md mx-auto leading-relaxed">
          Your shipments will flow through here, stage by stage. Start with an ISF filing — once it's accepted by CBP, the next stages unlock automatically.
        </p>
        <div className="flex items-center justify-center gap-2 mt-7">
          <Link to="/shipments/new">
            <Button size="default" className="gap-1.5 h-10 px-5 rounded-xl font-semibold">
              <Plus className="h-4 w-4" /> New ISF Filing
            </Button>
          </Link>
          <Link to="/manifest-query">
            <Button variant="outline" size="default" className="gap-1.5 h-10 rounded-xl">
              <Search className="h-3.5 w-3.5" /> Run Manifest Query
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── flow indicator ──────────────────────────────────────────────────

function FlowIndicator() {
  return (
    <div className="hidden lg:flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] select-none">
      <span className="text-foreground/60">Flow</span>
      <span className="h-px w-4 bg-border/60" />
      {COLUMNS.map((c, i) => (
        <span key={c.stage} className="flex items-center gap-2">
          <span className={cn('px-2 h-5 inline-flex items-center rounded-md ring-1 ring-inset', STAGE_CHIP_TINT[c.stage])}>
            {c.title}
          </span>
          {i < COLUMNS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" strokeWidth={2.5} />}
        </span>
      ))}
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: filingsData, isLoading: filingsLoading } = useFilings({
    sortBy: 'updatedAt', sortOrder: 'desc', limit: 200,
  });
  const { data: abiData, isLoading: abiLoading } = useAbiDocumentsList({ take: 100 });
  const { data: mqData, isLoading: mqLoading } = useManifestQueries({ limit: 30 });
  const { data: profile } = useCurrentUser();

  const [searchParams, setSearchParams] = useSearchParams();
  const welcomePlanId = searchParams.get('welcome');
  function handleModalClose() {
    setSearchParams(p => { p.delete('welcome'); return p; });
  }

  const greeting = useGreeting();

  const filings = (filingsData?.data ?? []) as Filing[];
  const abiDocs = ((abiData?.data ?? []) as any[]) as AbiLite[];
  const mqs = (((mqData as any)?.data ?? []) as any[]) as Array<{
    id: string; status: string; bolNumber: string; createdAt: string; completedAt: string | null;
  }>;

  const tiles = useMemo(() => buildShipments({ filings, abiDocs }), [filings, abiDocs]);

  const byStage = useMemo(() => {
    const map: Record<Stage, ShipmentTile[]> = { isf: [], manifest: [], entry: [], cleared: [] };
    for (const t of tiles) map[t.stage].push(t);
    map.cleared = map.cleared.slice(0, 8);
    return map;
  }, [tiles]);

  const inFlightCount = byStage.isf.length + byStage.manifest.length + byStage.entry.length;
  const attentionCount = tiles.filter(t => t.severity === 'critical' || t.severity === 'warn').length;
  const clearedCount = byStage.cleared.length;

  const animatedInFlight = useCountUp(inFlightCount, 1100);

  const activity = useMemo(() => buildActivity({ filings, abiDocs, mqs }), [filings, abiDocs, mqs]);

  const isLoading = filingsLoading || abiLoading || mqLoading;
  const firstName = profile?.firstName?.trim() || null;

  // ── loading ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-12 max-w-[1500px] mx-auto pb-16">
        <div className="space-y-4">
          <Skeleton className="h-3 w-48" />
          <div className="space-y-2.5 max-w-2xl">
            <Skeleton className="h-16 w-[80%]" />
            <Skeleton className="h-16 w-[60%]" />
          </div>
          <Skeleton className="h-4 w-[45%] max-w-[420px]" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="space-y-1.5 px-1">
                <Skeleton className="h-3 w-1/2" />
                <div className="flex justify-between items-end">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-9 w-12" />
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <Skeleton className="h-[78px] rounded-xl" />
                <Skeleton className="h-[78px] rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── brand-new account ─────────────────────────────────────────────────
  if (filings.length === 0 && abiDocs.length === 0) {
    return (
      <div className="space-y-10 max-w-[1500px] mx-auto pb-16">
        <CelebrationModal planId={welcomePlanId} onClose={handleModalClose} />
        <EmptyHero greeting={greeting} firstName={firstName} />
      </div>
    );
  }

  return (
    <div className="relative max-w-[1500px] mx-auto pb-16">
      {/* Aurora ambient gradient — sits behind the hero, fades down */}
      <div className="absolute inset-x-0 top-0 h-[420px] aurora-bg pointer-events-none -z-10" aria-hidden />

      <CelebrationModal planId={welcomePlanId} onClose={handleModalClose} />

      <div className="space-y-12 relative">
        {/* ─── Hero ─────────────────────────────────────────────────────── */}
        <header
          className="space-y-5 pt-2 opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none"
          style={{ animationFillMode: 'forwards' }}
        >
          {/* Date / greeting strip */}
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70 shrink-0">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <span className="mx-2 text-muted-foreground/30">·</span>
              {greeting}{firstName ? `, ${firstName}` : ''}
            </p>
            <span className="h-px flex-1 bg-gradient-to-r from-border/60 via-border/30 to-transparent" />
          </div>

          {/* Big headline */}
          {inFlightCount === 0 ? (
            <h1 className="text-[64px] leading-[0.95] font-semibold tracking-[-0.035em] max-w-3xl">
              <span className="text-gradient-hero">No shipments in flight.</span>
              <br />
              <span className="text-muted-foreground/60">Time to file.</span>
            </h1>
          ) : (
            <h1 className="text-[64px] leading-[0.95] font-semibold tracking-[-0.035em] max-w-3xl">
              <span className="text-muted-foreground/60">You have</span>{' '}
              <span className="text-gradient-accent tabular-nums inline-block min-w-[1ch]">
                {animatedInFlight}
              </span>{' '}
              <span className="text-gradient-hero">{inFlightCount === 1 ? 'shipment' : 'shipments'} in flight.</span>
            </h1>
          )}

          {/* Sub-line */}
          <p className="text-[15px] leading-relaxed text-muted-foreground max-w-2xl">
            {attentionCount > 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-medium">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-amber-500/70 animate-ping motion-reduce:animate-none" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-amber-500" />
                  </span>
                  {attentionCount} {attentionCount === 1 ? 'item needs' : 'items need'} your attention
                </span>
                {clearedCount > 0 && <> · <span className="tabular-nums">{clearedCount}</span> recently cleared</>}
              </>
            ) : inFlightCount > 0 ? (
              <>Everything is on track.{clearedCount > 0 && <> <span className="tabular-nums">{clearedCount}</span> {clearedCount === 1 ? 'shipment' : 'shipments'} recently cleared.</>}</>
            ) : (
              <>Run a manifest query to look up CBP data, or start a new ISF filing.</>
            )}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link to="/shipments/new">
              <Button
                size="default"
                className={cn(
                  'gap-1.5 h-10 px-4 rounded-xl font-semibold transition-shadow duration-200',
                  'shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.30),0_0_0_1px_hsl(var(--primary)/0.20)]',
                  'hover:shadow-[0_8px_20px_-4px_hsl(var(--primary)/0.45),0_0_0_1px_hsl(var(--primary)/0.30)]',
                )}
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} /> New Shipment
              </Button>
            </Link>
            <Link to="/abi-documents/new">
              <Button variant="outline" size="default" className="gap-1.5 h-10 rounded-xl transition-colors duration-150">
                <FileCheck className="h-3.5 w-3.5" /> New Entry
              </Button>
            </Link>
            <Link to="/manifest-query">
              <Button variant="outline" size="default" className="gap-1.5 h-10 rounded-xl transition-colors duration-150">
                <Search className="h-3.5 w-3.5" /> Manifest Query
              </Button>
            </Link>
          </div>
        </header>

        {/* ─── Pipeline ─────────────────────────────────────────────────── */}
        <section
          className="space-y-5 opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none"
          style={{ animationDelay: '60ms', animationFillMode: 'forwards' }}
        >
          <FlowIndicator />

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((def, colIdx) => {
              const colTiles = byStage[def.stage];
              const indexOffset = COLUMNS.slice(0, colIdx).reduce((s, c) => s + byStage[c.stage].length, 0);
              return (
                <PipelineColumn
                  key={def.stage}
                  def={def}
                  tiles={colTiles}
                  indexOffset={indexOffset}
                />
              );
            })}
          </div>
        </section>

        {/* ─── Activity strip ───────────────────────────────────────────── */}
        <section className="space-y-3">
          <div
            className="flex items-center gap-2.5 opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none"
            style={{ animationDelay: '320ms', animationFillMode: 'forwards' }}
          >
            <div className="h-6 w-6 rounded-md bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Activity className="h-3 w-3" strokeWidth={2.5} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Recent activity
            </p>
            <span className="h-px flex-1 bg-gradient-to-r from-border/60 via-border/30 to-transparent" />
          </div>
          <ActivityStrip events={activity} />
        </section>
      </div>
    </div>
  );
}
