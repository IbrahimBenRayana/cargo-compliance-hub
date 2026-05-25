"use client";

import { cn } from "@/lib/utils";

export type Severity = "rose" | "amber" | "emerald" | "blue" | "neutral";

const TONE: Record<Severity, string> = {
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-300 ring-rose-500/20",
  amber:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/20",
  emerald:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/20",
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
