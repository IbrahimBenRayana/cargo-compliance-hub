"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Magnetic } from "@/components/ui/magnetic";
import { HeroBackground } from "@/components/sections/hero-background";
import { HeroScene } from "@/components/illustrations/hero-scene";
import { ActChaos } from "@/components/sections/home/act-chaos";
import { ActWatch } from "@/components/sections/home/act-watch";
import { ActCoach } from "@/components/sections/home/act-coach";
import { ActFile } from "@/components/sections/home/act-file";
import { ActRegulated } from "@/components/sections/home/act-regulated";
import { ActTrack } from "@/components/sections/home/act-track";
import { ActTeamTrust } from "@/components/sections/home/act-team-trust";
import { BandAutomationTicker } from "@/components/sections/home/band-automation-ticker";
import { BandBuiltOnRails } from "@/components/sections/home/band-built-on-rails";
import { ClosingCta } from "@/components/sections/closing-cta";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const HEADLINE_BEFORE = "An inbox for US customs.";
const HEADLINE_HIGHLIGHT = "Not another dashboard.";

const trustChips = [
  "ISF + Entry to CBP",
  "AI rejection coach",
  "UFLPA · ADD/CVD · liquidation",
];

export default function HomeClient() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-28 lg:py-32">
        <HeroBackground />
        <Container className="relative z-10">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Text column */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06 } },
              }}
              className="lg:col-span-6 min-w-0 flex flex-col items-center lg:items-start text-center lg:text-left"
            >
              {/* Live indicator eyebrow */}
              <motion.span
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: EASE_OUT_QUART },
                  },
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 mb-6 backdrop-blur-sm"
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

              {/* Headline — per-word stagger reveal */}
              <h1 className="w-full text-[1.75rem] sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6 leading-[1.08] break-words">
                <motion.span
                  className="block"
                  variants={{
                    hidden: {},
                    visible: {
                      transition: { staggerChildren: 0.045, delayChildren: 0.1 },
                    },
                  }}
                >
                  {HEADLINE_BEFORE.split(" ").map((word, i) => (
                    <motion.span
                      key={`b-${i}`}
                      variants={{
                        hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
                        visible: {
                          opacity: 1,
                          y: 0,
                          filter: "blur(0px)",
                          transition: { duration: 0.55, ease: EASE_OUT_EXPO },
                        },
                      }}
                      className="inline-block mr-[0.18em]"
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.span>
                <motion.span
                  className="block"
                  variants={{
                    hidden: {},
                    visible: {
                      transition: { staggerChildren: 0.045, delayChildren: 0.35 },
                    },
                  }}
                >
                  {HEADLINE_HIGHLIGHT.split(" ").map((word, i) => {
                    const isLast = i === HEADLINE_HIGHLIGHT.split(" ").length - 1;
                    return (
                      <motion.span
                        key={`h-${i}`}
                        variants={{
                          hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
                          visible: {
                            opacity: 1,
                            y: 0,
                            filter: "blur(0px)",
                            transition: { duration: 0.55, ease: EASE_OUT_EXPO },
                          },
                        }}
                        className={
                          isLast
                            ? "relative inline-block mr-[0.18em] text-gold-word font-semibold"
                            : "inline-block mr-[0.18em]"
                        }
                      >
                        {word}
                      </motion.span>
                    );
                  })}
                </motion.span>
              </h1>

              {/* Subheadline */}
              <motion.p
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.6, delay: 0.55, ease: EASE_OUT_QUART },
                  },
                }}
                className="w-full text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mb-9 leading-relaxed mx-auto lg:mx-0"
              >
                MyCargoLens ranks every filing by urgency, explains every CBP
                rejection in plain English, and tracks ADD/CVD, UFLPA, and
                liquidation deadlines — in one calm surface for ops teams.
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.55, delay: 0.75, ease: EASE_OUT_QUART },
                  },
                }}
                className="flex flex-col sm:flex-row items-center gap-3 mb-5"
              >
                <Magnetic strength={6}>
                  <Button variant="gold" size="lg" asChild>
                    <a href="https://app.mycargolens.com/register">Start free</a>
                  </Button>
                </Magnetic>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/features">See what shipped</Link>
                </Button>
              </motion.div>

              {/* Trust chips */}
              <motion.ul
                variants={{
                  hidden: {},
                  visible: {
                    transition: { staggerChildren: 0.08, delayChildren: 0.95 },
                  },
                }}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 mb-4"
              >
                {trustChips.map((chip) => (
                  <motion.li
                    key={chip}
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.4, ease: EASE_OUT_QUART },
                      },
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span aria-hidden className="size-1 rounded-full bg-gold" />
                    <span>{chip}</span>
                  </motion.li>
                ))}
              </motion.ul>

              {/* Fine print */}
              <motion.p
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { duration: 0.4, delay: 1.3 },
                  },
                }}
                className="text-xs text-muted-foreground"
              >
                Free plan &bull; No credit card required
              </motion.p>
            </motion.div>

            {/* 3D scene column — desktop only (mobile keeps text-only hero) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: EASE_OUT_QUART }}
              className="hidden lg:flex lg:col-span-6 relative items-center justify-center min-w-0"
            >
              <div className="relative w-full flex items-center justify-center">
                <HeroScene className="w-full max-w-xl h-auto text-foreground/90" />
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Act 2 — The Chaos */}
      <ActChaos />

      {/* Act 3 — Watch (Compliance Center) */}
      <ActWatch />

      {/* Automation ticker — connective tissue (1/2) */}
      <BandAutomationTicker />

      {/* Act 4 — AI Coach */}
      <ActCoach />

      {/* Act 5 — File */}
      <ActFile />

      {/* Automation ticker — connective tissue (2/2) */}
      <BandAutomationTicker />

      {/* Act 6 — Know what's regulated */}
      <ActRegulated />

      {/* Act 7 — Track (Liquidation Pipeline) */}
      <ActTrack />

      {/* Act 8 — Team & trust */}
      <ActTeamTrust />

      {/* Trust band — Built on the rails */}
      <BandBuiltOnRails />

      {/* Closing CTA */}
      <ClosingCta />
    </>
  );
}
