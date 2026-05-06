import { useMemo, useState } from 'react';
import { Sparkles, Search, X, ExternalLink, AlertTriangle, FileText, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFilings } from '@/hooks/useFilings';
import { useAbiDocumentsList } from '@/hooks/useAbiDocument';
import type { Filing } from '@/types/shipment';
import type { AbiDocument } from '@/api/client';
import { ageInDays, isStale } from '@/lib/duty-calc-prefill';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface SourcePickerProps {
  /** Currently-applied source (for the banner above the form). */
  source: { label: string; url: string; createdAt: string; kind: 'filing' | 'abi' } | null;
  onPickFiling: (filing: Filing) => void;
  onPickAbiDocument: (doc: AbiDocument) => void;
  onClear: () => void;
}

/**
 * Tabbed source picker for the Duty Calculator. Two sources today:
 *   - ISF Filings        (lower-fidelity, partial pre-fill)
 *   - CBP Entries (ABI)  (higher-fidelity, near-total pre-fill)
 *
 * Manifest queries are intentionally NOT a source — they don't carry
 * HTS / value / commodities, so they wouldn't pre-fill the duty-affecting
 * fields. Adding them as a source would be theatre.
 */
export function SourcePicker({ source, onPickFiling, onPickAbiDocument, onClear }: SourcePickerProps) {
  if (source) {
    return <AppliedSourceBanner source={source} onClear={onClear} />;
  }
  return <PickSourceButton onPickFiling={onPickFiling} onPickAbiDocument={onPickAbiDocument} />;
}

// ─── Applied banner ──────────────────────────────────────────────────

