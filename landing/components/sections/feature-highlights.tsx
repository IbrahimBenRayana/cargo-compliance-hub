"use client";

import { motion, MotionConfig } from "framer-motion";
import {
  Ship,
  FileCheck,
  BarChart3,
  Users,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

const LIVE_FEATURES = [
  {
    icon: Ship,
    title: "ISF 10+2 Filing",
    description:
      "Importer Security Filing for ocean cargo. Full 10+2 data elements with validation against CBP rules.",
  },
  {
    icon: FileCheck,
    title: "ISF-5 Filing",
    description:
      "Simplified ISF-5 for FROB, IE, and T&E shipments. Built in the same unified workflow.",
  },
  {
    icon: BarChart3,
    title: "Compliance Dashboard",
    description:
      "Real-time view of every filing's CBP status. Spot issues before they become penalties.",
  },
  {
    icon: Users,
    title: "Team & Multi-Org",
    description:
      "Invite your team, manage multiple importer accounts, granular permissions per user.",
  },
  {
    icon: ShieldCheck,
    title: "Audit Trail",
    description:
      "Immutable log of every filing, amendment, and CBP response. Export-ready for auditors.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
};

export function FeatureHighlights() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="features" className="py-20 md:py-28">
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
              Capabilities
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mt-3 mb-4"
            >
              One platform. Every CBP filing you need.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="text-muted-foreground max-w-xl mx-auto"
            >
              Available today — built to handle everything from first ISF to
              full audit readiness.
            </motion.p>
          </div>

          {/* Static grid — live features only */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {LIVE_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={cardVariants}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="relative rounded-2xl border border-border/60 p-6 bg-card/50 hover:shadow-[0_4px_6px_-1px_hsl(var(--foreground)/0.06),_0_12px_20px_-4px_hsl(var(--foreground)/0.08),_0_0_0_1px_hsl(var(--border))] transition-shadow duration-300 flex flex-col gap-3"
                >
                  {/* Icon badge */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gold/15 text-gold-dark dark:text-gold">
                    <Icon size={20} />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-1.5">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {feature.description}
                    </p>
                  </div>

                  {/* Live indicator */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">Available now</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* See all link */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
            className="flex justify-center mt-10"
          >
            <Link
              href="/features"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
              See all 12 capabilities
              <ArrowRight
                size={15}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
          </motion.div>
        </Container>
      </section>
    </MotionConfig>
  );
}
