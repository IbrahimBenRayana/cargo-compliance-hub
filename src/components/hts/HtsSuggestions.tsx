/**
 * Results of the native HTS classifier, shared by the ISF wizard's wand and
 * the Compliance > Classification card. A wrong code means wrong duty, so the
 * confidence, the duty rate and every warning are shown, not just the code.
 */
import { AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatHtsCode } from '@/lib/htsFormat';
import type { HtsClassifyResult, HtsConfidence, HtsSuggestion, HtsUsage } from '@/types/htsClassify';


// Labels say what the engine actually knows, not a promise: only the top pick
// is checked twice, and no AI can guarantee a classification.
const CONFIDENCE: Record<HtsConfidence, { label: string; cls: string }> = {
  high: { label: 'Two independent checks agree', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30' },
  medium: { label: 'Review before you file', cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30' },
  low: { label: 'Checks disagree: check carefully', cls: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30' },
};

/** Last two levels in full, the rest as context. */
function PathText({ path }: { path: string }) {
  const parts = path.split(' > ');
  const head = parts.slice(0, -2).join(' › ');
  const tail = parts.slice(-2).join(' › ');
  return (
    <p className="text-[12px] leading-snug text-slate-600 dark:text-slate-300">
      {head && <span className="text-slate-500 dark:text-slate-400">{head} › </span>}
      <span className="text-slate-800 dark:text-slate-100">{tail}</span>
    </p>
  );
}

const ALTERNATIVE = { label: 'Alternative', cls: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700' };

function SuggestionRow({ s, rank, onPick, pickLabel }: { s: HtsSuggestion; rank: number; onPick?: (code: string) => void; pickLabel: string }) {
  const conf = rank > 0 ? (s.confidence ? ALTERNATIVE : null) : s.confidence ? CONFIDENCE[s.confidence] : null;
  return (
    <li className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[13.5px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{formatHtsCode(s.code)}</span>
        {conf && <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', conf.cls)}>{conf.label}</span>}
        <span className="text-[11.5px] text-slate-600 dark:text-slate-300">Duty: <strong className="font-semibold">{s.generalRate || 'n/a'}</strong></span>
        {onPick && (
          <button
            type="button"
            onClick={() => onPick(s.code)}
            className="ml-auto rounded-md border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11.5px] font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {pickLabel}
          </button>
        )}
      </div>
      <PathText path={s.description} />
      {s.reason && <p className="text-[11.5px] leading-snug text-slate-600 dark:text-slate-400">{s.reason}</p>}
      {s.warnings?.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-rose-700 dark:text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />{w}
        </p>
      ))}
    </li>
  );
}

const left = (u: { used: number; limit: number }) => Math.max(0, u.limit - u.used);

function UsageLine({ usage }: { usage: HtsUsage }) {
  return (
    <span className="tabular-nums">
      {left(usage.user)} of {usage.user.limit} classifications left today · {left(usage.organization)} of {usage.organization.limit} left this month for your organization.
    </span>
  );
}

export function HtsSuggestions({
  result, onPick, pickLabel = 'Use', onRetry,
}: {
  result: HtsClassifyResult;
  onPick?: (code: string) => void;
  pickLabel?: string;
  /** Re-run with a more specific description (a "did you mean" chip). */
  onRetry: (description: string) => void;
}) {
  const needsDetail = result.status === 'needs_detail' || result.status === 'no_match';
  return (
    <div className="space-y-3" aria-live="polite">
      {result.message && (
        <div className={cn(
          'flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-snug',
          needsDetail || result.status === 'keyword_only'
            ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
        )}>
          <Info className="h-4 w-4 mt-px shrink-0" aria-hidden />
          <span>{result.message}</span>
        </div>
      )}

      {result.didYouMean && result.didYouMean.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-400 mb-1.5">Did you mean</p>
          <div className="flex flex-wrap gap-1.5">
            {result.didYouMean.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onRetry(d)}
                className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-left text-[12px] text-slate-800 dark:text-slate-100 hover:border-primary hover:text-primary"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {result.questions && result.questions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-400 mb-1">Answer these to be sure</p>
          <ul className="space-y-1">
            {result.questions.map((q) => (
              <li key={q} className="flex items-start gap-1.5 text-[12.5px] text-slate-700 dark:text-slate-300">
                <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden />{q}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11.5px] text-slate-600 dark:text-slate-400">Add the answers to your description and search again.</p>
        </div>
      )}

      {result.dutySpreadWarning && (
        <p className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4 mt-px shrink-0" aria-hidden />{result.dutySpreadWarning}
        </p>
      )}

      {result.suggestions.length > 0 && (
        <ul className="space-y-2">
          {result.suggestions.map((s, i) => <SuggestionRow key={s.code} s={s} rank={i} onPick={onPick} pickLabel={pickLabel} />)}
        </ul>
      )}

      {result.suggestions.length > 0 && (
        <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">
          {result.dutyNote} {result.notice} HTS edition {result.revision}.
        </p>
      )}

      {(result.repeat || result.usage) && (
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {result.repeat && 'The same description was classified in the last 24 hours, so this is that result; it did not use your allowance. '}
          {result.usage && <UsageLine usage={result.usage} />}
        </p>
      )}
    </div>
  );
}
