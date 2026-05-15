import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ShieldAlert, Search, Building2, ArrowRight, AlertTriangle, ShieldCheck,
  ChevronDown, Loader2, Hash, FileBadge2, Globe2,
  type LucideIcon,
} from 'lucide-react';
import { complianceApi, type UflpaScanResponse } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Risk & Watch List tab — three tools laid out as a single intelligence
 * surface:
 *
 *   • Hero strip: animated KPI tiles (scanned / high / elevated / clean)
 *   • Main column: UFLPA Risk Inbox — flagged filings as elevated cards
 *     with severity ring, search + severity filter, inline expand.
 *   • Side rail: Tools — PGA Flag Lookup + 5106 Self-Check stacked.
 *
 * The aesthetic matches the Compliance Center's other tabs: navy primary,
 * gold accent, slate neutrals, generous padding, severity tones only
 * where they drive action.
 */
export function RiskTab() {
  return (
    <div className="space-y-5">
      <RiskKpiStrip />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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

// ─── KPI hero strip ─────────────────────────────────────────────────

function RiskKpiStrip() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance', 'uflpa-scan'],
    queryFn: () => complianceApi.uflpaScan(),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[112px] rounded-2xl" />)}
      </div>
    );
  }

  const clean = data.scanned - data.counts.high - data.counts.elevated;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiTile
        label="Scanned"
        value={data.scanned}
        sub="last 90 days"
        tone="slate"
        Icon={Globe2}
      />
      <KpiTile
        label="High risk"
        value={data.counts.high}
        sub="evidence required"
        tone="rose"
        Icon={ShieldAlert}
      />
      <KpiTile
        label="Elevated"
        value={data.counts.elevated}
        sub="triage advised"
        tone="amber"
        Icon={AlertTriangle}
      />
      <KpiTile
        label="No flag"
        value={Math.max(0, clean)}
        sub="UFLPA-clean"
        tone="emerald"
        Icon={ShieldCheck}
      />
    </div>
  );
}

type KpiTone = 'slate' | 'rose' | 'amber' | 'emerald';

function KpiTile({
  label, value, sub, tone, Icon,
}: {
  label: string;
  value: number;
  sub: string;
  tone: KpiTone;
  Icon: LucideIcon;
}) {
  const palette = TONE_PALETTE[tone];
  const animated = useCountUp(value, 700);

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-950 px-5 py-4',
        palette.border,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-[60%] pointer-events-none"
        style={{ background: palette.wash }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            'h-9 w-9 rounded-xl ring-1 flex items-center justify-center shrink-0',
            palette.iconBg,
          )}
        >
          <Icon className={cn('h-[18px] w-[18px]', palette.iconFg)} strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[10.5px] font-semibold uppercase tracking-[0.1em]', palette.labelFg)}>
            {label}
          </p>
          <p className="text-[28px] font-semibold tabular-nums leading-none mt-1 text-slate-900 dark:text-slate-50">
            {animated.toLocaleString()}
          </p>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">
            {sub}
          </p>
        </div>
      </div>
    </article>
  );
}

const TONE_PALETTE: Record<KpiTone, {
  border: string; wash: string; iconBg: string; iconFg: string; labelFg: string;
}> = {
  slate: {
    border:  'border-slate-200 dark:border-slate-800',
    wash:    'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(215 16% 47% / 0.06), transparent 70%)',
    iconBg:  'bg-slate-100 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700/60',
    iconFg:  'text-slate-600 dark:text-slate-300',
    labelFg: 'text-slate-500 dark:text-slate-400',
  },
  rose: {
    border:  'border-rose-200/70 dark:border-rose-500/25',
    wash:    'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(0 84% 60% / 0.10), transparent 70%)',
    iconBg:  'bg-rose-100 ring-rose-200/60 dark:bg-rose-500/15 dark:ring-rose-500/30',
    iconFg:  'text-rose-600 dark:text-rose-300',
    labelFg: 'text-rose-700 dark:text-rose-300',
  },
  amber: {
    border:  'border-amber-200/70 dark:border-amber-500/25',
    wash:    'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(43 96% 56% / 0.10), transparent 70%)',
    iconBg:  'bg-amber-100 ring-amber-200/60 dark:bg-amber-500/15 dark:ring-amber-500/30',
    iconFg:  'text-amber-700 dark:text-amber-300',
    labelFg: 'text-amber-700 dark:text-amber-300',
  },
  emerald: {
    border:  'border-emerald-200/70 dark:border-emerald-500/25',
    wash:    'radial-gradient(ellipse 75% 100% at 100% 50%, hsl(160 70% 40% / 0.09), transparent 70%)',
    iconBg:  'bg-emerald-100 ring-emerald-200/60 dark:bg-emerald-500/15 dark:ring-emerald-500/30',
    iconFg:  'text-emerald-700 dark:text-emerald-300',
    labelFg: 'text-emerald-700 dark:text-emerald-300',
  },
};

// ─── UFLPA Risk Inbox ───────────────────────────────────────────────

