import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw, Plane } from '@/components/icons';
import { complianceApi } from '@/api/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { BAND, FILL } from '@/components/dashboard/tones';
import { cn } from '@/lib/utils';

/**
 * AI Coach drawer — slides in from the right, streams a GPT-4o response.
 *
 * Two modes:
 *   • mode="rejection"    — explains why CBP rejected a filing + fix steps.
 *                           Source: /compliance/rejection-coach
 *   • mode="draft-review" — pre-flight review of an in-flight filing
 *                           (draft / submitted / on-hold) — surfaces
 *                           rule-based issues + UFLPA/PGA risks + AI
 *                           suggestions. Source: /compliance/draft-review
 *
 * Same SSE protocol on both; same render path. Only the header copy and
 * the API method differ.
 */

type CoachMode = 'rejection' | 'draft-review';

interface CoachConfig {
  eyebrow: string;
  title:   string;
  description: string;
  fetch:   (filingId: string) => AsyncGenerator<string, void, void>;
  loadingText: string;
  HeroIcon: typeof Sparkles;
}

const CONFIGS: Record<CoachMode, CoachConfig> = {
  'rejection': {
    eyebrow:     'AI compliance coach',
    title:       'What went wrong and how to fix it',
    description: "Plain-English explanation of CBP's rejection, with numbered next steps. AI-generated from the filing's data. No copies are stored by the AI provider.",
    fetch:       (id) => complianceApi.rejectionCoach(id),
    loadingText: 'Analysing rejection…',
    HeroIcon:    Sparkles,
  },
  'draft-review': {
    eyebrow:     'AI pre-flight review',
    title:       'Is this filing ready to send?',
    description: 'Checks every field, plus UFLPA and PGA risks, and lists what to fix before you send. Combines rule-based checks with AI judgment.',
    fetch:       (id) => complianceApi.draftReview(id),
    loadingText: 'Reviewing draft…',
    HeroIcon:    Plane,
  },
};

export function RejectionCoachDrawer({
  open,
  onOpenChange,
  filingId,
  mode = 'rejection',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filingId: string | null;
  mode?: CoachMode;
}) {
  const cfg = CONFIGS[mode];
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  // Each run gets a number; a run that is no longer the latest stops writing.
  const runRef = useRef(0);

  useEffect(() => {
    if (!open || !filingId) return;
    const run = ++runRef.current;
    setText('');
    setError(null);
    setStreaming(true);

    (async () => {
      try {
        for await (const chunk of cfg.fetch(filingId)) {
          if (runRef.current !== run) return;
          setText((t) => t + chunk);
        }
      } catch (err: any) {
        if (runRef.current !== run) return;
        if (err?.code === 'ai_unavailable') {
          setError('The AI coach is not currently configured for this org.');
        } else if (err?.code === 'ai_rate_limited') {
          setError(err.message || 'Daily AI quota reached. Try again after UTC midnight.');
        } else {
          setError(err?.message || 'AI request failed. Please try again.');
        }
      } finally {
        if (runRef.current === run) setStreaming(false);
      }
    })();

    return () => {
      // A counter, not a DOM node: bumping the live value is what retires this run.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runRef.current++;
    };
  }, [open, filingId, mode, cfg]);

  function regenerate() {
    if (!filingId) return;
    const run = ++runRef.current;
    setText('');
    setError(null);
    setStreaming(true);
    (async () => {
      try {
        for await (const chunk of cfg.fetch(filingId)) {
          if (runRef.current !== run) return;
          setText((t) => t + chunk);
        }
      } catch (err: any) {
        if (runRef.current !== run) return;
        setError(err?.message || 'AI request failed.');
      } finally {
        if (runRef.current === run) setStreaming(false);
      }
    })();
  }

  const HeroIcon = cfg.HeroIcon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden p-0 sm:max-w-md"
      >
        {/* Header */}
        <SheetHeader className="border-b border-border/70 px-6 pb-4 pt-6">
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <HeroIcon className="h-3.5 w-3.5" aria-hidden />
            {cfg.eyebrow}
          </p>
          <SheetTitle className="text-[18px] font-semibold leading-tight text-foreground">
            {cfg.title}
          </SheetTitle>
          <SheetDescription className="mt-1 text-[12.5px] text-muted-foreground">
            {cfg.description}
          </SheetDescription>
        </SheetHeader>

        {/* Streaming body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" aria-live="polite">
          {error ? (
            <div role="alert" className={cn('flex items-center gap-4 rounded-xl px-4 py-4', BAND.urgent)}>
              <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-white dark:text-background', FILL.urgent)}>
                <AlertCircle weight="duotone" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold leading-6">Couldn't generate guidance</p>
                <p className="mt-0.5 text-[13px] text-foreground/75">{error}</p>
              </div>
            </div>
          ) : text.length === 0 && streaming ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                {cfg.loadingText}
              </div>
              <div className="space-y-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-3 animate-pulse rounded bg-muted motion-reduce:animate-none"
                    style={{ width: `${75 - i * 15}%` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <article className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
              {text}
              {streaming && (
                <span aria-hidden className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-muted-foreground align-text-bottom motion-reduce:animate-none" />
              )}
            </article>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-6 py-4">
          <p className="text-[12px] leading-snug text-muted-foreground">
            AI guidance is a hint, not legal advice. Verify against current CBP regulations.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={regenerate}
            disabled={streaming}
            className="shrink-0"
          >
            <RefreshCw className={streaming ? 'animate-spin motion-reduce:animate-none' : undefined} aria-hidden />
            {streaming ? 'Generating…' : 'Regenerate'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
