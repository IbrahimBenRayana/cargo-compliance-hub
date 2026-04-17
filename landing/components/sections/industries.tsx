"use client";

import { motion, MotionConfig } from "framer-motion";
import { Boxes, Ship, BadgeCheck, ShoppingBag } from "lucide-react";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

const industries = [
  {
    icon: Boxes,
    title: "Direct importers",
    description:
      "Skip the broker fees. File your own ISFs, entries, and in-bonds with the same tools CBP inspectors use.",
  },
  {
    icon: Ship,
    title: "Freight forwarders",
    description:
      "White-label compliance for your clients. Multi-org workspaces, per-client billing, shared audit trails.",
  },
  {
    icon: BadgeCheck,
    title: "Customs brokers",
    description:
      "Modern software to replace legacy ABI systems. All the filing types your clients need, one subscription.",
  },
  {
    icon: ShoppingBag,
    title: "E-commerce operators",
    description:
      "High-volume, low-friction filings for DTC importers and marketplaces. Built for scale.",
  },
];

export function Industries() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="py-20 md:py-28 bg-mesh">
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
              Built For
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mt-3 mb-4"
            >
              Compliance teams that care about getting it right
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="text-muted-foreground max-w-xl mx-auto"
            >
              Whether you file for one importer or one hundred, MyCargoLens
              scales with your operation.
            </motion.p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {industries.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                  className="rounded-2xl border border-border/60 bg-card/50 p-6 flex flex-col gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-gold/15 flex items-center justify-center text-gold-dark dark:text-gold">
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Container>
      </section>
    </MotionConfig>
  );
}
