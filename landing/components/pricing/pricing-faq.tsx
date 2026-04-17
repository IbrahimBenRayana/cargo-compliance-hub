"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { motion, MotionConfig } from "framer-motion";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

const FAQ_ITEMS = [
  {
    q: "How does the filing count work?",
    a: "Your plan includes a monthly allowance of ISF filings. Each accepted or submitted ISF counts as one. Amendments, cancellations, and status-only CBP pings are always free. Usage resets on the first of each month.",
  },
  {
    q: "What happens if I go over my monthly filings?",
    a: "On paid plans, you keep filing — no hard cap. Each filing over your plan allowance is billed at $8, added to your next invoice. Starter (free) plan hard-caps at 2 filings — upgrade to continue.",
  },
  {
    q: "Can I switch plans any time?",
    a: "Yes, up or down, any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of your current billing period.",
  },
  {
    q: "Do you offer annual discounts?",
    a: "Yes — save 20% when you pay yearly. The discount applies to Grower and Scale. You can switch from monthly to annual at any time; the new cycle starts on your switch date.",
  },
  {
    q: "What's your refund policy?",
    a: "If you're not happy within the first 30 days of a paid plan, email support@mycargolens.com for a full refund. No forms, no questions — the product should earn the subscription.",
  },
  {
    q: "Do you charge for CBP bonds?",
    a: "No. MyCargoLens doesn't sell bonds. If you need an ISF bond or continuous bond, we integrate with third-party surety providers at cost — or you bring your own. Either way, no markup from us.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Credit card (Visa, Mastercard, Amex) and ACH/SEPA via Stripe. Enterprise customers can pay by invoice on net-30 terms.",
  },
  {
    q: "Is there a setup fee?",
    a: "Never. Your first filing can happen minutes after signup.",
  },
];

export function PricingFaq() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="py-20 md:py-28 bg-mesh">
        <Container>
          {/* Header */}
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              PRICING QUESTIONS
            </span>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mt-3">
              About our pricing
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Straight answers to the questions we hear most.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="max-w-2xl mx-auto"
          >
            <Accordion.Root type="single" collapsible className="flex flex-col">
              {FAQ_ITEMS.map((item, i) => (
                <Accordion.Item
                  key={i}
                  value={`item-${i}`}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center justify-between py-5 text-left text-base font-medium text-foreground hover:text-foreground/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
                      <span>{item.q}</span>
                      <ChevronDown
                        size={18}
                        className="shrink-0 ml-4 text-muted-foreground transition-transform duration-300 ease-[0.22,1,0.36,1] group-data-[state=open]:rotate-180"
                      />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <p className="pb-5 text-sm text-muted-foreground leading-relaxed">
                      {item.a}
                    </p>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </motion.div>
        </Container>
      </section>
    </MotionConfig>
  );
}
