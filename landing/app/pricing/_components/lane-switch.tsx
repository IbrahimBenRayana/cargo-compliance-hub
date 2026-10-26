"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Fired on window when the visitor picks a lane; the estimator listens. */
export const LANE_EVENT = "mcl:pricing-lane";
export type Lane = "import" | "volume";

const OPTIONS: { id: Lane; label: string }[] = [
  { id: "import", label: "I import goods" },
  { id: "volume", label: "I file for others at volume" },
];

/**
 * S1 lane switch (copy/pricing.md S1). Two-option segmented control:
 * "I import goods" (default) keeps the importer card; "I file for others at
 * volume" smooth-scrolls to #volume (data-cta-id="lane_volume").
 */
export function LaneSwitch() {
  const [lane, setLane] = React.useState<Lane>("import");

  function pick(next: Lane) {
    setLane(next);
    window.dispatchEvent(new CustomEvent<Lane>(LANE_EVENT, { detail: next }));
    if (next === "volume") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("volume")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Which pricing applies to you"
        className="flex w-full flex-col gap-1 rounded-2xl p-1 site-surface sm:inline-flex sm:w-auto sm:flex-row"
      >
        {OPTIONS.map((o) => {
          const on = lane === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(o.id)}
              {...(o.id === "volume" ? { "data-cta-id": "lane_volume", "data-location": "hero" } : {})}
              className={cn(
                "min-h-11 rounded-xl px-4 text-[14.5px] font-semibold transition-[background-color,color,transform] duration-150 ease-[var(--ease-out-quart)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on
                  ? "bg-[hsl(222_47%_22%)] text-white dark:bg-[hsl(205_90%_78%)] dark:text-[hsl(222_47%_11%)]"
                  : "text-tone-muted hover:text-tone-fg",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[14px] text-tone-muted">
        NVOCCs, forwarders and customs brokers: your pricing is in the{" "}
        <a href="#volume" className="font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current">
          volume section
        </a>
        .
      </p>
    </div>
  );
}
