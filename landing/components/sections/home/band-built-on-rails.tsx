"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import {
  BookOpen,
  Boxes,
  CreditCard,
  Landmark,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

type Rail = {
  Icon: LucideIcon;
  name: string;
  descriptor: string;
};

const RAILS: Rail[] = [
  { Icon: Boxes, name: "CustomsCity", descriptor: "ABI gateway" },
  { Icon: Shield, name: "CBP ABI", descriptor: "Direct connection" },
  { Icon: BookOpen, name: "Federal Register", descriptor: "Daily ADD/CVD sync" },
  { Icon: CreditCard, name: "Stripe", descriptor: "Billing" },
  {
    Icon: Landmark,
    name: "FDA · USDA-APHIS · EPA · FCC",
    descriptor: "PGA partner agencies",
  },
];

export function BandBuiltOnRails() {
  const ref = React.useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      id="built-on-rails"
      aria-labelledby="built-on-rails-title"
      className="relative bg-background py-12"
    >
      <Container>
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease: EASE_OUT_QUART }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Trust
          </span>
          <h2
            id="built-on-rails-title"
            className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl"
          >
            Built on the rails CBP actually uses.
          </h2>
        </motion.header>

        {/* Marquee. The track holds two identical lists end-to-end and
            translates by -50% over the duration, which puts the start of
            list-2 exactly where list-1 began — seamless loop. Pure
            transform animation (no layout properties). Edge mask gradient
            fades content in and out so the loop seam is never visible.
            MotionRoot's reducedMotion="user" handles accessibility: under
            prefers-reduced-motion the animation is collapsed to a no-op
            and the rails sit static. */}
        <div
          className="mt-8 overflow-hidden md:mt-10 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
          aria-label="Integration partners"
        >
          <motion.div
            className="flex w-max gap-4"
            animate={inView ? { x: ["0%", "-50%"] } : undefined}
            transition={{
              duration: 38,
              ease: "linear",
              repeat: Infinity,
              repeatType: "loop",
            }}
          >
            {[...RAILS, ...RAILS].map((rail, i) => (
              <div
                key={`${rail.name}-${i}`}
                aria-hidden={i >= RAILS.length}
                className="group flex w-[220px] shrink-0 rounded-2xl border border-border/60 bg-card px-5 py-4"
              >
              <div className="flex items-start gap-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-[hsl(43_96%_44%)] ring-1 ring-amber-500/20 dark:text-[hsl(43_96%_62%)]"
                  aria-hidden
                >
                  <rail.Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-foreground">
                    {rail.name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {rail.descriptor}
                  </div>
                </div>
              </div>
              </div>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
