import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowUpRight, Loader2, Sparkles } from '@/components/icons';
import {
  complianceApi,
  type AddCvdLookupResponse,
  type FtaPreferenceResponse,
} from '@/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TINT } from '@/components/dashboard/tones';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { HtsSuggestions } from '@/components/hts/HtsSuggestions';
import { formatHtsCode } from '@/lib/htsFormat';

/**
 * Classification & Rules tab: three importer-facing tools, one panel each.
 *
 *   1. HTS Classifier        — describe goods, get AI-suggested HTS + alts
 *   2. ADD/CVD Lookup        — check active Commerce orders by HTS / country
 *   3. FTA Preference        — given origin country, list FTA programs
 *
 * Each section is a self-contained card with its own input + result panel
 * so a user can use one without scrolling past the others.
 */
const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const PILL = 'rounded-full px-2 py-px text-[11.5px] font-medium';

export function ClassificationTab() {
  // The HTS Classifier is on every plan for now (native classifier, 2026-10-21).
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

  // A "did you mean" reading replaces the description and runs again.
  function retry(d: string) {
    setDescription(d);
    classify.mutate(d);
  }

  function copyCode(code: string) {
    void navigator.clipboard?.writeText(code).then(
      () => toast.success(`Copied ${formatHtsCode(code)}`),
      () => toast.error('Could not copy the code.'),
    );
  }

  return (
    <section aria-labelledby="hts-classifier-title" className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 id="hts-classifier-title" className="text-[14px] font-semibold">HTS classifier</h2>
        <p className="mt-0.5 max-w-[75ch] text-[12.5px] text-muted-foreground">
          Describe the goods: what it is, what it's made of and what it's used for. You get the most likely 10-digit HTS codes with their duty rates, or the questions to answer first.
        </p>
      </div>

      <div className="border-t border-border/70 p-5">
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Wireless network router, 2.4 GHz dual-band, model X500"
            aria-label="Description of the goods"
            rows={2}
            className="resize-none text-[13px] leading-relaxed"
            maxLength={500}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {description.length}/500, suggestions are AI-generated
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={description.trim().length < 3 || classify.isPending}
            >
              {classify.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles aria-hidden />}
              Classify
            </Button>
          </div>
        </form>

        {/* Results */}
        {classify.data && !classify.isPending && (
          <div className="mt-4">
            <HtsSuggestions result={classify.data} onPick={copyCode} pickLabel="Copy" onRetry={retry} />
          </div>
        )}
        {classify.isError && (
          <p role="alert" className="mt-4 rounded-lg bg-urgent-tint px-3.5 py-2.5 text-[12.5px] text-urgent">
            {(classify.error as any)?.body?.error ?? 'HTS suggestions are temporarily unavailable. Please try again in a moment.'}
          </p>
        )}
      </div>
    </section>
  );
}

// ─── ADD/CVD Lookup ─────────────────────────────────────────────────

function AddCvdLookupCard() {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q.trim(), 300);
  const [data, setData] = useState<AddCvdLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (debounced.length < 2) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    complianceApi.addCvdLookup(debounced).then((r) => {
      if (!cancelled) { setData(r); setLoading(false); }
    }).catch(() => { if (!cancelled) { setData(null); setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <section aria-labelledby="addcvd-title" className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 id="addcvd-title" className="text-[14px] font-semibold">ADD/CVD lookup</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Search active Commerce anti-dumping and countervailing orders by HTS, country, or product.
        </p>
      </div>

      <div className="border-t border-border/70 p-5">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="HTS, country (e.g. CN), or product"
          aria-label="Search ADD/CVD orders"
          className="text-[13px]"
        />

        <div className="mt-3 min-h-[160px]" aria-live="polite">
          {debounced.length < 2 ? (
            <EmptyHint message="Type to search Commerce ADD/CVD orders" />
          ) : loading ? (
            <Spinner />
          ) : failed ? (
            <LookupFailed />
          ) : !data?.matched ? (
            <div className="rounded-lg bg-muted/50 px-3.5 py-3">
              <p className="text-[13px] font-medium">No matching orders in our table.</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Our table covers about 20 common orders; Commerce maintains about 600. Verify on the ACE export for full coverage.
              </p>
            </div>
          ) : (
            <ul className="max-h-[280px] divide-y divide-border/60 overflow-y-auto">
              {data!.orders.map((o, i) => (
                <li key={i} className="py-2.5 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(PILL, TINT.urgent)}>{o.type}</span>
                    <span className="font-mono text-[12.5px] font-medium">{o.case}</span>
                    <span className="font-mono text-[12px] text-muted-foreground">{o.country}</span>
                  </div>
                  <p className="mt-1 text-[13px] font-medium">{o.product}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    HTS <span className="font-mono">{o.htsPrefixes.join(', ')}</span>
                  </p>
                  {o.note && <p className="mt-1 text-[12px] text-muted-foreground">{o.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── FTA Preference ─────────────────────────────────────────────────

function FtaPreferenceCard() {
  const [country, setCountry] = useState('');
  const normalized = country.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
  const [data, setData] = useState<FtaPreferenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (normalized.length !== 2) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    complianceApi.ftaPreference(normalized).then((r) => {
      if (!cancelled) { setData(r); setLoading(false); }
    }).catch(() => { if (!cancelled) { setData(null); setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [normalized]);

  return (
    <section aria-labelledby="fta-title" className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 id="fta-title" className="text-[14px] font-semibold">FTA preference programs</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Enter an ISO-2 country code to see free trade agreements that include it.
        </p>
      </div>

      <div className="border-t border-border/70 p-5">
        <Input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="ISO-2 (e.g. MX, IN, KR)"
          aria-label="Country code"
          className="max-w-[160px] font-mono text-[13px] uppercase placeholder:font-sans placeholder:normal-case"
          maxLength={2}
        />

        <div className="mt-3 min-h-[160px]" aria-live="polite">
          {normalized.length !== 2 ? (
            <EmptyHint message="Type a 2-letter country code" />
          ) : loading ? (
            <Spinner />
          ) : failed ? (
            <LookupFailed />
          ) : !data?.matched ? (
            <div className="rounded-lg bg-muted/50 px-3.5 py-3">
              <p className="text-[13px] font-medium">
                No FTA program includes <span className="font-mono">{normalized}</span>.
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Goods from this country pay standard MFN rates unless covered by a unilateral preference (e.g. GSP). Check current GSP renewal status with USTR.
              </p>
            </div>
          ) : (
            <ul className="max-h-[280px] divide-y divide-border/60 overflow-y-auto">
              {data!.programs.map((p, i) => (
                <li key={i} className="py-2.5 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold">{p.key}</span>
                        <span className={cn(PILL, TINT.calm)}>
                          Claim code <span className="font-mono">{p.claimCode}</span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{p.fullName}</p>
                    </div>
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-sm text-[12.5px] font-medium text-foreground underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:underline"
                    >
                      USTR <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{p.covers}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function EmptyHint({ message }: { message: string }) {
  return (
    <p className="pt-12 text-center text-[12.5px] text-muted-foreground">{message}</p>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center pt-12">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Loading" />
    </div>
  );
}

function LookupFailed() {
  return (
    <p role="alert" className="rounded-lg bg-urgent-tint px-3.5 py-2.5 text-[12.5px] text-urgent">
      The lookup could not load. Change the search or try again in a moment.
    </p>
  );
}

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
