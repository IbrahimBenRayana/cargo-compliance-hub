import * as React from "react";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 select-none",
        className
      )}
      aria-label="MyCargoLens"
    >
      {/* "Focus Frame" mark — four corner brackets lock a single gold
          subject square in the center. The frame color is driven by the
          --logo-frame CSS variable (navy in light mode, light-grey in
          dark), defined per-theme in globals.css — so it flips with the
          theme without arbitrary Tailwind dark: variants (no FOUC). The
          subject square is the only gold and stays fixed. */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 100 100"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        style={{ color: "hsl(var(--logo-frame))" }}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="6.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M 26 40 L 26 26 L 40 26" />
          <path d="M 60 26 L 74 26 L 74 40" />
          <path d="M 74 60 L 74 74 L 60 74" />
          <path d="M 40 74 L 26 74 L 26 60" />
        </g>
        <rect x="42" y="42" width="16" height="16" rx="4.6" fill="hsl(43 96% 56%)" />
      </svg>

      {/* Wordmark text. "MyCargo" uses the theme --foreground token; "Lens"
          uses --logo-lens (dark-gold in light mode, bright gold in dark) —
          both CSS-variable-driven so they auto-flip without FOUC. */}
      <span
        style={{
          fontFamily: "'Inter', ui-sans-serif, sans-serif",
          fontSize: "17px",
          fontWeight: 700,
          letterSpacing: "-0.025em",
          lineHeight: 1,
        }}
      >
        <span className="text-foreground">MyCargo</span>
        <span style={{ color: "hsl(var(--logo-lens))" }}>Lens</span>
      </span>
    </span>
  );
}
