"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { motion, MotionConfig } from "framer-motion";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

const FAQ_ITEMS = [
  {
    q: "What is ISF and who needs to file it?",
    a: "Importer Security Filing (ISF 10+2) is required by CBP for all ocean cargo entering the US. Any party responsible for the cargo — importer of record, freight forwarder, or broker — can file. MyCargoLens lets you file directly without a broker.",
  },
  {
    q: "How fast can I file with MyCargoLens?",
    a: "Under 90 seconds for a typical ISF once your shipment data is in. Bulk imports and templates cut that further.",
  },
  {
    q: "What happens if my filing is late or wrong?",
    a: "CBP penalties start at $5,000 per violation. Our validation engine catches missing data, formatting errors, and rule violations before submission — so you avoid them entirely.",
  },
  {
    q: "Do you file directly with CBP?",
    a: "Yes. We're integrated with CBP's ACE system via our certified API partner, CustomsCity. Your filings go straight to CBP — no intermediary broker.",
  },
  {
    q: "Can I bring my own CBP bond?",
    a: "Yes. You can use your existing continuous or single-use bond, or purchase through us. We support both ISF and Activity Code 1 bonds.",
  },
  {
    q: "How do amendments and cancellations work?",
    a: "Free. Amend or cancel any filing until CBP accepts it — we charge nothing for updates. After acceptance, amendments follow CBP's standard rules.",
  },
  {
    q: "What if a filing is rejected?",
    a: "You'll see the rejection reason immediately with a plain-English explanation. Fix and resubmit in a few clicks. We track every attempt in the audit log.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We're SOC 2 Type II compliant. Your filings are never shared outside CBP's ACE system.",
  },
];

export function Faq() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="faq" className="py-20 md:py-28 bg-mesh">
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
              FAQ
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mt-3"
            >
              Answers to common questions
            </motion.h2>
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
