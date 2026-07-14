"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

const HEADLINE_BEFORE = "Start filing in";
const HEADLINE_HIGHLIGHT = "90 seconds.";

export function ClosingCta() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  const words: { text: string; highlight: boolean }[] = [
    ...HEADLINE_BEFORE.split(" ").map((w) => ({ text: w, highlight: false })),
    ...HEADLINE_HIGHLIGHT.split(" ").map((w) => ({ text: w, highlight: true })),
  ];

  return (
    <section className="dark relative bg-[hsl(220_22%_18%)] py-24 md:py-32 text-[hsl(210_40%_96%)]">
      <Container>
        <div
          ref={ref}
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5 }}
            className="mb-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            Ready when you are
          </motion.p>

          <h2 className="mb-5 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl">
            <motion.span
              initial="hidden"
              animate={inView ? "visible" : undefined}
              variants={{
                hidden: {},
                visible: {
                  transition: { staggerChildren: 0.06, delayChildren: 0.1 },
                },
              }}
              className="inline"
            >
              {words.map((word, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.5, ease: EASE_OUT_QUART },
                    },
                  }}
                  className={
                    word.highlight
                      ? "mr-[0.22em] inline-block text-gradient-gold"
                      : "mr-[0.22em] inline-block"
                  }
                >
                  {word.text}
                </motion.span>
              ))}
            </motion.span>
          </h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-10 text-base text-muted-foreground md:text-lg"
          >
            A 20-minute walkthrough. Card added when you&apos;re provisioned. Billed only when we file.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.5, delay: 0.55, ease: EASE_OUT_QUART }}
            className="flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button variant="gold" size="lg" asChild>
              <Link href="/book-a-demo">Request a demo</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/contact">Talk to founders</Link>
            </Button>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
