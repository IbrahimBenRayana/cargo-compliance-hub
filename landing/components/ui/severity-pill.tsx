"use client";

import { cn } from "@/lib/utils";

export type Severity = "rose" | "amber" | "emerald" | "blue" | "neutral";

// Light-mode uses SOLID tint backgrounds (bg-*-100) rather than the
// alpha variant, because axe can't reliably compute contrast through
// alpha channels and reports false-positive fails on our tinted pills
// even at 4.5:1+. Dark-mode keeps the alpha backdrop — dark pages don't
// hit the alpha-contrast heuristic. Text bumped one step darker too.
const TONE: Record<Severity, string> = {
  rose:
    "bg-rose-100 text-rose-900 ring-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300",
  amber:
    "bg-amber-100 text-amber-900 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300",
  emerald:
    "bg-emerald-100 text-emerald-900 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  blue:
    "bg-blue-100 text-blue-900 ring-blue-500/20 dark:bg-blue-500/15 dark:text-blue-300",
  neutral:
    "bg-secondary text-secondary-foreground ring-border/60",
};

type SeverityPillProps = {
  children: React.ReactNode;
  tone?: Severity;
  className?: string;
  /** Slightly larger pill. */
  size?: "sm" | "md";
};

/**
 * Tone-coded pill — used in action queues, lifecycle cards, and the
 * Risk & Watch UFLPA inbox. Mirrors the in-app severity scheme:
 * rose=urgent, amber=warning, blue=informational, emerald=good.
 */
export function SeverityPill({
  children,
  tone = "neutral",
  size = "sm",
  className,
}: SeverityPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold ring-1 tabular-nums",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
