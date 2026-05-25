"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type CodeStreamProps = {
  /** The full text to type out. Newlines preserved. */
  text: string;
  /** ms per character. Default 14. */
  speed?: number;
  /** Delay before typing starts (ms). */
  startDelay?: number;
  /** When true, restart typing every time the element re-enters the viewport. */
  replayOnView?: boolean;
  /** Visual style — default looks like a dark terminal; "light" looks like a chat bubble. */
  variant?: "terminal" | "chat";
  className?: string;
  /** Aria label for the live region. Defaults to "AI response streaming". */
  ariaLabel?: string;
  /** Optional callback fired once typing completes. */
  onComplete?: () => void;
};

/**
 * SSE-style typewriter reveal. Used by the home COACH act and the
 * /platform/ai page to mimic the gpt-4o stream returned by the AI Coach
 * (rejection mode + pre-flight mode). When prefers-reduced-motion is set,
 * the full text appears instantly with no caret animation.
 */
export function CodeStream({
  text,
  speed = 14,
  startDelay = 0,
  replayOnView = false,
  variant = "terminal",
  className,
  ariaLabel = "AI response streaming",
  onComplete,
}: CodeStreamProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: !replayOnView, amount: 0.4 });
  const rawReduce = useReducedMotion();
  // SSR-safe gate: don't apply the reduce-motion branch during the first
  // client render, so server HTML and client HTML always match. We flip
  // after mount in the effect below.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const reduceMotion = mounted ? rawReduce : false;

  const [shown, setShown] = React.useState("");
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (reduceMotion) {
      setShown(text);
      setDone(true);
      return;
    }
    if (!inView) {
      if (replayOnView) {
        setShown("");
        setDone(false);
      }
      return;
    }

    let cancelled = false;
    let i = 0;
    setShown("");
    setDone(false);

    const startTimer = window.setTimeout(() => {
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setShown(text.slice(0, i));
        if (i < text.length) {
          window.setTimeout(tick, speed);
        } else {
          setDone(true);
          onComplete?.();
        }
      };
      tick();
    }, startDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [inView, replayOnView, reduceMotion, text, speed, startDelay, onComplete]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel}
      aria-live="polite"
      className={cn(
        "relative whitespace-pre-wrap font-mono text-sm leading-relaxed",
        variant === "terminal"
          ? "bg-[hsl(222_47%_6%)] text-emerald-200/95 px-5 py-4 rounded-xl border border-foreground/10 shadow-card-hover"
          : "bg-card text-foreground px-5 py-4 rounded-2xl border border-border/60 shadow-card",
        className,
      )}
    >
      <span>{shown}</span>
      {!done && !reduceMotion && (
        <motion.span
          aria-hidden
          className={cn(
            "inline-block align-baseline ml-0.5 w-[0.5ch] h-[1em]",
            variant === "terminal" ? "bg-emerald-300/80" : "bg-foreground/60",
          )}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
