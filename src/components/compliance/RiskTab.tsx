import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Search, ArrowRight, AlertTriangle, ShieldCheck,
  ChevronDown, Loader2, Hash, FileBadge2, Globe2,
  type IconType,
} from '@/components/icons';
import { complianceApi, type UflpaScanResponse } from '@/api/client';
import { BAND, FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';

const TEXT: Record<Tone, string> = {
  urgent: 'text-urgent', soon: 'text-soon', info: 'text-info', entry: 'text-entry', done: 'text-done', calm: 'text-muted-foreground',
};

type Severity = UflpaScanResponse['flagged'][number]['risk']['severity'];

const SEVERITY: Record<Severity, { label: string; tone: Tone }> = {
  high: { label: 'High', tone: 'urgent' },
  elevated: { label: 'Elevated', tone: 'soon' },
  low: { label: 'Low', tone: 'calm' },
};

/**
 * Risk and watch list tab: three tools on one surface.
 *
 *   - Top strip: four counts from the UFLPA scan (scanned, high, elevated, no flag).
 *   - Main column: the UFLPA risk inbox, flagged filings with search, a
 *     severity filter and an inline expand.
 *   - Side column: PGA flag lookup and the 5106 self-check, stacked.
 */
export function RiskTab() {
  return (
    <div className="space-y-5">
      <RiskKpiStrip />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RiskInbox />
        </div>
        <div className="space-y-5">
          <PgaLookupCard />
          <FiveOneSixCard />
        </div>
      </div>
    </div>
  );
}

// ─── KPI strip ──────────────────────────────────────────────────────

function RiskKpiStrip() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['compliance', 'uflpa-scan'],
    queryFn: () => complianceApi.uflpaScan(),
    staleTime: 60_000,
  });

  // The inbox below carries the message when the scan fails.
  if (isError && !data) return null;

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
      </div>
    );
  }

  const clean = data.scanned - data.counts.high - data.counts.elevated;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile label="Scanned" value={data.scanned} sub="Last 90 days" tone="calm" Icon={Globe2} />
      <KpiTile label="High risk" value={data.counts.high} sub="Evidence required" tone="urgent" Icon={ShieldAlert} />
      <KpiTile label="Elevated" value={data.counts.elevated} sub="Triage advised" tone="soon" Icon={AlertTriangle} />
      <KpiTile label="No flag" value={Math.max(0, clean)} sub="No UFLPA signal" tone="done" Icon={ShieldCheck} />
    </div>
  );
}

function KpiTile({
  label, value, sub, tone, Icon,
}: {
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  Icon: IconType;
}) {
  return (
    <article className={cn(PANEL, 'px-5 py-4')}>
      <p className={cn('flex items-center gap-1.5 text-[12px] font-medium', TEXT[tone])}>
        <Icon weight="duotone" className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-[28px] font-semibold leading-9 tracking-[-0.02em] tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[12px] text-muted-foreground">{sub}</p>
    </article>
  );
}

// ─── UFLPA risk inbox ───────────────────────────────────────────────

type SeverityFilter = 'all' | 'high' | 'elevated' | 'low';

