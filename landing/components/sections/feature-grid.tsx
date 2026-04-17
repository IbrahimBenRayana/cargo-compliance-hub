"use client";

import { useState } from "react";
import {
  motion,
  AnimatePresence,
  MotionConfig,
  type Variants,
} from "framer-motion";
import {
  Ship,
  FileCheck,
  BarChart3,
  Users,
  ShieldCheck,
  FileText,
  PackageOpen,
  Truck,
  Anchor,
  Sparkles,
  CircleDollarSign,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";

type Status = "live" | "q3-2026" | "q4-2026" | "2027";
type FilterTab = "all" | "live" | "coming";

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
  status: Status;
}

const FEATURES: Feature[] = [
  {
    title: "ISF 10+2 Filing",
    description:
      "Importer Security Filing for ocean cargo. Full 10+2 data elements with validation against CBP rules.",
    icon: Ship,
    status: "live",
  },
  {
    title: "ISF-5 Filing",
    description:
      "Simplified ISF-5 for FROB, IE, and T&E shipments. Built in the same unified workflow.",
    icon: FileCheck,
    status: "live",
  },
  {
    title: "Compliance Dashboard",
    description:
      "Real-time view of every filing's CBP status. Spot issues before they become penalties.",
    icon: BarChart3,
    status: "live",
  },
  {
    title: "Team & Multi-Org",
    description:
      "Invite your team, manage multiple importer accounts, granular permissions per user.",
    icon: Users,
    status: "live",
  },
  {
    title: "Audit Trail",
    description:
      "Immutable log of every filing, amendment, and CBP response. Export-ready for auditors.",
    icon: ShieldCheck,
    status: "live",
  },
  {
    title: "Entry Summary (7501)",
    description:
      "Full CF-7501 entry summary filing with HTS classification assist and duty estimation.",
    icon: FileText,
    status: "q3-2026",
  },
  {
    title: "Cargo Release (3461)",
    description:
      "CF-3461 entry filing for customs clearance at the port. Integrated with your ISF data.",
    icon: PackageOpen,
    status: "q3-2026",
  },
  {
    title: "In-Bond Filing (7512)",
    description:
      "CF-7512 for moving cargo in-bond across the US. Track movements end-to-end.",
    icon: Truck,
    status: "q4-2026",
  },
  {
    title: "Manifest Filing (AMS)",
    description:
      "Automated Manifest System filing for ocean carriers and NVOCCs.",
    icon: Anchor,
    status: "q4-2026",
  },
  {
    title: "HTSUS Classifier",
    description:
      "AI-assisted HTS code classification with historical match lookup and binding ruling cross-reference.",
    icon: Sparkles,
    status: "q4-2026",
  },
  {
    title: "Drawback",
    description:
      "Full drawback claim management. Track eligibility, calculate refunds, file directly with CBP.",
    icon: CircleDollarSign,
    status: "2027",
  },
  {
    title: "AD/CVD Tracking",
    description:
      "Anti-dumping and countervailing duty monitoring with automated scope ruling alerts.",
    icon: AlertCircle,
    status: "2027",
  },
];

const BADGE_MAP: Record<Status, { label: string; dotClass: string }> = {
  live: { label: "Available", dotClass: "bg-emerald-500" },
  "q3-2026": { label: "Coming Q3 2026", dotClass: "bg-amber-400" },
  "q4-2026": { label: "Coming Q4 2026", dotClass: "bg-amber-400" },
  "2027": { label: "Coming 2027", dotClass: "bg-slate-400" },
};

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Available now" },
  { id: "coming", label: "Coming soon" },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export function FeatureGrid() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filtered = FEATURES.filter((f) => {
    if (activeTab === "all") return true;
    if (activeTab === "live") return f.status === "live";
    return f.status !== "live";
  });

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
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Capabilities
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mt-3 mb-4"
            >
              One platform. Every CBP filing you need.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-muted-foreground max-w-xl mx-auto"
            >
              Available and coming soon — you&apos;re never locked out of future
              filings.
            </motion.p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {activeTab === tab.id && (
                  <motion.span
                    layoutId="feature-tab-indicator"
                    className="absolute inset-0 rounded-full bg-primary text-primary-foreground dark:bg-gold dark:text-yellow-950"
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <span
                  className={`relative z-10 ${
                    activeTab === tab.id
                      ? "text-primary-foreground dark:text-yellow-950"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filtered.map((feature) => {
                const Icon = feature.icon;
                const badge = BADGE_MAP[feature.status];
                const isLive = feature.status === "live";

                return (
                  <motion.div
                    key={feature.title}
                    variants={cardVariants}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className="relative rounded-2xl border border-border/60 p-6 bg-card/50 hover:shadow-[0_4px_6px_-1px_hsl(var(--foreground)/0.06),_0_12px_20px_-4px_hsl(var(--foreground)/0.08),_0_0_0_1px_hsl(var(--border))] transition-shadow duration-300 flex flex-col gap-3"
                  >
                    {/* Icon badge */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isLive
                          ? "bg-gold/15 text-gold-dark dark:text-gold"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
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

                    {/* Status badge */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dotClass}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {badge.label}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </Container>
      </section>
    </MotionConfig>
  );
}
