"use client";

import { motion, MotionConfig } from "framer-motion";
import { Boxes, Ship, BadgeCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

const solutions = [
  {
    icon: Boxes,
    role: "Direct Importers",
    description:
      "Skip the broker fees. File your own ISFs.",
    href: "/features",
  },
  {
    icon: Ship,
    role: "Freight Forwarders",
    description:
      "White-label for your clients.",
    href: "/features",
  },
  {
    icon: BadgeCheck,
    role: "Customs Brokers",
    description:
      "Modern ABI replacement.",
    href: "/features",
  },
  {
    icon: ShoppingBag,
    role: "E-Commerce Operators",
    description:
      "High-volume, low-friction.",
    href: "/features",
  },
];

export function SolutionsCallout() {
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
              Who We Serve
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mt-3 mb-4"
            >
              The right tools for your role.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="text-muted-foreground max-w-xl mx-auto"
            >
              Whether you&apos;re filing for one importer or a thousand,
              MyCargoLens scales with your workflow.
            </motion.p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {solutions.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.role}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="rounded-2xl border border-border/60 bg-card/50 p-6 flex flex-col gap-4 hover:shadow-[0_4px_6px_-1px_hsl(var(--foreground)/0.06),_0_12px_20px_-4px_hsl(var(--foreground)/0.08),_0_0_0_1px_hsl(var(--border))] transition-shadow duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-gold/15 flex items-center justify-center text-gold-dark dark:text-gold">
                    <Icon size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      {item.role}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    Learn more
                    <span className="group-hover:translate-x-0.5 transition-transform inline-block">
                      →
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </Container>
      </section>
    </MotionConfig>
  );
}