function RiskInbox() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['compliance', 'uflpa-scan'],
    queryFn: () => complianceApi.uflpaScan(),
    staleTime: 60_000,
  });
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.flagged.filter((f) => {
      if (filter !== 'all' && f.risk.severity !== filter) return false;
      if (!q) return true;
      return (
        f.bol.toLowerCase().includes(q) ||
        f.risk.reasons.some((r) => r.toLowerCase().includes(q)) ||
        (f.risk.origin?.country ?? '').toLowerCase().includes(q) ||
        f.risk.htsMatches.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [data, filter, search]);

  if (isError && !data) {
    return (
      <p role="alert" className={cn(PANEL, 'px-5 py-4 text-[13px] text-muted-foreground')}>
        The UFLPA scan could not load.{' '}
        <button type="button" onClick={() => refetch()} className="text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">Retry</button>
      </p>
    );
  }

  if (isLoading || !data) return <Skeleton className="h-[480px] rounded-xl" />;

  return (
    <section aria-labelledby="uflpa-inbox-title" className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 id="uflpa-inbox-title" className="text-[14px] font-semibold">UFLPA risk inbox</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Forced-labor exposure across your last 90 days of filings: Xinjiang origin signals and UFLPA priority HTS chapters.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 border-t border-border/70 px-5 py-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill, country, HTS or reason"
            aria-label="Search flagged filings"
            className="pl-9 text-[13px]"
          />
        </div>
        <SeverityChips value={filter} onChange={setFilter} counts={data.counts} />
      </div>

      {/* List */}
      {data.flagged.length === 0 ? (
        <EmptyAllClear scanned={data.scanned} />
      ) : filtered.length === 0 ? (
        <p className="border-t border-border/70 px-5 py-8 text-center text-[13px] text-muted-foreground">
          No filings match the current filters.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/70">
          {filtered.map((f) => (
            <RiskRow key={f.filingId} flagged={f} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SeverityChips({
  value, onChange, counts,
}: {
  value: SeverityFilter;
  onChange: (v: SeverityFilter) => void;
  counts: { high: number; elevated: number; low: number };
}) {
  const chips: Array<{ id: SeverityFilter; label: string; count?: number }> = [
    { id: 'all',      label: 'All' },
    { id: 'high',     label: 'High',     count: counts.high },
    { id: 'elevated', label: 'Elevated', count: counts.elevated },
  ];
  return (
    <div role="radiogroup" aria-label="Severity" className="flex shrink-0 rounded-lg bg-muted p-0.5">
      {chips.map((c) => {
        const isActive = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(c.id)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground can-hover:hover:text-foreground',
            )}
          >
            {c.label}
            {c.count !== undefined && <span className="text-[12px] tabular-nums text-muted-foreground">{c.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function RiskRow({ flagged }: { flagged: UflpaScanResponse['flagged'][number] }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY[flagged.risk.severity] ?? SEVERITY.low;

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-5 py-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring can-hover:hover:bg-muted/50">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-[13px] font-medium">{flagged.bol}</span>
            <span className={cn('rounded-full px-2 py-px text-[11.5px] font-medium', TINT[sev.tone])}>{sev.label}</span>
            {flagged.risk.origin?.country && (
              <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" aria-hidden />
                {flagged.risk.origin.country}
              </span>
            )}
            {flagged.risk.htsMatches.length > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-[12px] text-muted-foreground">
                <Hash className="h-3.5 w-3.5" aria-hidden />
                {flagged.risk.htsMatches.slice(0, 2).join(', ')}
                {flagged.risk.htsMatches.length > 2 && ` +${flagged.risk.htsMatches.length - 2}`}
              </span>
            )}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 px-5 pb-4">
            <ul className="space-y-1.5 text-[13px]">
              {flagged.risk.reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', FILL[sev.tone])} />
                  <span className="flex-1">{r}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[12px] text-muted-foreground">Recommended action</p>
              <p className="mt-0.5 text-[13px]">{flagged.risk.recommendation}</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={`/shipments/${flagged.filingId}`}>Open filing<ArrowRight aria-hidden /></Link>
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function EmptyAllClear({ scanned }: { scanned: number }) {
  const tone: Tone = scanned === 0 ? 'calm' : 'done';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/70 px-5 py-4', BAND[tone])}>
      <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-white dark:text-background', FILL[tone])}>
        <ShieldCheck weight="duotone" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-[16px] font-semibold leading-6">
          {scanned === 0 ? 'No filings scanned yet' : 'No UFLPA risk found'}
        </p>
        <p className="mt-0.5 text-[13px] text-foreground/75">
          {scanned === 0
            ? 'Filings from the last 90 days are scanned and any that are flagged appear here.'
            : <><span className="tabular-nums">{scanned.toLocaleString()}</span> {scanned === 1 ? 'filing' : 'filings'} scanned in the last 90 days.</>}
        </p>
      </div>
    </div>
  );
}

// ─── PGA flag lookup ────────────────────────────────────────────────

function PgaLookupCard() {
  const [hts, setHts] = useState('');
  const debounced = useDebounce(hts.trim(), 350);

  const { data, isFetching } = useQuery({
    queryKey: ['compliance', 'pga-lookup', debounced],
    queryFn: () => complianceApi.pgaLookup(debounced),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
  });

  return (
    <section aria-labelledby="pga-lookup-title" className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 id="pga-lookup-title" className="text-[14px] font-semibold">PGA flag lookup</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Which agencies require notice or a permit for this HTS code?
        </p>
      </div>
      <div className="border-t border-border/70 px-5 py-4">
        <Input
          value={hts}
          onChange={(e) => setHts(e.target.value)}
          placeholder="0304.19 or 8517.62"
          aria-label="HTS code"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-[13px]"
        />
        <div className="mt-3 min-h-[100px]" aria-live="polite">
          {debounced.length < 2 ? (
            <p className="pt-6 text-center text-[12.5px] text-muted-foreground">
              Type at least 2 digits to look up PGA requirements.
            </p>
          ) : isFetching ? (
            <div className="flex items-center justify-center pt-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Looking up" />
            </div>
          ) : !data?.matched ? (
            <p className={cn('rounded-lg px-3 py-2.5 text-[13px]', BAND.done)}>
              <span className="font-semibold">No PGA flag.</span> Standard CBP entry.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.flags.map((f, i) => (
                <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-2 py-px text-[11.5px] font-medium', TINT.soon)}>{f.agency}</span>
                    <span className="text-[13px] font-medium">{f.name}</span>
                  </p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{f.action}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── 5106 self-check ────────────────────────────────────────────────

function FiveOneSixCard() {
  const [ein, setEin] = useState('');
  const normalized = ein.replace(/\D/g, '');
  const isValid = /^\d{9}$/.test(normalized);
  const formatted = isValid ? `${normalized.slice(0, 2)}-${normalized.slice(2)}` : ein;

  return (
    <section aria-labelledby="importer-id-title" className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 id="importer-id-title" className="text-[14px] font-semibold">CBP 5106: importer ID</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Check the EIN format. CBP rejects filings whose importer of record is not on file.
        </p>
      </div>
      <div className="border-t border-border/70 px-5 py-4">
        <Input
          value={ein}
          onChange={(e) => setEin(e.target.value)}
          placeholder="12-3456789"
          aria-label="EIN"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-[13px]"
          maxLength={11}
        />
        {ein && (
          <div className="mt-3" aria-live="polite">
            {isValid ? (
              <div className={cn('rounded-lg px-3 py-2.5', BAND.done)}>
                <p className="text-[13px]">
                  <span className="font-semibold">Format OK:</span> <span className="font-mono">{formatted}</span>
                </p>
                <p className="mt-1 text-[12.5px] text-foreground/75">
                  Confirm this EIN is on file at CBP through your broker or by filing Form 5106. There is no public verification API.
                </p>
              </div>
            ) : (
              <p className={cn('flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px]', BAND.urgent)}>
                <AlertTriangle weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-urgent" aria-hidden />
                <span><span className="font-semibold">Invalid.</span> An EIN must be 9 digits (XX-XXXXXXX).</span>
              </p>
            )}
          </div>
        )}
        <Button asChild size="sm" variant="outline" className="mt-3">
          <a
            href="https://www.cbp.gov/document/forms/form-5106-create-update-importer-identity-form"
            target="_blank"
            rel="noreferrer"
          >
            <FileBadge2 aria-hidden />Download CBP Form 5106<ArrowRight aria-hidden />
          </a>
        </Button>
      </div>
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
