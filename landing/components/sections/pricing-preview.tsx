"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

const plans = [
  {
    name: "Starter",
    price: "Free",
    tagline: "For evaluators",
    features: ["2 filings / month", "Single user", "Email support"],
    cta: "Start free",
    ctaVariant: "outline" as const,
    popular: false,
  },
  {
    name: "Grower",
    price: "$99",
    period: "/mo",
    tagline: "Most popular",
    features: [
      "15 filings / month",
      "Up to 3 users",
      "Priority email + chat",
      "Full ISF types",
    ],
    cta: "Choose Grower",
    ctaVariant: "gold" as const,
    popular: true,
  },
  {
    name: "Scale",
    price: "$299",
    period: "/mo",
    tagline: "For growing teams",
    features: [
      "60 filings / month",
      "Up to 10 users",
      "4-hour SLA",
      "Bulk upload",
      "API access",
    ],
    cta: "Choose Scale",
    ctaVariant: "outline" as const,
    popular: false,
  },
];

export function PricingPreview() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="py-20 md:py-28">
        <Container>
          {/* Header */}
          <div className="text-center mb-12">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Pricing
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mt-3 mb-4"
            >
              Built for your volume, priced for your budget
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="text-muted-foreground max-w-xl mx-auto"
            >
              Start free. Scale when you&apos;re ready. No per-filing surprises.
            </motion.p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                className={`relative rounded-2xl border p-8 flex flex-col gap-6 ${
                  plan.popular
                    ? "border-gold/60 glow-gold bg-card shadow-[0_0_0_1px_hsl(43_96%_56%_/_0.15),_0_0_16px_hsl(43_96%_56%_/_0.2),_0_0_32px_hsl(43_96%_56%_/_0.08)] md:-translate-y-2"
                    : "border-border/60 bg-card/50"
                }`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-gold text-yellow-950 text-xs font-semibold shadow-gold">
                      Most popular
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-xl text-foreground mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-foreground">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm">
                      {plan.period}
                    </span>
                  )}
                </div>

                <ul className="flex flex-col gap-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold/80 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button variant={plan.ctaVariant} size="lg" className="w-full" asChild>
                  <Link href="/pricing">{plan.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Enterprise link */}
          <p className="text-center mt-10 text-sm text-muted-foreground">
            Need more?{" "}
            <Link
              href="/pricing"
              className="text-foreground underline underline-offset-4 hover:text-gold transition-colors"
            >
              Enterprise plans available — see all pricing details →
            </Link>
          </p>
        </Container>
      </section>
    </MotionConfig>
  );
}
