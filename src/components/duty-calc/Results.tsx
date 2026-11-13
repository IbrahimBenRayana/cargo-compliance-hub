/**
 * The estimate, beside the form: the total, the figures behind it, then each
 * line with the added tariffs that apply to it. In AI mode, how each line
 * was classified follows.
 */
import { Calculator } from '@/components/icons';
import { BAND, TINT, type Tone } from '@/components/dashboard/tones';
import type { DutyCalcAIResponse, DutyCalcItemResult, DutyCalcResponse } from '@/api/client';
import { cn } from '@/lib/utils';

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';

/** The tariff family a Chapter 99 line belongs to, from the answer's section key. */
function family(section: string): { label: string; tone: Tone } {
  if (section.startsWith('section301')) return { label: 'Section 301', tone: 'soon' };
  if (section.startsWith('reciprocal')) return { label: 'Reciprocal', tone: 'entry' };
  if (section.startsWith('fentanyl')) return { label: 'IEEPA', tone: 'urgent' };
  return { label: 'Section 232', tone: 'calm' };
}

const feeOf = (r: DutyCalcItemResult) => (typeof r.userFee === 'number' ? r.userFee : r.userFee?.total) || 0;

function money(n: number | undefined | null, currency: string): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

const lineTotal = (r: DutyCalcItemResult) => (r.duty || 0) + (r.subheadingDuties || 0) + feeOf(r) + (r.irTax || 0) + (r.adcvdAmount || 0);

/** A figure from the answer; absent or zero ones are left out rather than shown empty. */
function Fact({ label, amount, currency }: { label: string; amount: number | undefined | null; currency: string }) {
  if (!amount) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[14px] font-medium tabular-nums">{money(amount, currency)}</dd>
    </div>
  );
}

/** "Section 301 - China (Four-Year Review)" beside a "Section 301" pill would say it twice. */
const programText = (program: string | undefined, name: string) => (program ? program.replace(/^[^-]+ - /, '') : name);

