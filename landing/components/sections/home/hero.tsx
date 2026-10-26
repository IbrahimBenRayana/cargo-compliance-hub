"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Magnetic } from "@/components/ui/magnetic";
import { HeroBackground } from "@/components/sections/hero-background";
import { Hero3D } from "@/components/hero3d/Hero3D";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const HEADLINE = "Know which filing needs you now.";

const STATS: { value: string; label: string }[] = [
  { value: "ISF + Entry", label: "in one workspace" },
  { value: "AI Coach", label: "for every rejection" },
  { value: "314-day", label: "clocks tracked" },
];

/**
 * Homepage hero. The visual slot is the 3D hero (the inbox rising from the
 * sea); real product screenshots belong in the page content below.
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
              <span aria-hidden className="relative inline-flex size-2 rounded-full bg-gold" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                CBP ABI certified
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
                  transition: { duration: 0.6, delay: 0.45, ease: EASE_OUT_QUART },
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
                  transition: { duration: 0.55, delay: 0.6, ease: EASE_OUT_QUART },
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
                  transition: { duration: 0.5, delay: 0.8, ease: EASE_OUT_QUART },
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

          {/* Visual column — the 3D hero (poster first, live scene on idle) */}
          <div className="relative min-w-0 lg:col-span-7 lg:-mr-8 xl:-mr-16">
            <Hero3D scene="home" />
          </div>
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
