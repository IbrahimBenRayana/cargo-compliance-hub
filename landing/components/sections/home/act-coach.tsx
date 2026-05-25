"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, Sparkles, Sun } from "lucide-react";
import { SectionShell } from "@/components/sections/section-shell";
import { CodeStream } from "@/components/ui/code-stream";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

const AI_RESPONSE = `CBP rejected because the manufacturer party is missing a tax ID.

Three fixes, in order:
  1. Open INV-4421 → Parties → Manufacturer
  2. Add the tax ID (DUNS, MID, or foreign ID accepted for ISF-10)
  3. Re-submit — the bond and other parties carry over

Pre-flight on this filing would have caught it. Want me to enable
auto pre-flight on your next 5 drafts?`;

type SubFeature = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const SUB_FEATURES: SubFeature[] = [
  { label: "Rejection mode", Icon: Bot },
  { label: "Pre-flight mode", Icon: Sparkles },
  { label: "Today's brief", Icon: Sun },
];

export function ActCoach() {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.2 });
  const reduceMotion = useReducedMotion();
  const [streamDone, setStreamDone] = React.useState(false);

  const handleComplete = React.useCallback(() => {
    setStreamDone(true);
  }, []);

  // When reduced motion is on, the CodeStream component skips its onComplete,
  // so reveal the sub-features immediately on view.
  const showPills = reduceMotion ? inView : streamDone;

  return (
    <SectionShell
      tone="muted"
      headingAlign="center"
      className="pb-32 md:pb-40"
      eyebrow="AI Coach"
      title="Plain English explains every CBP rejection."
      intro="Built on gpt-4o, gated by your team's enable flag. Rejection mode reads the CBP error code, your filing, and your party data — then streams numbered fix steps. Pre-flight mode does the same before you submit."
    >
      <div ref={rootRef} className="mx-auto max-w-2xl">
        {/* Chat-replica card */}
        <div className="relative rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-card-hover p-5 sm:p-6">
          {/* User bubble */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.5, ease: EASE_OUT_QUART, delay: 0 }}
            className="flex justify-end"
          >
            <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-[hsl(43_96%_56%/0.18)] to-[hsl(43_96%_56%/0.08)] ring-1 ring-[hsl(43_96%_56%/0.25)] px-4 py-2.5 text-sm text-foreground">
              Why was INV-4421 rejected?
            </div>
          </motion.div>

          {/* AI response */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.5, ease: EASE_OUT_QUART, delay: 0.5 }}
            className="mt-4 flex items-start gap-3"
          >
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 ring-1 ring-border/60">
              <Bot className="size-4 text-foreground/70" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="font-semibold">AI Coach</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">streaming</span>
              </div>
              <CodeStream
                variant="chat"
                replayOnView
                speed={12}
                startDelay={reduceMotion ? 0 : 1000}
                text={AI_RESPONSE}
                onComplete={handleComplete}
                ariaLabel="AI Coach response streaming"
                className="min-h-[240px]"
              />
            </div>
          </motion.div>
        </div>

        {/* Sub-feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={showPills ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.5, ease: EASE_OUT_QUART }}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
          aria-hidden={!showPills}
        >
          {SUB_FEATURES.map(({ label, Icon }) => (
            <span
              key={label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground",
                "shadow-card",
              )}
            >
              <Icon className="size-3.5 text-foreground/60" aria-hidden />
              {label}
            </span>
          ))}
        </motion.div>

        {/* Inline ghost CTA */}
        <div className="mt-8 flex items-center justify-center">
          <Link
            href="/platform/ai"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            See the AI page
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

      </div>
    </SectionShell>
  );
}