type SeverityFilter = 'all' | 'high' | 'elevated' | 'low';

function RiskInbox() {
  const { data, isLoading } = useQuery({
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

  if (isLoading || !data) return <Skeleton className="h-[480px] rounded-2xl" />;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 0%, hsl(0 84% 60% / 0.06), transparent 70%)',
        }}
      />
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 ring-1 ring-rose-300/60 dark:ring-rose-400/40 shadow-[0_8px_20px_-10px_rgba(244,63,94,0.5)] flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5 text-rose-50" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
              UFLPA Risk Inbox
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              Forced-labor exposure across your last 90 days of filings — Xinjiang origin signals + UFLPA priority HTS chapters.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search BOL, country, HTS, reasons…"
              className="pl-9 text-[13px]"
            />
          </div>
          <SeverityChips value={filter} onChange={setFilter} counts={data.counts} />
        </div>

        {/* List */}
        {data.flagged.length === 0 ? (
          <EmptyAllClear scanned={data.scanned} />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-6 py-10 text-center">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              No filings match the current filters.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((f) => (
              <RiskRow key={f.filingId} flagged={f} />
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function SeverityChips({
  value, onChange, counts,
}: {
  value: SeverityFilter;
  onChange: (v: SeverityFilter) => void;
  counts: { high: number; elevated: number; low: number };
}) {
  const chips: Array<{ id: SeverityFilter; label: string; count?: number; active: string }> = [
    { id: 'all',      label: 'All',      active: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' },
    { id: 'high',     label: 'High',     count: counts.high,     active: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-rose-50' },
    { id: 'elevated', label: 'Elevated', count: counts.elevated, active: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950' },
  ];
  return (
    <div className="flex gap-1.5 shrink-0">
      {chips.map((c) => {
        const isActive = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-[12px] font-semibold transition-colors cursor-pointer',
              isActive
                ? c.active
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            {c.label}
            {c.count !== undefined && (
              <span className={cn(
                'tabular-nums text-[11px] font-semibold',
                isActive ? 'opacity-90' : 'opacity-60',
              )}>
                {c.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RiskRow({ flagged }: { flagged: UflpaScanResponse['flagged'][number] }) {
  const [open, setOpen] = useState(false);
  const sev = flagged.risk.severity;
  const sevTone =
    sev === 'high' ? {
      ring: 'border-rose-200/70 dark:border-rose-500/30 hover:border-rose-300 dark:hover:border-rose-500/50',
      rail: 'bg-gradient-to-b from-rose-400 to-rose-600',
      badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
      dot: 'bg-rose-500',
    } : sev === 'elevated' ? {
      ring: 'border-amber-200/70 dark:border-amber-500/30 hover:border-amber-300 dark:hover:border-amber-500/50',
      rail: 'bg-gradient-to-b from-amber-300 to-amber-500',
      badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      dot: 'bg-amber-500',
    } : {
      ring: 'border-slate-200 dark:border-slate-800',
      rail: 'bg-gradient-to-b from-slate-300 to-slate-500',
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
      dot: 'bg-slate-400',
    };
  const reducedMotion = useReducedMotion();

  return (
    <motion.li
      layout={reducedMotion ? false : true}
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className={cn(
          'relative rounded-xl border bg-white dark:bg-slate-900/40 overflow-hidden transition-colors',
          sevTone.ring,
        )}>
          {/* Severity rail */}
          <div className={cn('absolute left-0 top-0 bottom-0 w-1', sevTone.rail)} />
          <CollapsibleTrigger className="w-full flex items-center gap-3 pl-5 pr-4 py-3 text-left cursor-pointer">
            <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
              <span className="text-[13px] font-mono font-semibold text-slate-900 dark:text-slate-50">
                {flagged.bol}
              </span>
              <Badge variant="outline" className={cn('text-[10px] font-bold uppercase tracking-[0.06em]', sevTone.badge)}>
                {sev}
              </Badge>
              {flagged.risk.origin?.country && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <Globe2 className="h-3 w-3" />
                  {flagged.risk.origin.country}
                </span>
              )}
              {flagged.risk.htsMatches.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <Hash className="h-3 w-3" />
                  {flagged.risk.htsMatches.slice(0, 2).join(', ')}
                  {flagged.risk.htsMatches.length > 2 && ` +${flagged.risk.htsMatches.length - 2}`}
                </span>
              )}
            </div>
            <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform shrink-0', open && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pl-5 pr-5 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800/70">
              <ul className="space-y-1.5 text-[12.5px] pt-3">
                {flagged.risk.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-slate-700 dark:text-slate-300">
                    <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 shrink-0', sevTone.dot)} />
                    <span className="flex-1">{r}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 ring-1 ring-slate-200 dark:ring-slate-800 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 mb-1">
                  Recommended action
                </p>
                <p className="text-[12.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {flagged.risk.recommendation}
                </p>
              </div>
              <Link
                to={`/shipments/${flagged.filingId}`}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:opacity-80 transition-opacity"
              >
                Open filing <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </motion.li>
  );
}

function EmptyAllClear({ scanned }: { scanned: number }) {
  return (
    <div className="relative overflow-hidden rounded-xl ring-1 ring-emerald-200/60 dark:ring-emerald-500/20 px-6 py-8 text-center">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 50% 0%, hsl(160 70% 40% / 0.09), transparent 70%)',
        }}
      />
      <div className="relative">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 ring-1 ring-emerald-300/60 dark:ring-emerald-400/40 shadow-[0_8px_20px_-10px_rgba(16,185,129,0.5)] flex items-center justify-center mb-3">
          <ShieldCheck className="h-6 w-6 text-emerald-50" strokeWidth={2.5} />
        </div>
        <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
          {scanned === 0 ? 'No filings scanned yet' : 'All clear — no UFLPA risk detected'}
        </p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
          {scanned === 0
            ? 'Once a filing lands in the last 90 days it will appear here.'
            : `${scanned} filings scanned in the last 90 days.`}
        </p>
      </div>
    </div>
  );
}

// ─── PGA Flag Lookup ────────────────────────────────────────────────

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
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 ring-1 ring-blue-300/60 dark:ring-blue-400/40 shadow-[0_8px_20px_-10px_rgba(59,130,246,0.5)] flex items-center justify-center shrink-0">
            <Search className="h-[18px] w-[18px] text-blue-50" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
              PGA Flag Lookup
            </h3>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              Which agencies require notice or permit for this HTS?
            </p>
          </div>
        </div>
        <Input
          value={hts}
          onChange={(e) => setHts(e.target.value)}
          placeholder="0304.19 or 8517.62"
          className="font-mono text-[13px]"
        />
        <div className="mt-3 min-h-[100px]">
          {debounced.length < 2 ? (
            <p className="text-[11.5px] text-slate-400 dark:text-slate-500 text-center pt-6">
              Type ≥2 digits to scan PGA requirements.
            </p>
          ) : isFetching ? (
            <div className="flex items-center justify-center pt-6">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          ) : !data?.matched ? (
            <div className="rounded-lg ring-1 ring-emerald-200/60 dark:ring-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.06] px-3 py-2.5">
              <p className="text-[12px] text-emerald-800 dark:text-emerald-300">
                <strong>No PGA flag</strong> — standard CBP entry.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {data!.flags.map((f, i) => (
                <li
                  key={i}
                  className="rounded-lg ring-1 ring-amber-200/60 dark:ring-amber-500/20 bg-amber-50/40 dark:bg-amber-500/[0.06] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">
                      {f.agency}
                    </Badge>
                    <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-50">
                      {f.name}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed">{f.action}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── 5106 Self-Check ────────────────────────────────────────────────

function FiveOneSixCard() {
  const [ein, setEin] = useState('');
  const normalized = ein.replace(/\D/g, '');
  const isValid = /^\d{9}$/.test(normalized);
  const formatted = isValid ? `${normalized.slice(0, 2)}-${normalized.slice(2)}` : ein;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 ring-1 ring-slate-400/60 dark:ring-slate-500/40 shadow-[0_8px_20px_-10px_rgba(71,85,105,0.5)] flex items-center justify-center shrink-0">
            <Building2 className="h-[18px] w-[18px] text-slate-50" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
              CBP 5106 — Importer ID
            </h3>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              Verify EIN format. CBP rejects filings whose IOR isn't on file.
            </p>
          </div>
        </div>
        <Input
          value={ein}
          onChange={(e) => setEin(e.target.value)}
          placeholder="12-3456789"
          className="font-mono text-[13px]"
          maxLength={11}
        />
        {ein && (
          <div className="mt-3">
            {isValid ? (
              <div className="rounded-lg ring-1 ring-emerald-200/60 dark:ring-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.06] px-3 py-2.5">
                <p className="text-[12px] text-emerald-800 dark:text-emerald-300">
                  <strong>Format OK</strong> — <span className="font-mono">{formatted}</span>
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1 leading-relaxed">
                  Confirm this EIN is on file at CBP via your broker or by filing Form 5106 — there is no public verification API.
                </p>
              </div>
            ) : (
              <div className="rounded-lg ring-1 ring-rose-200/60 dark:ring-rose-500/20 bg-rose-50/40 dark:bg-rose-500/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <p className="text-[12px] text-rose-700 dark:text-rose-300">
                    <strong>Invalid</strong> — EIN must be 9 digits (XX-XXXXXXX).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <a
            href="https://www.cbp.gov/document/forms/form-5106-create-update-importer-identity-form"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:opacity-80"
          >
            <FileBadge2 className="h-3.5 w-3.5" />
            Download CBP Form 5106 <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(target);
  const startRef = useRef<number | null>(null);
  const startValueRef = useRef(target);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setValue(target);
      return;
    }
    startRef.current = null;
    startValueRef.current = value;
    let raf = 0;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(startValueRef.current + (target - startValueRef.current) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, reducedMotion]);

  return value;
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
