"use client";

import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig, useInView } from "framer-motion";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

interface BenefitItem {
  value: number | null;
  displayValue: string;
  suffix: string;
  label: string;
  description: string;
}

const BENEFITS: BenefitItem[] = [
  {
    value: 99.8,
    displayValue: "99.8",
    suffix: "%",
    label: "CBP acceptance rate",
    description:
      "Our validation engine catches 99.8% of errors before they reach CBP.",
  },
  {
    value: 90,
    displayValue: "90",
    suffix: " sec",
    label: "Average filing time",
    description:
      "From bill of lading to CBP transmission in under a minute and a half.",
  },
  {
    value: null,
    displayValue: "24/7",
    suffix: "",
    label: "Real-time tracking",
    description:
      "Know your filing status the moment CBP responds. No more email chases.",
  },
  {
    value: null,
    displayValue: "SOC 2",
    suffix: "",
    label: "Enterprise-grade security",
    description:
      "Data encrypted at rest and in transit. Audit logs for every action.",
  },
];

function AnimatedNumber({
  target,
  suffix,
  decimals = 0,
}: {
  target: number;
  suffix: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1400;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      const eased = 1 - Math.pow(2, -10 * progress);
      setDisplay(parseFloat((eased * target).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(target);
    };

    requestAnimationFrame(tick);
  }, [inView, target, decimals]);

  return (
    <span ref={ref}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function Benefits() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="py-20 md:py-28">
        <Container>
          {/* Header */}
          <div className="text-center mb-14">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Why MyCargoLens
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mt-3 mb-4"
            >
              Built to remove friction, not add it
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="text-muted-foreground max-w-xl mx-auto"
            >
              Every number here reflects a real outcome for our customers — not
              a marketing promise.
            </motion.p>
          </div>

          {/* 2×2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {BENEFITS.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                className="rounded-2xl border border-border/60 bg-card/50 p-8 flex flex-col gap-3"
              >
                {/* Big number */}
                <div className="text-5xl font-semibold text-gradient-gold leading-none">
                  {item.value !== null ? (
                    <AnimatedNumber
                      target={item.value}
                      suffix={item.suffix}
                      decimals={item.displayValue.includes(".") ? 1 : 0}
                    />
                  ) : (
                    <span>{item.displayValue}</span>
                  )}
                </div>

                <div>
                  <p className="font-medium text-foreground mb-1">{item.label}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>
    </MotionConfig>
  );
}
