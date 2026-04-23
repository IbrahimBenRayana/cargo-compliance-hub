"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

const EASE = [0.22, 1, 0.36, 1] as const;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.mycargolens.com";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For evaluators and single-shipment importers",
    price: { monthly: 0, annual: 0 },
    yearlyPrice: 0,
    highlight: false,
    filings: 2,
    features: [
      "2 ISF filings per month",
      "Single user",
      "Basic dashboard",
      "Email support",
      "Standard validation rules",
    ],
    cta: {
      label: "Start free",
      ctaKey: "starter" as const,
      variant: "outline" as const,
    },
    bgGradient:
      "radial-gradient(circle at top left, hsl(220 20% 93% / 0.4) 0%, transparent 60%)",
  },
  {
    id: "grower",
    name: "Grower",
    tagline: "For small importers with consistent volume",
    price: { monthly: 99, annual: 79 },
    yearlyPrice: 948,
    highlight: true,
    filings: 15,
    features: [
      "15 ISF filings per month",
      "Up to 3 users",
      "Full dashboard + reporting",
      "ISF 10+2 and ISF-5",
      "Priority email + chat support (24h)",
      "Audit trail + CSV export",
      "Templates & bulk duplicate",
    ],
    cta: {
      label: "Choose Grower",
      ctaKey: "grower" as const,
      variant: "gold" as const,
    },
    bgGradient:
      "radial-gradient(circle at top right, hsl(43 96% 56% / 0.12) 0%, transparent 65%), radial-gradient(circle at bottom left, hsl(43 96% 56% / 0.06) 0%, transparent 55%)",
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For growing teams and 3PLs",
    price: { monthly: 299, annual: 239 },
    yearlyPrice: 2868,
    highlight: false,
    filings: 60,
    features: [
      "60 ISF filings per month",
      "Up to 10 users",
      "Everything in Grower",
      "Bulk CSV import",
      "Custom roles & permissions",
      "API access",
      "Priority support (4h SLA)",
    ],
    cta: {
      label: "Choose Scale",
      ctaKey: "scale" as const,
      variant: "outline" as const,
    },
    bgGradient:
      "radial-gradient(circle at top right, hsl(222 47% 30% / 0.08) 0%, transparent 60%)",
  },
];

type Billing = "monthly" | "annual";

export function PricingCards() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <MotionConfig reducedMotion="user">
      <section className="py-16 md:py-20">
        <Container>
          {/* Section text */}
          <p className="text-center text-sm text-muted-foreground mb-6">
            Pick a plan. Change or cancel any time.
          </p>

          {/* Billing toggle */}
          <div className="flex flex-col items-center gap-2.5 mb-12">
            <div className="inline-flex items-center rounded-full bg-muted p-1 h-11">
              {(["monthly", "annual"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setBilling(opt)}
                  className={`relative px-6 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                    billing === opt
                      ? "bg-card text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
            <AnimatePresence>
              {billing === "annual" && (
                <motion.span
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold text-gold-dark dark:text-gold tracking-wide"
                >
                  Save 20% with annual billing
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 items-start">
            {PLANS.map((plan, i) => {
              const price =
                billing === "monthly" ? plan.price.monthly : plan.price.annual;
              const isFree = price === 0;

              return (
                <div key={plan.id} className="relative">
                  {/* Most popular badge — outside the overflow-hidden card */}
                  {plan.highlight && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[hsl(222_47%_8%)] whitespace-nowrap shadow-[0_8px_24px_-6px_hsl(43_96%_56%/0.6)]"
                      style={{ background: "linear-gradient(to right, hsl(43 96% 62%), hsl(38 92% 50%))" }}
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Most popular
                    </span>
                  )}
                <motion.div
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.1,
                    ease: EASE,
                  }}
                  whileHover={
                    plan.highlight
                      ? { scale: 1.03 }
                      : { y: -4 }
                  }
                  className={`relative rounded-3xl p-8 md:p-10 bg-card border flex flex-col transition-shadow duration-300 ${
                    plan.highlight
                      ? "border-2 border-gold/60 shadow-[0_0_60px_-20px_hsl(43_96%_56%/0.4)] md:-translate-y-4 md:scale-[1.02] z-10"
                      : "border-border/60 hover:shadow-card-hover"
                  }`}
                >
                  {/* Radial gradient background */}
                  <div
                    className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none"
                    style={{ backgroundImage: plan.bgGradient }}
                  />

                  {/* Plan name */}
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                    {plan.name}
                  </p>

                  {/* Plan description */}
                  <p className="text-[13px] text-muted-foreground/90 mb-8 leading-relaxed">
                    {plan.tagline}
                  </p>

                  {/* Big price block */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${plan.id}-${billing}-${price}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25, ease: EASE }}
                    >
                      <div className="flex items-baseline">
                        {isFree ? (
                          <span className="text-6xl font-semibold text-foreground">
                            Free
                          </span>
                        ) : (
                          <>
                            <span className="text-3xl font-medium text-muted-foreground mr-1 mt-1">
                              $
                            </span>
                            <span className="text-6xl font-semibold text-foreground tabular-nums">
                              {price}
                            </span>
                            <span className="text-lg text-muted-foreground ml-1.5">
                              /mo
                            </span>
                          </>
                        )}
                      </div>

                      {billing === "annual" && price > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          ${plan.yearlyPrice} billed yearly
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Filings callout */}
                  <div className="mt-6 pb-6 border-b border-border/60 flex items-center gap-2.5">
                    <Check
                      className="h-5 w-5 text-gold shrink-0"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-semibold text-foreground">
                      {plan.filings} filings per month
                    </span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mt-6 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check
                          className="h-4 w-4 text-gold mt-0.5 shrink-0"
                          strokeWidth={2.5}
                        />
                        <span className="text-sm text-foreground/85 leading-relaxed">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA button */}
                  <Button
                    asChild
                    variant={plan.cta.variant}
                    size="lg"
                    className="w-full"
                  >
                    <Link href={
                      plan.cta.ctaKey === "starter"
                        ? `${APP_URL}/register`
                        : `${APP_URL}/upgrade?plan=${plan.cta.ctaKey}_${billing}`
                    }>{plan.cta.label}</Link>
                  </Button>
                </motion.div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>
    </MotionConfig>
  );
}