function AppliedSourceBanner({
  source,
  onClear,
}: {
  source: { label: string; url: string; createdAt: string; kind: 'filing' | 'abi' };
  onClear: () => void;
}) {
  const days = ageInDays(source.createdAt);
  const stale = isStale(source.createdAt);
  const sourceType = source.kind === 'abi' ? 'CBP Entry' : 'ISF Filing';
  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex items-start gap-3',
        stale
          ? 'border-amber-500/40 bg-amber-500/[0.05]'
          : 'border-emerald-500/30 bg-emerald-500/[0.04]',
      )}
    >
      <div
        className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
          stale ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600',
        )}
      >
        {stale ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground">
          Pre-filled from {sourceType}{' '}
          <Link
            to={source.url}
            className="font-mono text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
          >
            {source.label}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
        </p>
        <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
          {stale ? (
            <>
              Filed <span className="tabular-nums font-medium text-amber-700 dark:text-amber-400">{days} days ago</span>.
              Verify the details below before calculating — HTS classifications, values, or programs may have changed since.
            </>
          ) : (
            <>
              Filed <span className="tabular-nums font-medium">{days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} ago`}</span>.
              Edit any field to override — your edits replace the pre-fill.
            </>
          )}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="text-xs h-7 text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-3.5 w-3.5 mr-1" /> Clear
      </Button>
    </div>
  );
}

// ─── Pick CTA + tabbed popover ───────────────────────────────────────

function PickSourceButton({
  onPickFiling,
  onPickAbiDocument,
}: {
  onPickFiling: (filing: Filing) => void;
  onPickAbiDocument: (doc: AbiDocument) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'filings' | 'entries'>('entries'); // entries are higher-fidelity, default to that tab
  const [query, setQuery] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 h-10 rounded-lg w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="font-medium">Pre-fill from a shipment</span>
          <span className="text-[12px] text-muted-foreground/70 ml-auto">Optional</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[440px] p-0"
        align="start"
        sideOffset={6}
      >
        <div className="px-3 pt-3 pb-2 border-b">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            Pick a source
          </p>
          <p className="text-[12px] text-muted-foreground/80 mt-0.5">
            Entries pre-fill more fields than ISF filings. You can edit anything after.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'filings' | 'entries')}>
          <div className="px-3 pt-2 border-b">
            <TabsList className="h-8 bg-secondary/40 p-0.5">
              <TabsTrigger value="entries" className="text-[12px] h-7 px-2.5 gap-1.5">
                <FileCheck className="h-3 w-3" /> Entries
              </TabsTrigger>
              <TabsTrigger value="filings" className="text-[12px] h-7 px-2.5 gap-1.5">
                <FileText className="h-3 w-3" /> ISF Filings
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="px-3 py-2 border-b">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                autoFocus
                placeholder={tab === 'entries' ? 'Search by entry number, MBL, importer…' : 'Search by BOL, importer, vessel…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 text-[13px] pl-8"
              />
            </div>
          </div>

          <TabsContent value="entries" className="m-0">
            <EntriesList
              query={query}
              onPick={(doc) => { onPickAbiDocument(doc); setOpen(false); }}
            />
          </TabsContent>
          <TabsContent value="filings" className="m-0">
            <FilingsList
              query={query}
              onPick={(filing) => { onPickFiling(filing); setOpen(false); }}
            />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

// ─── List bodies ─────────────────────────────────────────────────────

function EntriesList({ query, onPick }: { query: string; onPick: (doc: AbiDocument) => void }) {
  const { data, isLoading } = useAbiDocumentsList({ take: 25 });
  const docs = (data?.data ?? []) as AbiDocument[];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs
      // Only entries that have at least one item somewhere are useful sources.
      .filter(d => {
        const hasAnyItem = (d.payload?.manifest ?? []).some(m =>
          (m?.invoices ?? []).some(inv => (inv?.items ?? []).length > 0),
        );
        return hasAnyItem;
      })
      .filter(d => {
        if (!q) return true;
        const hay = [d.entryNumber, d.mbolNumber, d.iorName, d.consigneeName].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [docs, query]);

  return (
    <ListShell isLoading={isLoading} emptyHint="Entries need at least one line item to be useful as a pre-fill source." empty={filtered.length === 0} query={query}>
      {filtered.map(d => {
        const itemCount = (d.payload?.manifest ?? []).reduce(
          (sum, m) => sum + (m?.invoices ?? []).reduce(
            (s, inv) => s + ((inv?.items ?? []).length ?? 0), 0,
          ), 0,
        );
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onPick(d)}
              className="w-full text-left px-3 py-2.5 hover:bg-secondary/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-mono font-medium text-foreground truncate">
                  {d.entryNumber || d.mbolNumber || d.id.slice(0, 8).toUpperCase()}
                </p>
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-[0.12em] shrink-0',
                    d.status === 'ACCEPTED' && 'text-emerald-600 dark:text-emerald-400',
                    d.status === 'REJECTED' && 'text-red-600 dark:text-red-400',
                    d.status === 'SENT'     && 'text-blue-600 dark:text-blue-400',
                    d.status === 'DRAFT'    && 'text-muted-foreground',
                  )}
                >
                  {d.status}
                </span>
              </div>
              <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                {[d.iorName, d.consigneeName].filter(Boolean).join(' · ') || '—'}
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                {' · '}
                <span className="tabular-nums">{ageInDays(d.createdAt)}d old</span>
                {isStale(d.createdAt) && <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-medium">stale</span>}
              </p>
            </button>
          </li>
        );
      })}
    </ListShell>
  );
}

function FilingsList({ query, onPick }: { query: string; onPick: (filing: Filing) => void }) {
  const { data, isLoading } = useFilings({ sortBy: 'updatedAt', sortOrder: 'desc', limit: 25 });
  const filings = (data?.data ?? []) as Filing[];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filings
      .filter(f => (f.commodities?.length ?? 0) > 0)
      .filter(f => {
        if (!q) return true;
        const hay = [f.masterBol, f.houseBol, f.importerName, f.consigneeName, f.vesselName].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [filings, query]);

  return (
    <ListShell isLoading={isLoading} emptyHint="Filings need at least one commodity to be useful as a pre-fill source." empty={filtered.length === 0} query={query}>
      {filtered.map(f => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onPick(f)}
            className="w-full text-left px-3 py-2.5 hover:bg-secondary/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-mono font-medium text-foreground truncate">
                {f.masterBol || f.houseBol || f.id.slice(0, 8).toUpperCase()}
              </p>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.12em] shrink-0',
                  f.status === 'accepted' && 'text-emerald-600 dark:text-emerald-400',
                  f.status === 'rejected' && 'text-red-600 dark:text-red-400',
                  f.status === 'submitted' && 'text-blue-600 dark:text-blue-400',
                  f.status === 'draft' && 'text-muted-foreground',
                )}
              >
                {f.status}
              </span>
            </div>
            <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
              {[f.importerName, f.vesselName].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              {(f.commodities?.length ?? 0)} {f.commodities?.length === 1 ? 'commodity' : 'commodities'}
              {' · '}
              <span className="tabular-nums">{ageInDays(f.createdAt)}d old</span>
              {isStale(f.createdAt) && <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-medium">stale</span>}
            </p>
          </button>
        </li>
      ))}
    </ListShell>
  );
}

function ListShell({
  isLoading,
  empty,
  query,
  emptyHint,
  children,
}: {
  isLoading: boolean;
  empty: boolean;
  query: string;
  emptyHint: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return <div className="p-6 text-center text-[12px] text-muted-foreground">Loading…</div>;
  }
  if (empty) {
    return (
      <div className="p-6 flex flex-col items-center gap-2 text-center">
        <FileText className="h-5 w-5 text-muted-foreground/60" />
        <p className="text-[13px] text-muted-foreground">
          {query.trim() ? 'No matches.' : 'Nothing here yet.'}
        </p>
        <p className="text-[11.5px] text-muted-foreground/70 max-w-[260px]">
          {emptyHint}
        </p>
      </div>
    );
  }
  return (
    <div className="max-h-[320px] overflow-y-auto">
      <ul className="divide-y divide-border/60">{children}</ul>
    </div>
  );
}

// ─── Tiny per-field provenance chip (exported for a future pass) ─────

interface ProvenanceChipProps {
  source: { label: string; url: string; createdAt: string } | null;
}

export function ProvenanceChip({ source }: ProvenanceChipProps) {
  if (!source) return null;
  const days = ageInDays(source.createdAt);
  return (
    <Link
      to={source.url}
      title={`from ${source.label} · ${days === 0 ? 'today' : `${days}d ago`}`}
      className={cn(
        'inline-flex items-center gap-1 ml-1.5 px-1.5 h-4 rounded text-[9.5px] font-mono font-medium',
        'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20',
        'hover:ring-amber-500/40 transition-colors',
      )}
    >
      <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
      <span className="tabular-nums">{source.label.slice(0, 12)}</span>
    </Link>
  );
}
