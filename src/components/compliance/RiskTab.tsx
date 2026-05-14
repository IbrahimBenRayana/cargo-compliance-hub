import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Search, Building2, ArrowRight, AlertTriangle, ShieldCheck,
  ChevronDown, Loader2,
} from 'lucide-react';
import { complianceApi } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Risk & Watch List tab — three working tools:
 *
 *  1. UFLPA Risk Scan — backend assesses every filing in the last 90 days
 *     for Xinjiang origin signals + UFLPA-priority HTS chapters. Shown as
 *     a count-by-severity strip + an expandable list of flagged filings.
 *  2. PGA Flag Lookup — type any HTS, see which agencies require permits
 *     (FDA, USDA-APHIS, EPA, FCC, etc.). Live as you type.
 *  3. 5106 Self-Check — validate that the EIN on file is correctly
 *     formatted and registered. Format-only client-side; the actual CBP
 *     register status isn't publicly queryable so we just guide the user.
 */
export function RiskTab() {
  return (
    <div className="space-y-5">
      <UflpaScanCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PgaLookupCard />
        <FiveOneSixCard />
      </div>
    </div>
  );
}

// ─── UFLPA Scan ─────────────────────────────────────────────────────

function UflpaScanCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance', 'uflpa-scan'],
    queryFn: () => complianceApi.uflpaScan(),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return <Skeleton className="h-44 rounded-xl" />;
  }

  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            UFLPA Risk Scan
          </h3>
        </div>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-4">
          Forced-labor exposure across your last 90 days of filings — Xinjiang origin signals + UFLPA priority HTS chapters
        </p>

        {/* Severity counts */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <CountTile count={data.counts.high}     label="High"     tone="rose"    />
          <CountTile count={data.counts.elevated} label="Elevated" tone="amber"   />
          <CountTile count={data.counts.low}      label="No flag"  tone="emerald" />
        </div>

        {data.flagged.length === 0 ? (
          <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.06] px-4 py-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[12.5px] text-emerald-800 dark:text-emerald-300">
              {data.scanned === 0
                ? 'No filings scanned yet.'
                : `All ${data.scanned} filings scanned — no UFLPA risk detected.`}
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.flagged.slice(0, 6).map((f) => (
              <UflpaRow key={f.filingId} flagged={f} />
            ))}
            {data.flagged.length > 6 && (
              <p className="text-[12px] text-slate-500 dark:text-slate-400 pt-1 text-center">
                + {data.flagged.length - 6} more flagged
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UflpaRow({
  flagged,
}: {
  flagged: NonNullable<Awaited<ReturnType<typeof complianceApi.uflpaScan>>>['flagged'][number];
}) {
  const [open, setOpen] = useState(false);
  const sev = flagged.risk.severity;
  const tone =
    sev === 'high'
      ? { ring: 'border-rose-200 dark:border-rose-500/30',  badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',  dot: 'bg-rose-500' }
      : sev === 'elevated'
      ? { ring: 'border-amber-200 dark:border-amber-500/30',badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30', dot: 'bg-amber-500' }
      : { ring: 'border-slate-200 dark:border-slate-800',   badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',                                       dot: 'bg-slate-400' };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn('rounded-lg border bg-white dark:bg-slate-900/40', tone.ring)}>
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left cursor-pointer">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', tone.dot)} />
            <span className="text-[13px] font-mono font-semibold text-slate-900 dark:text-slate-50 truncate">
              {flagged.bol}
            </span>
            <Badge variant="outline" className={cn('text-[10px] font-bold uppercase shrink-0', tone.badge)}>
              {sev}
            </Badge>
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform shrink-0', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3.5 pb-3 space-y-2 text-[12.5px]">
            <ul className="space-y-1 text-slate-700 dark:text-slate-300">
              {flagged.risk.reasons.map((r, i) => (
                <li key={i} className="flex gap-2"><span className="text-slate-400">•</span> {r}</li>
              ))}
            </ul>
            <p className="text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Recommended action: </span>
              {flagged.risk.recommendation}
            </p>
            <Link
              to={`/shipments/${flagged.filingId}`}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:opacity-80 transition-opacity"
            >
              Open filing <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── PGA Flag Lookup ─────────────────────────────────────────────────

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
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            PGA Flag Lookup
          </h3>
        </div>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3">
          Which agencies require notice or permit for this HTS at the port?
        </p>
        <Input
          value={hts}
          onChange={(e) => setHts(e.target.value)}
          placeholder="HTS code (e.g. 0304.19 or 8517.62)"
          className="font-mono text-[13px]"
        />
        <div className="mt-3 min-h-[120px]">
          {debounced.length < 2 ? (
            <p className="text-[12px] text-slate-400 dark:text-slate-500 text-center pt-8">
              Type an HTS to scan PGA requirements
            </p>
          ) : isFetching ? (
            <div className="flex items-center justify-center pt-8">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          ) : !data?.matched ? (
            <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.06] px-3.5 py-2.5">
              <p className="text-[12.5px] text-emerald-800 dark:text-emerald-300">
                <strong>No PGA flag</strong> for this HTS chapter. Standard CBP entry.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {data!.flags.map((f, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/[0.06] px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">
                      {f.agency}
                    </Badge>
                    <span className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-50">
                      {f.name}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-700 dark:text-slate-300">{f.action}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 5106 Self-Check ────────────────────────────────────────────────

function FiveOneSixCard() {
  const [ein, setEin] = useState('');
  const normalized = ein.replace(/\D/g, '');
  const isValid = /^\d{9}$/.test(normalized);
  const formatted = isValid ? `${normalized.slice(0, 2)}-${normalized.slice(2)}` : ein;

  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            CBP Form 5106 — Importer Identity
          </h3>
        </div>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3">
          Verify your EIN is in the correct format. CBP rejects filings whose IOR is not on file with this form.
        </p>
        <Input
          value={ein}
          onChange={(e) => setEin(e.target.value)}
          placeholder="EIN (e.g. 12-3456789)"
          className="font-mono text-[13px]"
          maxLength={11}
        />
        {ein && (
          <div className="mt-3">
            {isValid ? (
              <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.06] px-3.5 py-2.5">
                <p className="text-[12.5px] text-emerald-800 dark:text-emerald-300">
                  <strong>Format OK</strong> — <span className="font-mono">{formatted}</span>
                </p>
                <p className="text-[11.5px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                  Confirm this EIN is on file at CBP via your customs broker or by filing Form 5106. CBP doesn't expose a public verification API.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-rose-200/60 dark:border-rose-500/20 bg-rose-50/40 dark:bg-rose-500/[0.06] px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <p className="text-[12.5px] text-rose-700 dark:text-rose-300">
                    <strong>Invalid format</strong> — EIN must be 9 digits (XX-XXXXXXX).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          <a
            href="https://www.cbp.gov/document/forms/form-5106-create-update-importer-identity-form"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:opacity-80"
          >
            Download CBP Form 5106 <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function CountTile({ count, label, tone }: { count: number; label: string; tone: 'rose' | 'amber' | 'emerald' }) {
  const colors =
    tone === 'rose'    ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20'
    : tone === 'amber' ? 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20'
    :                    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20';
  return (
    <div className={cn('rounded-lg ring-1 px-3 py-2.5 text-center', colors)}>
      <div className="text-[20px] font-semibold tabular-nums leading-none">{count}</div>
      <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold mt-1">{label}</div>
    </div>
  );
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
