/**
 * The estimate: the total in one sentence, the figures behind it, then each
 * line with the added tariffs that apply to it. In AI mode, how each line
 * was classified follows.
 */
import { Calculator } from '@/components/icons';
import { BAND, FILL, TINT, type Tone } from '@/components/dashboard/tones';
import type { DutyCalcAIResponse, DutyCalcItemResult, DutyCalcResponse } from '@/api/client';
import { cn } from '@/lib/utils';

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const TH = 'px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground';
const NUM = 'px-4 py-2.5 text-right tabular-nums';

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

function Lines({ items, currency }: { items: DutyCalcItemResult[]; currency: string }) {
  return (
    <div className="overflow-x-auto border-t border-border/70">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="border-b border-border/70">
            <th scope="col" className={TH}>Line</th>
            <th scope="col" className={cn(TH, 'text-right')}>Dutiable value</th>
            <th scope="col" className={cn(TH, 'text-right')}>Base duty</th>
            <th scope="col" className={cn(TH, 'text-right')}>Added tariffs</th>
            <th scope="col" className={cn(TH, 'text-right')}>User fee</th>
            <th scope="col" className={cn(TH, 'text-right')}>Line total</th>
          </tr>
        </thead>
        {items.map((r, i) => (
          <tbody key={i} className="border-b border-border/60 last:border-b-0">
            <tr>
              <th scope="row" className="px-4 py-2.5 text-left font-normal">
                <span className="flex items-baseline gap-2">
                  <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="font-mono font-medium">{r.classification?.hts}</span>
                </span>
                <span className="block pl-[18px] text-[12.5px] text-muted-foreground">{r.classification?.name || r.description}</span>
              </th>
              <td className={NUM}>{money(r.totalDutiable, currency)}</td>
              <td className={NUM}>{money(r.duty, currency)}</td>
              <td className={NUM}>{money(r.subheadingDuties, currency)}</td>
              <td className={NUM}>{money(feeOf(r), currency)}</td>
              <td className={cn(NUM, 'font-semibold')}>{money(lineTotal(r), currency)}</td>
            </tr>
            {(r.subheadings ?? []).map((s, j) => {
              const section = s.section ? family(s.section) : null;
              const excepted = s.kind === 'EXCEPTION';
              return (
                <tr key={j} className="text-[12.5px] text-muted-foreground">
                  <td colSpan={3} className="py-1.5 pl-[34px] pr-4">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-foreground/80">{s.hts}</span>
                      {section && <span className={cn('rounded-full px-2 py-px text-[11.5px] font-medium', TINT[section.tone])}>{section.label}</span>}
                      <span className="min-w-0">{s.program || s.name}</span>
                      {excepted ? <span>Does not apply</span> : s.dutyPercentage ? <span className="tabular-nums">{s.dutyPercentage}%</span> : null}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-foreground/80">{excepted ? '' : money(s.duty, currency)}</td>
                  <td colSpan={2} />
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
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
        <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4', BAND.info)}>
          <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-white dark:text-background', FILL.info)}>
            <Calculator weight="duotone" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-[16px] font-semibold leading-6">Estimated duties and fees: <span className="tabular-nums">{money(total, currency)}</span></p>
            <p className="mt-0.5 text-[13px] text-foreground/75">
              {rate !== undefined && Number.isFinite(rate) && <>Duties are {rate.toFixed(2)}% of the dutiable value. </>}
              An estimate to plan with. CBP sets the amount owed when the entry is filed.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
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
