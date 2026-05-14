import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { complianceApi } from '@/api/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

/**
 * AI Rejection Coach — slides in from the right, streams a plain-English
 * explanation + numbered fix steps for the rejected filing.
 *
 * Reads the response chunk-by-chunk via the SSE generator on
 * complianceApi.rejectionCoach. Renders progressively so the user sees
 * tokens land as they're written — same UX pattern as ChatGPT/Claude/etc.
 */
export function RejectionCoachDrawer({
  open,
  onOpenChange,
  filingId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filingId: string | null;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!open || !filingId) return;
    abortRef.current = false;
    setText('');
    setError(null);
    setStreaming(true);

    (async () => {
      try {
        for await (const chunk of complianceApi.rejectionCoach(filingId)) {
          if (abortRef.current) return;
          setText((t) => t + chunk);
        }
      } catch (err: any) {
        if (err?.code === 'ai_unavailable') {
          setError('The AI coach is not currently configured for this org.');
        } else if (err?.code === 'ai_rate_limited') {
          setError(err.message || 'Daily AI quota reached. Try again after UTC midnight.');
        } else {
          setError(err?.message || 'AI request failed. Please try again.');
        }
      } finally {
        if (!abortRef.current) setStreaming(false);
      }
    })();

    return () => {
      abortRef.current = true;
    };
  }, [open, filingId]);

  function regenerate() {
    if (!filingId) return;
    abortRef.current = true;
    // Re-run by toggling state cheaply.
    setText('');
    setError(null);
    setStreaming(true);
    abortRef.current = false;
    (async () => {
      try {
        for await (const chunk of complianceApi.rejectionCoach(filingId)) {
          if (abortRef.current) return;
          setText((t) => t + chunk);
        }
      } catch (err: any) {
        setError(err?.message || 'AI request failed.');
      } finally {
        if (!abortRef.current) setStreaming(false);
      }
    })();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-amber-50/60 to-transparent dark:from-amber-400/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-amber-950" strokeWidth={2.5} />
            </div>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400">
              AI Compliance Coach
            </span>
          </div>
          <SheetTitle className="text-[18px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
            What went wrong + how to fix it
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-slate-600 dark:text-slate-400 mt-1">
            Plain-English explanation of CBP's rejection, with numbered next steps. Generated from the filing's data — no copies are stored by the AI provider.
          </SheetDescription>
        </SheetHeader>

        {/* Streaming body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">
                  Couldn't generate guidance
                </span>
              </div>
              <p className="text-[12.5px] text-rose-700/80 dark:text-rose-300/80">{error}</p>
            </div>
          ) : text.length === 0 && streaming ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12.5px] text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analysing rejection…
              </div>
              <div className="space-y-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"
                    style={{ width: `${75 - i * 15}%` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <div className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {text}
                {streaming && (
                  <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-amber-500 animate-pulse rounded-sm align-text-bottom" />
                )}
              </div>
            </article>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <p className="text-[10.5px] text-slate-400 dark:text-slate-500 leading-snug">
            AI guidance is a hint, not legal advice. Verify against current CBP regulations.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={regenerate}
            disabled={streaming}
            className="gap-1.5 shrink-0"
          >
            <RefreshCw className={`h-3 w-3 ${streaming ? 'animate-spin' : ''}`} />
            {streaming ? 'Generating…' : 'Regenerate'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
