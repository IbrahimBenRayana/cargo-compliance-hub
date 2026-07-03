"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Magnetic } from "@/components/ui/magnetic";
import { Donut } from "@/components/ui/donut";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
import { MacWindow } from "@/components/ui/mac-window";
import { HeroBackground } from "@/components/sections/hero-background";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const HEADLINE = "Know which filing needs you now.";

const STATS: { value: string; label: string }[] = [
  { value: "99.8%", label: "CBP acceptance" },
  { value: "< 90 sec", label: "average filing" },
  { value: "314-day", label: "clocks tracked" },
];

type QueueRow = {
  id: string;
  title: string;
  meta: string;
  score: number;
  tone: "rose" | "amber" | "emerald";
  pill: string;
  pillTone: Severity;
  /** Hidden on small screens to keep the mobile hero compact. */
  desktopOnly?: boolean;
};

const QUEUE: QueueRow[] = [
  {
    id: "INV-4421",
    title: "CBP rejected — INV-4421",
    meta: "Manufacturer party missing tax ID · Open AI coach to fix",
    score: 42,
    tone: "rose",
    pill: "Rejected",
    pillTone: "rose",
  },
  {
    id: "INV-4502",
    title: "ISF-10 deadline in 4h — INV-4502",
    meta: "MBOL MAEU9381-2 · Vessel arriving Long Beach 18:30",
    score: 78,
    tone: "amber",
    pill: "4h",
    pillTone: "amber",
  },
  {
    id: "Entry-230-1148293-5",
    title: "PSC window closing — Entry 230-1148293-5",
    meta: "11 days to PSC · 53 days to liquidation",
    score: 88,
    tone: "amber",
    pill: "PSC",
    pillTone: "amber",
    desktopOnly: true,
  },
  {
    id: "drafts-3",
    title: "3 drafts ready for review",
    meta: "Templates · AI pre-flight available · Bulk submit",
    score: 96,
    tone: "emerald",
    pill: "Ready",
    pillTone: "emerald",
  },
];

/**
 * Homepage hero. The claim is "an inbox, not a dashboard" — so the first
 * viewport shows the inbox itself, on every screen size, instead of an
 * abstract illustration.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden py-16 md:py-20 lg:py-24">
      <HeroBackground />
      <Container className="relative z-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Copy column */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
            className="min-w-0 lg:col-span-5"
          >
            <motion.span
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: EASE_OUT_QUART },
                },
              }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 backdrop-blur-sm"
            >
              <span className="relative flex size-2">
                <span
                  aria-hidden
                  className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping"
                />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Live for US importers
              </span>
            </motion.span>

            <h1 className="mb-6 w-full break-words text-[2rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-4xl md:text-5xl xl:text-[3.4rem]">
              <HeadlineWords text={HEADLINE} delayChildren={0.1} highlightLast />
            </h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, delay: 0.55, ease: EASE_OUT_QUART },
                },
              }}
              className="mb-8 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              MyCargoLens ranks every CBP filing by urgency, explains every
              rejection in plain English, and tracks ADD/CVD, UFLPA, and
              liquidation deadlines. An inbox for US customs — not another
              dashboard.
            </motion.p>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, delay: 0.75, ease: EASE_OUT_QUART },
                },
              }}
              className="mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
            >
              <Magnetic strength={6}>
                <Button variant="gold" size="lg" asChild>
                  <Link href="/book-a-demo">Request a demo</Link>
                </Button>
              </Magnetic>
              <Button variant="outline" size="lg" asChild>
                <Link href="#how">See how it works</Link>
              </Button>
            </motion.div>

            <motion.dl
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { duration: 0.5, delay: 0.95 },
                },
              }}
              className="flex flex-wrap items-center gap-x-6 gap-y-2"
            >
              {STATS.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-1.5">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {stat.value}
                  </dd>
                  <dd className="text-xs text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          {/* Product column — the inbox itself, on every screen size */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: EASE_OUT_EXPO }}
            className="relative min-w-0 lg:col-span-7 lg:pl-6"
          >
            {/* Soft gold halo behind the window */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0"
              style={{
                background:
                  "radial-gradient(ellipse 60% 55% at 55% 30%, hsl(43 96% 56% / 0.14) 0%, transparent 70%)",
              }}
            />
            <MacWindow
              urlBar="app.mycargolens.com/compliance"
              className="relative"
              contentClassName="p-4 sm:p-5"
            >
              {/* Today's brief */}
              <div className="mb-4 flex items-center gap-4">
                <Donut value={86} tone="gold" size={56} strokeWidth={3.5} showLabel delay={1} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Sparkles size={12} className="text-gold-dark dark:text-gold" aria-hidden />
                    Today&apos;s brief
                  </div>
                  <p className="truncate text-[13px] font-medium leading-snug text-foreground sm:whitespace-normal">
                    3 drafts waiting on you. One rejection blocking re-file —
                    open the coach first.
                  </p>
                </div>
              </div>

              {/* Queue header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-1.5">
                    <span
                      aria-hidden
                      className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping"
                    />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Action queue
                  </span>
                </div>
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                  ranked by urgency
                </span>
              </div>

              {/* Queue rows */}
              <motion.ul
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: {
                    transition: { staggerChildren: 0.09, delayChildren: 0.9 },
                  },
                }}
                className="flex flex-col gap-2"
              >
                {QUEUE.map((row) => (
                  <motion.li
                    key={row.id}
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      visible: {
                        opacity: 1,
                        x: 0,
                        transition: { duration: 0.45, ease: EASE_OUT_QUART },
                      },
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-2.5 sm:p-3",
                      row.desktopOnly && "hidden sm:flex",
                    )}
                  >
                    <Donut value={row.score} tone={row.tone} size={30} delay={1.2} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-foreground">
                        {row.title}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {row.meta}
                      </div>
                    </div>
                    <SeverityPill tone={row.pillTone}>{row.pill}</SeverityPill>
                  </motion.li>
                ))}
              </motion.ul>

              {/* Live footer strip */}
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                <span>Polling CBP every 5 minutes</span>
                <span className="hidden sm:inline">Last ping: 14s ago</span>
              </div>
            </MacWindow>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

function HeadlineWords({
  text,
  delayChildren,
  highlightLast = false,
}: {
  text: string;
  delayChildren: number;
  highlightLast?: boolean;
}) {
  const words = text.split(" ");
  return (
    <motion.span
      className="block [text-wrap:balance]"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.045, delayChildren },
        },
      }}
    >
      {words.map((word, i) => {
        const isLast = highlightLast && i === words.length - 1;
        return (
          <motion.span
            key={`${word}-${i}`}
            variants={{
              hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
              visible: {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: { duration: 0.55, ease: EASE_OUT_EXPO },
              },
            }}
            className={cn(
              "mr-[0.18em] inline-block",
              isLast && "text-gold-word font-semibold",
            )}
          >
            {word}
          </motion.span>
        );
      })}
    </motion.span>
  );
}