function Lines({ items, currency }: { items: DutyCalcItemResult[]; currency: string }) {
  return (
    <ol className="divide-y divide-border/60 border-t border-border/70">
      {items.map((r, i) => (
        <li key={i} className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-baseline gap-2 text-[13px]">
                <span className="text-muted-foreground">Line {i + 1}</span>
                <span className="font-mono text-[14px] font-semibold">{r.classification?.hts}</span>
              </p>
              <p className="text-[12.5px] text-muted-foreground">{r.classification?.name || r.description}</p>
            </div>
            <p className="shrink-0 text-right">
              <span className="block text-[12px] text-muted-foreground">Line total</span>
              <span className="text-[15px] font-semibold tabular-nums">{money(lineTotal(r), currency)}</span>
            </p>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
            {[['Dutiable value', r.totalDutiable], ['Base duty', r.duty], ['Added tariffs', r.subheadingDuties], ['User fee', feeOf(r)]].map(([label, amount]) => (
              <div key={label as string}>
                <dt className="text-[12px] text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">{money((amount as number) || 0, currency)}</dd>
              </div>
            ))}
          </dl>
          {(r.subheadings ?? []).length > 0 && (
            <ul className="mt-3 space-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5">
              {r.subheadings.map((s, j) => {
                const section = s.section ? family(s.section) : null;
                const excepted = s.kind === 'EXCEPTION';
                return (
                  <li key={j} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-mono">{s.hts}</span>
                      {section && <span className={cn('rounded-full px-2 py-px text-[11.5px] font-medium', TINT[section.tone])}>{section.label}</span>}
                      <span className="min-w-0 text-muted-foreground">{programText(s.program, s.name)}</span>
                      {!excepted && s.dutyPercentage ? <span className="tabular-nums text-muted-foreground">{s.dutyPercentage}%</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums">{excepted ? <span className="text-muted-foreground">Does not apply</span> : money(s.duty, currency)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

function Classification({ data }: { data: DutyCalcAIResponse }) {
  return (
    <section aria-labelledby="classified-title" className={PANEL}>
      <h2 id="classified-title" className="px-5 py-3.5 text-[14px] font-semibold">How each line was classified</h2>
      <ul className="divide-y divide-border/60 border-t border-border/70">
        {data.aiRecommendations.map((rec) => {
          const others = (rec.recommendations ?? []).slice(1, 5);
          return (
            <li key={rec.itemIndex} className="px-5 py-4">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="text-muted-foreground tabular-nums">Line {rec.itemIndex + 1}</span>
                <span className="font-mono text-[14px] font-semibold">{rec.selectedHts}</span>
                <span className="min-w-0 text-muted-foreground">for "{rec.originalDescription}"</span>
              </p>
              {rec.explanation && <p className="mt-1.5 max-w-[75ch] text-[13px]">{rec.explanation}</p>}
              {rec.specializedExplanation && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground">Reasoning under the rules of interpretation</summary>
                  <p className="mt-1.5 max-w-[75ch] whitespace-pre-wrap text-[13px] text-foreground/80">{rec.specializedExplanation}</p>
                </details>
              )}
              {others.length > 0 && (
                <div className="mt-3">
                  <p className="text-[12px] text-muted-foreground">Other codes considered</p>
                  <ul className="mt-1 space-y-1">
                    {others.map((alt, i) => (
                      <li key={i} className="flex gap-3 text-[13px]">
                        <span className="shrink-0 font-mono">{alt.hts}</span>
                        <span className="min-w-0 text-muted-foreground">{alt.naturalized_description || alt.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Results({ result }: { result: DutyCalcResponse | DutyCalcAIResponse }) {
  const summary = result.summary ?? ({} as DutyCalcResponse['summary']);
  const currency = result.currency || 'USD';
  const items = result.items ?? [];

  const lineSum = items.reduce((sum, it) => sum + (it.duty || 0) + (it.subheadingDuties || 0), 0);
  // `summary.totalDutiesTaxes` can be 0 when duties exist, so it comes after the others.
  const duties = result.dutiesBreakdown?.totalDuties || summary.totalDuties || summary.totalDutiesTaxes || lineSum;
  const userFees = summary.totalUserFee ?? result.dutiesBreakdown?.totalUserFee ?? items.reduce((sum, it) => sum + feeOf(it), 0);
  const total = summary.totalDutiesFees || duties + userFees;
  const rate = summary.totalDutyPercentage ?? (summary.totalDutiableValue ? (duties / summary.totalDutiableValue) * 100 : undefined);
  const ai = 'aiRecommendations' in result && result.aiRecommendations?.length ? result : null;

  return (
    <>
      <section aria-label="Estimate" className={PANEL}>
        <div className={cn('px-5 py-5', BAND.info)}>
          <p className="flex items-center gap-2 text-[13px] font-medium text-info">
            <Calculator weight="duotone" className="h-4 w-4" aria-hidden />Estimated duties and fees
          </p>
          <p className="mt-1 text-[32px] font-semibold leading-10 tracking-[-0.02em] tabular-nums">{money(total, currency)}</p>
          <p className="mt-1 text-[13px] text-foreground/75">
            {rate !== undefined && Number.isFinite(rate) && <>Duties are {rate.toFixed(2)}% of the dutiable value. </>}
            An estimate to plan with. CBP sets the amount owed when the entry is filed.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3">
          <Fact label="Goods value" amount={summary.totalValue} currency={currency} />
          <Fact label="Dutiable value" amount={summary.totalDutiableValue} currency={currency} />
          <Fact label="Duties" amount={duties} currency={currency} />
          <Fact label="User fees" amount={userFees} currency={currency} />
          <Fact label="Entry processing fee" amount={result.entryFee?.entryProcessingFee} currency={currency} />
          <Fact label="Port processing fee" amount={result.entryFee?.portProcessingFee} currency={currency} />
          <Fact label="Landed cost (DDP)" amount={summary.ddp} currency={currency} />
        </dl>
        {items.length > 0 && <Lines items={items} currency={currency} />}
      </section>
      {ai && <Classification data={ai} />}
    </>
  );
}

/** Before the first calculation: what will show here, so the column is not a blank. */
export function ResultsPlaceholder({ mode }: { mode: 'standard' | 'ai' }) {
  const rows = [
    'Total duties and fees, and the rate they come to',
    'Each line with its base duty and user fee',
    'Every added tariff that applies: Section 301, Section 232, IEEPA, reciprocal',
    ...(mode === 'ai' ? ['The HTS code chosen for each line, and why'] : []),
  ];
  return (
    <section aria-label="Estimate" className={cn(PANEL, 'px-5 py-5')}>
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Calculator weight="duotone" className="h-4 w-4" aria-hidden />Estimated duties and fees
      </p>
      <p className="mt-1 text-[32px] font-semibold leading-10 tracking-[-0.02em] text-muted-foreground/50" aria-hidden>$0.00</p>
      <p className="mt-1 text-[13px] text-muted-foreground">Fill in the shipment and at least one line, then calculate. You will get:</p>
      <ul className="mt-3 space-y-1.5 text-[13px]">
        {rows.map((r) => (
          <li key={r} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />{r}</li>
        ))}
      </ul>
    </section>
  );
}
