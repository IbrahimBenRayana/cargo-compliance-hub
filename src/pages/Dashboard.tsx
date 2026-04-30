/**
 * Dashboard — The Shipment Pipeline.
 *
 * A 4-column Kanban-style lifecycle view of every active shipment in the
 * org, flowing left-to-right through:
 *
 *   [ISF Filed]  →  [Manifest Verified]  →  [Entry Filed]  →  [Cleared]
 *
 * Each shipment is one tile. Tiles surface ID, importer, status, age,
 * and a severity strip on the left edge (red = rejected, amber =
 * draft / awaiting action, green = cleared). The visual structure IS
 * the lifecycle teaching — new users see the four-stage pipeline the
 * moment they log in; power users see at a glance what's stuck where.
 *
 * Data joins are computed client-side from existing list endpoints —
 * no new server work needed.
 */
import { useMemo } from 'react';
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
  Plus, ArrowRight, Search, FileCheck, ChevronRight, Activity,
  Clock,
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

function useGreeting() {
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
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
  ref: string;          // BOL number or entry number — primary visual identifier
  subRef?: string | null; // small line below — importer or extra context
  stage: Stage;
  severity: Severity;
  statusLabel: string;
  ageRef: string;       // ISO date used to render relative age
  to: string;           // navigation target on click
}

// ─── stage / severity computation ────────────────────────────────────

function buildShipments(args: {
  filings: Filing[];
  abiDocs: AbiLite[];
}): ShipmentTile[] {
  const tiles: ShipmentTile[] = [];

  // Group ABI docs by filingId for fast lookup. Each filing gets at most
  // one "linked" ABI doc — if there are multiple, prefer the most-recent.
  const abiByFilingId = new Map<string, AbiLite>();
  for (const d of args.abiDocs) {
    if (!d.filingId) continue;
    const existing = abiByFilingId.get(d.filingId);
    if (!existing || new Date(d.updatedAt) > new Date(existing.updatedAt)) {
      abiByFilingId.set(d.filingId, d);
    }
  }

  // Walk filings: each one is a shipment, the linked ABI determines the
  // furthest stage it has reached.
  for (const f of args.filings) {
    if (f.status === 'cancelled') continue; // not "in flight" — hidden
    const abi = abiByFilingId.get(f.id) ?? null;
    const ref = f.houseBol || f.masterBol || f.id.slice(0, 8);
    const importerName = f.importerName || 'No importer set';

    // Stage assignment, walked back from most-advanced state
    let stage: Stage;
    let severity: Severity = 'neutral';
    let statusLabel: string;
    let ageRef: string;
    let to: string;

    if (abi?.status === 'ACCEPTED') {
      stage = 'cleared';
      severity = 'success';
      statusLabel = 'Cleared by CBP';
      ageRef = abi.updatedAt;
      to = `/abi-documents/${abi.id}`;
    } else if (abi) {
      stage = 'entry';
      severity = abi.status === 'REJECTED' ? 'critical' : abi.status === 'DRAFT' ? 'warn' : 'neutral';
      statusLabel = abi.status === 'DRAFT' ? 'Entry · Draft'
                  : abi.status === 'SENDING' ? 'Entry · Transmitting'
                  : abi.status === 'SENT' ? 'Entry · Awaiting CBP'
                  : abi.status === 'REJECTED' ? 'Entry · Rejected'
                  : `Entry · ${abi.status}`;
      ageRef = abi.updatedAt;
      to = `/abi-documents/${abi.id}`;
    } else if (f.status === 'accepted') {
      stage = 'manifest';
      severity = 'warn'; // user has an action to take — file the entry
      statusLabel = 'Ready to file Entry';
      ageRef = f.updatedAt;
      to = `/abi-documents/new?fromShipment=${f.id}`;
    } else {
      stage = 'isf';
      severity = f.status === 'rejected' ? 'critical'
               : f.status === 'draft' ? 'warn'
               : 'neutral';
      statusLabel = f.status === 'draft' ? 'ISF · Draft'
                  : f.status === 'rejected' ? 'ISF · Rejected'
                  : f.status === 'submitted' || f.status === 'pending_cbp' ? 'ISF · At CBP'
                  : f.status === 'on_hold' ? 'ISF · On hold'
                  : `ISF · ${f.status}`;
      ageRef = f.updatedAt;
      to = f.status === 'draft' ? `/shipments/${f.id}/edit` : `/shipments/${f.id}`;
    }

    tiles.push({
      id: `f-${f.id}`,
      ref,
      subRef: importerName,
      stage,
      severity,
      statusLabel,
      ageRef,
      to,
    });
  }

  // Standalone ABI docs (no parent ISF). Add as their own tiles.
  for (const d of args.abiDocs) {
    if (d.filingId) continue; // already covered above
    if (d.status === 'CANCELLED') continue;
    const ref = d.entryNumber || d.mbolNumber || d.id.slice(0, 8);
    let stage: Stage;
    let severity: Severity = 'neutral';
    let statusLabel: string;

    if (d.status === 'ACCEPTED') {
      stage = 'cleared';
      severity = 'success';
      statusLabel = 'Cleared by CBP';
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
      id: `a-${d.id}`,
      ref,
      subRef: d.iorName || (d.mbolNumber ? `MBOL ${d.mbolNumber}` : 'Standalone entry'),
      stage,
      severity,
      statusLabel,
      ageRef: d.updatedAt,
      to: `/abi-documents/${d.id}`,
    });
  }

  // Sort within each stage: critical first, then warn, then by recency
  const sevOrder: Record<Severity, number> = { critical: 0, warn: 1, neutral: 2, success: 3 };
  tiles.sort((a, b) => {
    if (a.severity !== b.severity) return sevOrder[a.severity] - sevOrder[b.severity];
    return new Date(b.ageRef).getTime() - new Date(a.ageRef).getTime();
  });
  return tiles;
}

