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
      {/* 6-blade camera aperture (iris diaphragm) with gold hex opening.
          The lens metaphor: many things → the one item that matters now. */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        className="text-[hsl(222_47%_22%)] dark:text-[hsl(43_96%_70%)]"
      >
        {/* Six blades, alternating tones for iris depth */}
        <path d="M 30 16 L 23 3.88 L 16 10.5 L 20.76 13.25 Z" fill="currentColor" />
        <path d="M 23 3.88 L 9 3.88 L 11.24 13.25 L 16 10.5 Z" fill="currentColor" fillOpacity="0.75" />
        <path d="M 9 3.88 L 2 16 L 11.24 18.75 L 11.24 13.25 Z" fill="currentColor" />
        <path d="M 2 16 L 9 28.12 L 16 21.5 L 11.24 18.75 Z" fill="currentColor" fillOpacity="0.75" />
        <path d="M 9 28.12 L 23 28.12 L 20.76 18.75 L 16 21.5 Z" fill="currentColor" />
        <path d="M 23 28.12 L 30 16 L 20.76 13.25 L 20.76 18.75 Z" fill="currentColor" fillOpacity="0.75" />
        {/* Gold hex aperture at the center — the only gold accent */}
        <path
          d="M 20.76 13.25 L 16 10.5 L 11.24 13.25 L 11.24 18.75 L 16 21.5 L 20.76 18.75 Z"
          fill="hsl(43 96% 56%)"
        />
      </svg>

      {/* Wordmark text — color via Tailwind classes only.
          Previously had `color: hsl(222 47% 22%)` as an inline style with
          `dark:!text-...` to override, but inline styles can outrank the
          arbitrary-value Tailwind variant in the cascade, leaving the
          word "MyCargoLens" near-invisible against the dark background
          when the user switched themes. */}
      <span
        style={{
          fontFamily: "'Inter', ui-sans-serif, sans-serif",
          fontSize: "17px",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
        className="text-[hsl(222_47%_22%)] dark:text-[hsl(210_40%_96%)]"
      >
        MyCargoLens
      </span>
    </span>
  );
}
