import { useMemo, useState } from 'react';
import { Sparkles, Search, X, ExternalLink, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useFilings } from '@/hooks/useFilings';
import type { Filing } from '@/types/shipment';
import { ageInDays, isStale } from '@/lib/duty-calc-prefill';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface SourcePickerProps {
  /** Currently-applied source (for the banner above the form). */
  source: { label: string; url: string; createdAt: string; kind: 'filing' } | null;
  /** Called when the user picks a filing. The page wires this to the transformer. */
  onPickFiling: (filing: Filing) => void;
  /** Called when the user clears the current source. Restores defaults. */
  onClear: () => void;
}

/**
 * Compact source picker for the Duty Calculator. Two states:
 *   - No source applied → shows "Pre-fill from a shipment" CTA + popover with recent filings.
 *   - Source applied → shows a banner with provenance + "Edit" / "Clear" actions.
 *
 * We deliberately limit candidates to filings that have at least one
 * commodity row — picking an empty draft would leave every field blank.
 */
export function SourcePicker({ source, onPickFiling, onClear }: SourcePickerProps) {
  if (source) {
    return <AppliedSourceBanner source={source} onClear={onClear} />;
  }
  return <PickFilingButton onPickFiling={onPickFiling} />;
}

// ─── Applied banner ──────────────────────────────────────────────────

function AppliedSourceBanner({
  source,
  onClear,
}: {
  source: { label: string; url: string; createdAt: string; kind: 'filing' };
  onClear: () => void;
}) {
  const days = ageInDays(source.createdAt);
  const stale = isStale(source.createdAt);
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
          Pre-filled from{' '}
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

// ─── Pick CTA + popover ──────────────────────────────────────────────

function PickFilingButton({ onPickFiling }: { onPickFiling: (filing: Filing) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Pull recent filings — sortBy updatedAt, limit 25. Only shipments with
  // at least one commodity make useful sources, so we filter client-side
  // to avoid an API change for now.
  const { data, isLoading } = useFilings({
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 25,
  });
  const filings = (data?.data ?? []) as Filing[];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filings
      .filter(f => (f.commodities?.length ?? 0) > 0)
      .filter(f => {
        if (!q) return true;
        const hay = [
          f.masterBol, f.houseBol, f.importerName, f.consigneeName, f.vesselName,
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [filings, query]);

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
        className="w-[420px] p-0"
        align="start"
        sideOffset={6}
      >
        <div className="px-3 pt-3 pb-2 border-b">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            Pick a filing
          </p>
          <p className="text-[12px] text-muted-foreground/80 mt-0.5">
            We'll copy commodities, country, and currency. You can edit anything after.
          </p>
        </div>
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              autoFocus
              placeholder="Search by BOL, importer, vessel…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-[13px] pl-8"
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-[12px] text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 flex flex-col items-center gap-2 text-center">
              <FileText className="h-5 w-5 text-muted-foreground/60" />
              <p className="text-[13px] text-muted-foreground">
                {query.trim() ? 'No filings match.' : 'No filings with commodity data yet.'}
              </p>
              <p className="text-[11.5px] text-muted-foreground/70 max-w-[260px]">
                Filings need at least one commodity to be useful as a pre-fill source.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map(f => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => { onPickFiling(f); setOpen(false); }}
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
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Tiny per-field provenance chip ─────────────────────────────────

interface ProvenanceChipProps {
  /** When `null`, renders nothing — used inline next to a field label. */
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