// ─── tile component ──────────────────────────────────────────────────

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: 'border-l-[3px] border-l-red-500',
  warn:     'border-l-[3px] border-l-amber-500',
  success:  'border-l-[3px] border-l-emerald-500',
  neutral:  'border-l-[3px] border-l-transparent',
};

const SEVERITY_LABEL_TINT: Record<Severity, string> = {
  critical: 'text-red-600 dark:text-red-400',
  warn:     'text-amber-700 dark:text-amber-400',
  success:  'text-emerald-700 dark:text-emerald-400',
  neutral:  'text-muted-foreground',
};

function ShipmentCard({ tile, delay }: { tile: ShipmentTile; delay: number }) {
  return (
    <Link
      to={tile.to}
      className={cn(
        'group block rounded-xl border border-border/60 bg-card pl-3.5 pr-3 py-3',
        'transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_8px_24px_-12px_hsl(var(--foreground)/0.15)]',
        'opacity-0 animate-fade-in-up',
        SEVERITY_BORDER[tile.severity],
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[13px] font-semibold tracking-tight truncate group-hover:text-primary transition-colors">
          {tile.ref}
        </p>
        {tile.severity === 'critical' && (
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" aria-hidden />
        )}
      </div>
      <p className="text-[11.5px] text-muted-foreground truncate">
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
    </Link>
  );
}

// ─── pipeline column component ───────────────────────────────────────

interface ColumnDef {
  stage: Stage;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyHint: string;
}

const COLUMNS: ColumnDef[] = [
  {
    stage: 'isf',
    title: 'ISF Filed',
    subtitle: 'Drafting or with CBP',
    emptyTitle: 'No ISF filings in flight',
    emptyHint: 'New ISF filings will appear here.',
  },
  {
    stage: 'manifest',
    title: 'Manifest Verified',
    subtitle: 'ISF accepted — file the Entry',
    emptyTitle: 'Nothing waiting on entry',
    emptyHint: 'Once an ISF clears, it lands here.',
  },
  {
    stage: 'entry',
    title: 'Entry Filed',
    subtitle: '7501 + 3461 with CBP',
    emptyTitle: 'No entries in flight',
    emptyHint: 'Transmitted entries appear here.',
  },
  {
    stage: 'cleared',
    title: 'Cleared',
    subtitle: 'Accepted by CBP',
    emptyTitle: 'No cleared shipments yet',
    emptyHint: 'Once CBP accepts an entry, it lands here.',
  },
];

function PipelineColumn({
  def, tiles, indexOffset,
}: {
  def: ColumnDef;
  tiles: ShipmentTile[];
  indexOffset: number;
}) {
  return (
    <div className="space-y-3 min-w-0">
      {/* header */}
      <div className="flex items-baseline justify-between px-1 mb-1">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {def.title}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
            {def.subtitle}
          </p>
        </div>
        <span className="text-[26px] leading-none font-semibold tabular-nums tracking-tight text-foreground/90 shrink-0">
          {tiles.length}
        </span>
      </div>

      {/* connector line — visual through-line connecting columns */}
      <div className="relative">
        <div
          className={cn(
            'absolute -top-2 left-0 right-0 h-px bg-gradient-to-r',
            def.stage === 'isf' ? 'from-transparent via-border/60 to-border/60' :
            def.stage === 'cleared' ? 'from-border/60 via-border/60 to-transparent' :
            'from-border/60 via-border/60 to-border/60',
          )}
        />
      </div>

      {/* tiles */}
      <div className="space-y-2">
        {tiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-center">
            <p className="text-xs font-medium text-muted-foreground">{def.emptyTitle}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">{def.emptyHint}</p>
          </div>
        ) : (
          tiles.map((t, i) => (
            <ShipmentCard
              key={t.id}
              tile={t}
              delay={120 + (indexOffset + i) * 35}
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
  emoji: string;
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
    events.push({
      id: `isf-${f.id}`,
      ts: f.updatedAt,
      kind: 'isf',
      emoji: f.status === 'accepted' ? '✓' : f.status === 'rejected' ? '✗' : '•',
      text: `ISF ${f.status}: ${ref}`,
      to: `/shipments/${f.id}`,
    });
  }
  for (const d of args.abiDocs) {
    const ref = d.entryNumber || d.mbolNumber || d.id.slice(0, 8);
    events.push({
      id: `abi-${d.id}`,
      ts: d.updatedAt,
      kind: 'abi',
      emoji: d.status === 'ACCEPTED' ? '✓' : d.status === 'REJECTED' ? '✗' : '•',
      text: `Entry ${d.status.toLowerCase()}: ${ref}`,
      to: `/abi-documents/${d.id}`,
    });
  }
  for (const q of args.mqs) {
    events.push({
      id: `mq-${q.id}`,
      ts: q.completedAt || q.createdAt,
      kind: 'mq',
      emoji: q.status === 'completed' ? '✓' : '•',
      text: `Manifest ${q.status}: ${q.bolNumber}`,
      to: `/manifest-query`,
    });
  }
  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return events.slice(0, 10);
}

function ActivityStrip({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground/70">
        Activity will appear here as you file ISFs, run manifest queries, and transmit entries.
      </p>
    );
  }
  return (
    <ol className="flex items-stretch gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
      {events.map(ev => {
        const tint =
          ev.kind === 'isf' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20' :
          ev.kind === 'mq'  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20' :
          'bg-primary/10 text-primary ring-primary/20';
        return (
          <li key={ev.id} className="shrink-0">
            <Link
              to={ev.to}
              className={cn(
                'group flex items-center gap-2 rounded-lg ring-1 ring-inset px-3 py-1.5 text-[11.5px] font-medium transition-all hover:scale-[1.015]',
                tint,
              )}
            >
              <span className="text-[10px] tabular-nums opacity-70 shrink-0">{relativeTime(ev.ts)}</span>
              <span className="opacity-50">·</span>
              <span className="truncate max-w-[28ch]">{ev.text}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

// ─── empty-state hero (zero shipments) ───────────────────────────────

function EmptyHero({ greeting, firstName }: { greeting: string; firstName: string | null }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-8 py-14 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Plus className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-[24px] leading-tight font-semibold tracking-tight">
        {greeting}{firstName ? `, ${firstName}` : ''}
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Your shipments will flow through here, stage by stage. Start by filing your first ISF — once it's accepted, the next stages unlock automatically.
      </p>
      <div className="flex items-center justify-center gap-2 mt-6">
        <Link to="/shipments/new">
          <Button size="default" className="gap-1.5 h-10 px-4 rounded-xl font-semibold">
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

  // Welcome modal (post-upgrade redirect)
  const [searchParams, setSearchParams] = useSearchParams();
  const welcomePlanId = searchParams.get('welcome');
  function handleModalClose() {
    setSearchParams(p => { p.delete('welcome'); return p; });
  }

  // Animate the headline counter once on first render
  const greeting = useGreeting();

  // Source data — typed loosely since hooks return `any`
  const filings = (filingsData?.data ?? []) as Filing[];
  const abiDocs = ((abiData?.data ?? []) as any[]) as AbiLite[];
  const mqs = (((mqData as any)?.data ?? []) as any[]) as Array<{
    id: string; status: string; bolNumber: string; createdAt: string; completedAt: string | null;
  }>;

  const tiles = useMemo(() => buildShipments({ filings, abiDocs }), [filings, abiDocs]);

  // Group tiles by stage (preserve sort order from buildShipments)
  const byStage = useMemo(() => {
    const map: Record<Stage, ShipmentTile[]> = { isf: [], manifest: [], entry: [], cleared: [] };
    for (const t of tiles) map[t.stage].push(t);
    // Cap "cleared" to most recent 8 — historical clutter is not useful here
    map.cleared = map.cleared.slice(0, 8);
    return map;
  }, [tiles]);

  const inFlightCount = byStage.isf.length + byStage.manifest.length + byStage.entry.length;
  const attentionCount = tiles.filter(t => t.severity === 'critical' || t.severity === 'warn').length;
  const clearedCount = byStage.cleared.length;

  const activity = useMemo(() => buildActivity({ filings, abiDocs, mqs }), [filings, abiDocs, mqs]);

  const isLoading = filingsLoading || abiLoading || mqLoading;
  const firstName = profile?.firstName?.trim() || null;

  // ── loading skeleton ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-10 max-w-[1500px] mx-auto pb-12">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-12 w-[60%] max-w-[640px]" />
          <Skeleton className="h-4 w-[40%] max-w-[420px]" />
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Brand-new account empty state
  if (filings.length === 0 && abiDocs.length === 0) {
    return (
      <div className="space-y-10 max-w-[1500px] mx-auto pb-12">
        <CelebrationModal planId={welcomePlanId} onClose={handleModalClose} />
        <EmptyHero greeting={greeting} firstName={firstName} />
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-[1500px] mx-auto pb-16">
      <CelebrationModal planId={welcomePlanId} onClose={handleModalClose} />

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <header
        className="space-y-4 opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}
          {greeting}{firstName ? `, ${firstName}` : ''}
        </p>

        <h1 className="text-[44px] leading-[1.05] font-semibold tracking-tight max-w-3xl">
          {inFlightCount === 0 ? (
            <><span className="text-foreground">No shipments in flight.</span><span className="text-muted-foreground"> Time to file.</span></>
          ) : (
            <>
              <span className="text-foreground">You have </span>
              <span className="text-foreground">{inFlightCount} {inFlightCount === 1 ? 'shipment' : 'shipments'}</span>
              <span className="text-muted-foreground"> in flight</span>
              {attentionCount > 0 && <span className="text-foreground">.</span>}
            </>
          )}
        </h1>

        <p className="text-base text-muted-foreground max-w-2xl">
          {attentionCount > 0 ? (
            <>
              <span className="text-amber-600 dark:text-amber-500 font-medium">{attentionCount} {attentionCount === 1 ? 'item needs' : 'items need'} your attention</span>
              {' · '}
              <span>{clearedCount} cleared {clearedCount === 1 ? 'this run' : 'this run'}</span>
            </>
          ) : inFlightCount > 0 ? (
            <>Everything is on track. {clearedCount > 0 && `${clearedCount} ${clearedCount === 1 ? 'shipment' : 'shipments'} cleared recently.`}</>
          ) : (
            <>Run a manifest query to look up CBP data, or start a new ISF filing.</>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link to="/shipments/new">
            <Button size="default" className="gap-1.5 h-10 px-4 rounded-xl font-semibold">
              <Plus className="h-4 w-4" strokeWidth={2.5} /> New Shipment
            </Button>
          </Link>
          <Link to="/abi-documents/new">
            <Button variant="outline" size="default" className="gap-1.5 h-10 rounded-xl">
              <FileCheck className="h-3.5 w-3.5" /> New Entry
            </Button>
          </Link>
          <Link to="/manifest-query">
            <Button variant="outline" size="default" className="gap-1.5 h-10 rounded-xl">
              <Search className="h-3.5 w-3.5" /> Manifest Query
            </Button>
          </Link>
        </div>
      </header>

      {/* ─── Pipeline ─────────────────────────────────────────────────── */}
      <section
        className="opacity-0 animate-fade-in-up"
        style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}
      >
        {/* Lifecycle flow legend */}
        <div className="hidden lg:flex items-center gap-2 mb-6 px-1 text-[11px] font-medium text-muted-foreground/70 select-none">
          <span className="text-foreground/80">Lifecycle</span>
          <ChevronRight className="h-3 w-3 opacity-60" />
          {COLUMNS.map((c, i) => (
            <span key={c.stage} className="flex items-center gap-2">
              <span className="text-foreground/60">{c.title}</span>
              {i < COLUMNS.length - 1 && <ChevronRight className="h-3 w-3 opacity-40" />}
            </span>
          ))}
        </div>

        {/* Columns grid */}
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
      <section
        className="space-y-3 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '320ms', animationFillMode: 'forwards' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
            <Activity className="h-3 w-3" strokeWidth={2.5} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recent activity
          </p>
        </div>
        <ActivityStrip events={activity} />
      </section>

      {/* ─── Hint footer ──────────────────────────────────────────────── */}
      {inFlightCount > 0 && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60 pt-2">
          <Clock className="h-3 w-3" />
          <span>Times shown are relative to now. Click any tile to drill into details.</span>
        </div>
      )}
    </div>
  );
}
