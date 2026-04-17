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
      {/* Geometric mark: stacked navy + gold chevrons */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Navy chevron (top) */}
        <path
          d="M4 9L14 4L24 9"
          stroke="hsl(222 47% 22%)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-[hsl(210_40%_80%)]"
        />
        {/* Gold chevron (middle) */}
        <path
          d="M4 14.5L14 9.5L24 14.5"
          stroke="hsl(43 96% 56%)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Navy chevron (bottom, lighter) */}
        <path
          d="M4 20L14 15L24 20"
          stroke="hsl(222 47% 22%)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.35"
          className="dark:stroke-[hsl(210_40%_80%)]"
        />
        {/* Gold accent dot */}
        <circle cx="14" cy="24.5" r="1.75" fill="hsl(43 96% 56%)" />
      </svg>

      {/* Wordmark text */}
      <span
        style={{
          fontFamily: "'Inter', ui-sans-serif, sans-serif",
          fontSize: "17px",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1,
          color: "hsl(222 47% 22%)",
        }}
        className="dark:!text-[hsl(210_40%_96%)]"
      >
        MyCargoLens
      </span>
    </span>
  );
}
