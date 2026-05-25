"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export type DonutTone = "rose" | "amber" | "emerald" | "gold" | "neutral";

const TONE_STROKE: Record<DonutTone, string> = {
  rose: "stroke-rose-500",
  amber: "stroke-amber-500",
  emerald: "stroke-emerald-500",
  gold: "stroke-[hsl(43_96%_56%)]",
  neutral: "stroke-foreground/70",
};

type DonutProps = {
  /** Compliance score (0-100). */
  value: number;
  /** Stroke tone — drives the donut color. */
  tone?: DonutTone;
  /** Pixel size of the SVG (square). Default 36. */
  size?: number;
  /** Stroke width in viewbox units (square viewbox 0 0 36 36). Default 3. */
  strokeWidth?: number;
  /** Delay before the arc draws (ms or sec depending on Framer). */
  delay?: number;
  /** Show the numeric label centered inside the donut. */
  showLabel?: boolean;
  className?: string;
  ariaLabel?: string;
};

/**
 * Animated compliance-score donut. Extracted from HeroActionCard so it can be
 * reused on the Compliance Center deep-dive and Pricing pages.
 */
export function Donut({
  value,
  tone = "gold",
  size = 36,
  strokeWidth = 3,
  delay = 0.6,
  showLabel = false,
  className,
  ariaLabel,
}: DonutProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-foreground/10"
        />
        <motion.circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={TONE_STROKE[tone]}
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDasharray: c, strokeDashoffset: offset }}
          transition={{ duration: 1.1, delay, ease: EASE_OUT_EXPO }}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums text-foreground"
          aria-hidden
        >
          {Math.round(clamped)}
        </span>
      )}
    </span>
  );
}
