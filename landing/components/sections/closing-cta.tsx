"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ClosingCta() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        className="relative py-24 md:py-32 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 50% -10%, hsl(43 96% 56% / 0.12) 0%, transparent 65%),
            radial-gradient(at 15% 15%, hsl(220 70% 55% / 0.07) 0px, transparent 55%),
            radial-gradient(at 85% 80%, hsl(43 96% 56% / 0.05) 0px, transparent 55%),
            radial-gradient(at 50% 0%, hsl(220 70% 30% / 0.06) 0px, transparent 60%),
            hsl(var(--background))
          `,
        }}
      >
        {/* Subtle top gold glow line */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, hsl(43 96% 56% / 0.4) 50%, transparent 100%)",
          }}
        />

        <Container>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex flex-col items-center text-center max-w-3xl mx-auto"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
              Get Started
            </span>

            <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-foreground mb-5 leading-[1.1]">
              Start filing in{" "}
              <span className="text-gradient-gold">90 seconds.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-10 max-w-xl leading-relaxed">
              No credit card. No sales calls. Free forever plan with 2 filings
              per month.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 mb-8">
              <Button variant="gold" size="lg" asChild>
                <a href="https://app.mycargolens.com/register">Start free</a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/contact">Talk to sales</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Questions? Email{" "}
              <a
                href="mailto:support@mycargolens.com"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                support@mycargolens.com
              </a>
            </p>
          </motion.div>
        </Container>
      </section>
    </MotionConfig>
  );
}
