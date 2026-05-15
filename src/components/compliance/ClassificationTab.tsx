import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles, Search, Globe, BookOpen, ArrowUpRight, Loader2, Hash, ChevronRight,
} from 'lucide-react';
import {
  complianceApi,
  type HtsClassificationResponse,
  type AddCvdLookupResponse,
  type FtaPreferenceResponse,
} from '@/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Classification & Rules tab — three importer-facing tools, all card-based
 * to match the Overview design language.
 *
 *   1. HTS Classifier        — describe goods, get AI-suggested HTS + alts
 *   2. ADD/CVD Lookup        — check active Commerce orders by HTS / country
 *   3. FTA Preference        — given origin country, list FTA programs
 *
 * Each section is a self-contained card with its own input + result panel
 * so a user can use one without scrolling past the others.
 */
export function ClassificationTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="lg:col-span-2">
        <HtsClassifierCard />
      </div>
      <AddCvdLookupCard />
      <FtaPreferenceCard />
    </div>
  );
}

// ─── HTS Classifier ─────────────────────────────────────────────────

function HtsClassifierCard() {
  const [description, setDescription] = useState('');
  const classify = useMutation({
    mutationFn: (d: string) => complianceApi.classifyHts(d),
  });

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const d = description.trim();
    if (d.length < 3 || classify.isPending) return;
    classify.mutate(d);
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      {/* Subtle gold→transparent wash at top — same hint as Overview hero */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 0%, hsl(43 96% 56% / 0.10), transparent 70%)',
        }}
      />
      <div className="relative p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 shadow-[0_8px_20px_-10px_rgba(245,158,11,0.5)] flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-amber-950" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
              HTS Classifier
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              Describe the goods. The classifier returns the best 10-digit HTS match plus alternatives, with reasoning.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Wireless network router, 2.4 GHz dual-band, model X500"
            rows={2}
            className="resize-none text-[13px] leading-relaxed"
            maxLength={500}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {description.length}/500
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={description.trim().length < 3 || classify.isPending}
              className="gap-1.5 font-semibold"
            >
              {classify.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Classify
            </Button>
          </div>
        </form>

        {/* Results */}
        {classify.data && <ClassifierResult data={classify.data} />}
        {classify.isError && (
          <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
            Classifier upstream failed. Please try again in a moment.
          </div>
        )}
      </div>
    </article>
  );
}

function ClassifierResult({ data }: { data: HtsClassificationResponse }) {
  if (!data.matched) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5 text-[12.5px] text-amber-800 dark:text-amber-300">
        <strong className="font-semibold">Description too vague.</strong>{' '}
        {data.message ?? 'Add material, function, or industry context and try again.'}
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-3">
      {/* Primary HTS */}
      {data.primary && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-[0.08em] bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
              Best match
            </Badge>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[20px] font-semibold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300">
              {formatHts(data.primary.hts)}
            </span>
            <span className="text-[13px] text-slate-700 dark:text-slate-200">
              {data.primary.description}
            </span>
          </div>
          {data.explanation && (
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
              {data.explanation}
            </p>
          )}
        </div>
      )}

      {/* Alternatives */}
      {data.alternatives.length > 0 && (
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400 mb-2">
            Alternatives
          </div>
          <ul className="space-y-1.5">
            {data.alternatives.map((alt, i) => (
              <li key={i} className="flex items-baseline gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-3.5 py-2">
                <span className="text-[13px] font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-50 shrink-0">
                  {formatHts(alt.hts)}
                </span>
                <span className="text-[12px] text-slate-600 dark:text-slate-400 truncate">
                  {alt.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── ADD/CVD Lookup ─────────────────────────────────────────────────

function AddCvdLookupCard() {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q.trim(), 300);
  const [data, setData] = useState<AddCvdLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debounced.length < 2) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    complianceApi.addCvdLookup(debounced).then((r) => {
      if (!cancelled) { setData(r); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-rose-50 dark:bg-rose-500/10 ring-1 ring-rose-200/60 dark:ring-rose-500/20 flex items-center justify-center shrink-0">
          <Search className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
            ADD / CVD Lookup
          </h3>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            Search active Commerce anti-dumping and countervailing orders by HTS, country, or product.
          </p>
        </div>
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="HTS, country (e.g. CN), or product"
        className="text-[13px]"
      />

      <div className="mt-3 min-h-[160px]">
        {debounced.length < 2 ? (
          <EmptyHint message="Type to search Commerce ADD/CVD orders" />
        ) : loading ? (
          <div className="flex items-center justify-center pt-12">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : !data?.matched ? (
          <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.06] px-3.5 py-3 mt-2">
            <p className="text-[12.5px] text-emerald-800 dark:text-emerald-300 font-medium">
              No matching orders in our table.
            </p>
            <p className="text-[11.5px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
              Note: our seed covers ~20 common orders; Commerce maintains ~600. Verify on the ACE export for full coverage.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 mt-1 max-h-[280px] overflow-y-auto">
            {data!.orders.map((o, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">
                    {o.type}
                  </Badge>
                  <span className="text-[11px] font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                    {o.case}
                  </span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {o.country}
                  </span>
                </div>
                <div className="text-[12.5px] font-medium text-slate-900 dark:text-slate-50 mt-1">
                  {o.product}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                  HTS: {o.htsPrefixes.join(' · ')}
                </div>
                {o.note && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                    {o.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

// ─── FTA Preference ─────────────────────────────────────────────────

function FtaPreferenceCard() {
  const [country, setCountry] = useState('');
  const normalized = country.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
  const [data, setData] = useState<FtaPreferenceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (normalized.length !== 2) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    complianceApi.ftaPreference(normalized).then((r) => {
      if (!cancelled) { setData(r); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [normalized]);

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-200/60 dark:ring-blue-500/20 flex items-center justify-center shrink-0">
          <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
            FTA Preference Programs
          </h3>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            Enter an ISO-2 country code to see free trade agreements that include it.
          </p>
        </div>
      </div>

      <Input
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        placeholder="ISO-2 (e.g. MX, IN, KR)"
        className="text-[13px] font-mono uppercase tracking-widest max-w-[160px]"
        maxLength={2}
      />

      <div className="mt-3 min-h-[160px]">
        {normalized.length !== 2 ? (
          <EmptyHint message="Type a 2-letter country code" />
        ) : loading ? (
          <div className="flex items-center justify-center pt-12">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : !data?.matched ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-3.5 py-3 mt-2">
            <p className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300">
              No FTA program includes <span className="font-mono">{normalized}</span>.
            </p>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              Goods from this country pay standard MFN rates unless covered by a unilateral preference (e.g. GSP) — check current GSP renewal status with USTR.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 mt-1 max-h-[280px] overflow-y-auto">
            {data!.programs.map((p, i) => (
              <li key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
                        {p.key}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono font-bold tabular-nums">
                        Claim: {p.claimCode}
                      </Badge>
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {p.fullName}
                    </div>
                  </div>
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-80 shrink-0"
                  >
                    USTR <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {p.covers}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center pt-12 text-[12px] text-slate-400 dark:text-slate-500">
      {message}
    </div>
  );
}

/** Format raw HTS digits as dotted: "8517620010" → "8517.62.00.10". */
function formatHts(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length < 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  if (d.length <= 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}.${d.slice(8, 10)}`;
}

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
