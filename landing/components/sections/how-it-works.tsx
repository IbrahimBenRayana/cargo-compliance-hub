"use client";

import { motion, MotionConfig } from "framer-motion";
import { Container } from "@/components/ui/container";
import { CreateIllustration } from "@/components/illustrations/create";
import { ValidateIllustration } from "@/components/illustrations/validate";
import { SubmitIllustration } from "@/components/illustrations/submit";

const EASE = [0.22, 1, 0.36, 1] as const;

const steps = [
  {
    number: "01",
    title: "Create",
    description:
      "Add your shipment data. Smart forms pre-fill from BOL and past filings.",
    Illustration: CreateIllustration,
  },
  {
    number: "02",
    title: "Validate",
    description:
      "Our engine checks every field against CBP's 10+2 rules. Errors caught before they cost you $5,000.",
    Illustration: ValidateIllustration,
  },
  {
    number: "03",
    title: "Submit",
    description:
      "One click sends to CBP via our direct ACE connection. Real-time status updates flow back in.",
    Illustration: SubmitIllustration,
  },
];

export function HowItWorks() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="py-20 md:py-28 bg-mesh">
        <Container>
          {/* Header */}
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              How It Works
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mt-3 mb-4"
            >
              Three steps from shipment to cleared
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="text-muted-foreground max-w-xl mx-auto"
            >
              No forms to fax. No broker to call. Just accurate filings,
              directly to CBP.
            </motion.p>
          </div>

          {/* Steps */}
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-center gap-8 md:gap-0">
            {/* Connecting line — desktop only */}
            <div className="hidden md:block absolute top-[56px] left-[calc(16.67%+56px)] right-[calc(16.67%+56px)] h-px">
              <svg
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
                viewBox="0 0 100 1"
              >
                <defs>
                  <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(43 96% 56%)" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="hsl(43 96% 56%)" stopOpacity="0.6" />
                  </linearGradient>
                </defs>
                <motion.line
                  x1="0"
                  y1="0.5"
                  x2="100"
                  y2="0.5"
                  stroke="url(#line-grad)"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 1.0, delay: 0.3, ease: EASE }}
                />
              </svg>
            </div>

            {steps.map((step, i) => {
              const { Illustration } = step;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
                  className="relative flex-1 flex flex-col items-center text-center px-4 md:px-8"
                >
                  {/* Custom illustration */}
                  <Illustration className="h-24 w-24 md:h-28 md:w-28 mb-6" />

                  {/* Step number */}
                  <span className="text-xs font-semibold text-muted-foreground tracking-widest mb-3">
                    {step.number}
                  </span>

                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </Container>
      </section>
    </MotionConfig>
  );
}
