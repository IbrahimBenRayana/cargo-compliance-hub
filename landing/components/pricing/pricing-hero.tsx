"use client";

import { motion, MotionConfig } from "framer-motion";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

const TRUST_BADGES = [
  "No credit card required",
  "Cancel any time",
  "Transparent overage pricing",
];

export function PricingHero() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="py-20 md:py-28 bg-mesh">
        <Container>
          <div className="max-w-3xl mx-auto text-center">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              PRICING
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
              className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-foreground"
            >
              Priced by filings.{" "}
              <span className="text-gradient-gold">Nothing sneaky.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
              className="mt-6 text-lg text-muted-foreground leading-relaxed"
            >
              Start free, upgrade when you need more volume. No per-feature
              gotchas, no setup fees, no long-term contracts. Cancel anytime.
            </motion.p>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {TRUST_BADGES.map((badge, i) => (
                <motion.span
                  key={badge}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.28 + i * 0.07, ease: EASE }}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 border border-border/60 bg-card shadow-sm text-xs font-medium text-foreground/80"
                >
                  <Check className="h-3 w-3 text-gold shrink-0" strokeWidth={3} />
                  {badge}
                </motion.span>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </MotionConfig>
  );
}
