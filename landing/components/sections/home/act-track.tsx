"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionShell } from "@/components/sections/section-shell";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
import { Donut } from "@/components/ui/donut";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

const TOTAL_DAYS = 314;
const PSC_DAY = 270; // post-summary correction window closes
const URGENT_THRESHOLD = TOTAL_DAYS - 14; // ≤14 days left = urgent

type Entry = {
  number: string;
  importer: string;
  filed: string;
  elapsed: number; // days since entry accepted
  score: number;
};

const ENTRIES: Entry[] = [
  {
    number: "230-1148293-5",
    importer: "Atlas Apparel · Long Beach",
    filed: "Jul 19, 2025",
    elapsed: 308, // 6 days left — urgent
    score: 64,
  },
  {
    number: "230-1126044-2",
    importer: "Northwind Electronics · LAX",
    filed: "Sep 02, 2025",
    elapsed: 263, // 7 days to PSC
    score: 81,
  },
  {
    number: "230-1131775-8",
    importer: "Pinecone Furniture · NY/NJ",
    filed: "Oct 14, 2025",
    elapsed: 221,
    score: 89,
  },
  {
    number: "230-1144501-9",
    importer: "Galaxy Toys · Seattle",
    filed: "Nov 28, 2025",
    elapsed: 176,
    score: 92,
  },
  {
    number: "230-1149820-4",
    importer: "Pacific Spirits · Charleston",
    filed: "Jan 04, 2026",
    elapsed: 139,
    score: 86,
  },
  {
    number: "230-1152300-7",
    importer: "Aurora Hardware · Houston",
    filed: "Feb 15, 2026",
    elapsed: 97,
    score: 94,
  },
];

function statusFor(
  elapsed: number,
): { tone: Severity; label: string } {
  if (elapsed >= URGENT_THRESHOLD)
    return { tone: "rose", label: "Urgent" };
  if (elapsed >= PSC_DAY) return { tone: "amber", label: "PSC closing" };
  return { tone: "emerald", label: "On track" };
}

// Sort: urgent first, then PSC-closing, then by elapsed desc (closest to deadline first)
const SORTED = [...ENTRIES].sort((a, b) => b.elapsed - a.elapsed);

export function ActTrack() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <SectionShell
      id="track"
      tone="default"
      eyebrow="Records"
      title="Every entry has a 314-day clock."
      intro="From CBP acceptance to liquidation, every entry has a 314-day window. PSC closes at day 270. We track all of it, all the time — and the urgent ones rise to the top."
    >
      <div ref={ref} className="space-y-8">
        {/* Master scale — spans the full container width */}
        <div className="relative pt-10">
          {/* Day markers along the top */}
          <div className="absolute inset-x-0 top-0 flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground px-1">
            <span>Day 0 · accepted</span>
            <span>Day 270 · PSC</span>
            <span>Day 314 · liquidates</span>
          </div>

          {/* Single horizontal scale */}
          <div className="relative h-2 rounded-full bg-secondary/60 overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : undefined}
              transition={{ duration: 1.2, ease: EASE_OUT_QUART }}
              className="absolute inset-y-0 left-0 right-0 origin-left bg-gradient-to-r from-emerald-400/40 via-amber-400/40 to-rose-500/60"
            />
            {/* PSC marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-amber-500"
              style={{ left: `${(PSC_DAY / TOTAL_DAYS) * 100}%` }}
              aria-hidden
            />
            {/* Urgent threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-rose-500"
              style={{ left: `${(URGENT_THRESHOLD / TOTAL_DAYS) * 100}%` }}
              aria-hidden
            />
          </div>

          {/* Marker labels under the scale */}
          <div className="relative h-3 mt-1">
            <span
              className="absolute -translate-x-1/2 text-[10px] font-mono text-amber-800 dark:text-amber-400 tabular-nums"
              style={{ left: `${(PSC_DAY / TOTAL_DAYS) * 100}%` }}
            >
              270
            </span>
            <span
              className="absolute -translate-x-1/2 text-[10px] font-mono text-rose-800 dark:text-rose-400 tabular-nums"
              style={{ left: `${(URGENT_THRESHOLD / TOTAL_DAYS) * 100}%` }}
            >
              300
            </span>
          </div>
        </div>

        {/* Entry rows — each shows its own progress within the 314-day window */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground border-b border-border/60 bg-card/60">
            <div className="md:col-span-3">Entry</div>
            <div className="md:col-span-5">Liquidation window</div>
            <div className="md:col-span-2">Days elapsed</div>
            <div className="md:col-span-2 text-right">Status</div>
          </div>

          {/* Rows */}
          <ul>
            {SORTED.map((entry, i) => {
              const pct = Math.min(100, (entry.elapsed / TOTAL_DAYS) * 100);
              const { tone, label } = statusFor(entry.elapsed);
              return (
                <motion.li
                  key={entry.number}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : undefined}
                  transition={{
                    duration: 0.5,
                    delay: 0.1 + i * 0.06,
                    ease: EASE_OUT_QUART,
                  }}
                  className={cn(
                    "grid grid-cols-12 gap-4 px-5 py-4 items-center border-b border-border/40 last:border-b-0 transition-colors hover:bg-secondary/30",
                  )}
                >
                  {/* Entry — number + importer */}
                  <div className="col-span-12 md:col-span-3 flex items-center gap-3 min-w-0">
                    <Donut value={entry.score} tone="gold" size={32} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-mono font-semibold text-foreground tabular-nums">
                        {entry.number}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {entry.importer}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="col-span-12 md:col-span-5 relative">
                    <div className="relative h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${pct}%` } : undefined}
                        transition={{
                          duration: 0.9,
                          delay: 0.3 + i * 0.06,
                          ease: EASE_OUT_QUART,
                        }}
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          tone === "rose" && "bg-rose-500",
                          tone === "amber" && "bg-amber-500",
                          tone === "emerald" && "bg-emerald-500",
                        )}
                      />
                      {/* PSC marker on each row */}
                      <span
                        aria-hidden
                        className="absolute top-0 bottom-0 w-px bg-amber-600/70"
                        style={{ left: `${(PSC_DAY / TOTAL_DAYS) * 100}%` }}
                      />
                      <span
                        aria-hidden
                        className="absolute top-0 bottom-0 w-px bg-rose-600/70"
                        style={{ left: `${(URGENT_THRESHOLD / TOTAL_DAYS) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
                      <span>Filed {entry.filed}</span>
                      <span>{TOTAL_DAYS - entry.elapsed}d left</span>
                    </div>
                  </div>

                  {/* Days elapsed */}
                  <div className="hidden md:block md:col-span-2 text-sm font-mono tabular-nums text-foreground">
                    {entry.elapsed}d / {TOTAL_DAYS}d
                  </div>

                  {/* Status pill */}
                  <div className="col-span-12 md:col-span-2 flex md:justify-end">
                    <SeverityPill tone={tone}>{label}</SeverityPill>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* CTA */}
        <div>
          <Link
            href="/platform/lifecycle"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-gold transition-colors group"
          >
            See lifecycle visibility
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </SectionShell>
  );
}
