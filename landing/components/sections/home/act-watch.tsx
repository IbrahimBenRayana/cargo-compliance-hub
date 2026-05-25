"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Bot, MoreHorizontal, Sparkles } from "lucide-react";
import { SectionShell } from "@/components/sections/section-shell";
import { Donut } from "@/components/ui/donut";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

type QueueRow = {
  id: string;
  title: string;
  meta: string;
  score: number;
  tone: Extract<Severity, "rose" | "amber" | "emerald">;
  pill: string;
  pillTone: Severity;
  /** Subtle leading icon to vary the row visually. */
  badge: "rejected" | "deadline" | "uflpa" | "psc" | "drafts";
};

const queue: QueueRow[] = [
  {
    id: "INV-4421",
    title: "CBP rejected — INV-4421",
    meta: "Manufacturer party missing tax ID · Open AI coach to fix",
    score: 42,
    tone: "rose",
    pill: "Rejected",
    pillTone: "rose",
    badge: "rejected",
  },
  {
    id: "INV-4502",
    title: "ISF-10 deadline in 4h — INV-4502",
    meta: "MBOL MAEU9381-2 · Vessel arriving Long Beach 18:30",
    score: 78,
    tone: "amber",
    pill: "4h",
    pillTone: "amber",
    badge: "deadline",
  },
  {
    id: "INV-4198",
    title: "UFLPA high-risk — INV-4198",
    meta: "Apparel from Xinjiang-adjacent supplier · Review evidence",
    score: 24,
    tone: "rose",
    pill: "High",
    pillTone: "rose",
    badge: "uflpa",
  },
  {
    id: "Entry-230-1148293-5",
    title: "PSC window closing — Entry 230-1148293-5",
    meta: "11 days to PSC · 53 days to liquidation",
    score: 88,
    tone: "amber",
    pill: "PSC",
    pillTone: "amber",
    badge: "psc",
  },
  {
    id: "drafts-3",
    title: "3 drafts ready for review",
    meta: "Templates · AI pre-flight available · Bulk submit",
    score: 96,
    tone: "emerald",
    pill: "Ready",
    pillTone: "emerald",
    badge: "drafts",
  },
];

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.45, ease: EASE_OUT_QUART },
  },
};

const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.4 },
  },
};

export function ActWatch() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <SectionShell
      id="watch"
      tone="default"
      eyebrow="Compliance Center"
      title="An inbox, not a dashboard."
      intro="Today's AI brief at the top. Then every filing that needs your attention — ranked by urgency, not chronology. A donut compliance score, a status pill, a snooze, an AI coach trigger, and one click into the filing."
    >
      <div ref={ref} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Copy column — 4/12 */}
        <div className="lg:col-span-4 lg:pt-6">
          <ul className="space-y-3 text-sm text-muted-foreground mb-6">
            {[
              "Today's AI brief — one line, generated daily",
              "Compliance score hero with snapshot history",
              "Snooze a card for 24h when it's not yours yet",
              "One click into the filing, with the open AI coach ready",
            ].map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 rounded-full bg-gold shrink-0"
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/platform/compliance"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-gold transition-colors group"
          >
            See Compliance Center
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* Mock column — 8/12 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease: EASE_OUT_QUART }}
          className="lg:col-span-8"
        >
          <div className="relative rounded-2xl border border-border/60 bg-card shadow-card-hover overflow-hidden">
            {/* Soft gold halo at the top */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-32 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 100% at 50% 0%, hsl(43 96% 56% / 0.12) 0%, transparent 70%)",
              }}
            />

            {/* Mock window chrome */}
            <div className="relative flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-card/60 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-rose-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <div className="text-[11px] font-mono text-muted-foreground tabular-nums">
                app.mycargolens.com/compliance
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Overview
              </span>
            </div>

            <div className="relative p-5 sm:p-6">
              {/* Today's brief + score hero */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 mb-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={inView ? { opacity: 1, scale: 1 } : undefined}
                  transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT_QUART }}
                  className="shrink-0"
                >
                  <div className="relative">
                    <Donut value={86} tone="gold" size={88} strokeWidth={3.5} showLabel />
                  </div>
                </motion.div>

                <div className="flex-1 min-w-0">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={inView ? { opacity: 1, y: 0 } : undefined}
                    transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT_QUART }}
                    className="flex items-center gap-2 mb-2"
                  >
                    <Sparkles size={14} className="text-gold-dark dark:text-gold" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Today's brief
                    </span>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={inView ? { opacity: 1, y: 0 } : undefined}
                    transition={{ duration: 0.55, delay: 0.3, ease: EASE_OUT_QUART }}
                    className="text-foreground font-medium leading-snug"
                  >
                    3 drafts waiting on you. Run an AI pre-flight before
                    submitting — one rejection blocking re-file.
                  </motion.p>
                </div>
              </div>

              {/* Queue header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span
                      aria-hidden
                      className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping"
                    />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Action queue
                  </h3>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  5 need attention
                </span>
              </div>

              {/* Queue rows */}
              <motion.ul
                variants={listVariants}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                className="flex flex-col gap-2"
              >
                {queue.map((row) => (
                  <motion.li
                    key={row.id}
                    variants={rowVariants}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3 transition-colors",
                      "hover:bg-card hover:border-border",
                    )}
                  >
                    <Donut value={row.score} tone={row.tone} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground truncate">
                        {row.title}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground truncate">
                        {row.meta}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityPill tone={row.pillTone}>{row.pill}</SeverityPill>
                      <button
                        type="button"
                        aria-label="AI coach"
                        className="hidden sm:inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-gold-dark dark:hover:text-gold hover:bg-secondary/60 transition-colors"
                        tabIndex={-1}
                      >
                        <Bot size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="More"
                        className="hidden sm:inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                        tabIndex={-1}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </div>
        </motion.div>
      </div>
    </SectionShell>
  );
}
