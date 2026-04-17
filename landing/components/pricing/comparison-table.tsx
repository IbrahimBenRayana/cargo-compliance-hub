"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  Minus,
  Zap,
  LayoutGrid,
  Users,
  Headphones,
  ShieldCheck,
} from "lucide-react";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

type CellValue = boolean | string | null;

const CheckBadge = () => (
  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/10 mx-auto">
    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
  </span>
);

const MissingBadge = () => (
  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/40 mx-auto">
    <Minus className="h-3.5 w-3.5 text-muted-foreground/60" />
  </span>
);

function Cell({ value }: { value: CellValue }) {
  if (value === true) return <div className="flex justify-center"><CheckBadge /></div>;
  if (value === false || value === null) return <div className="flex justify-center"><MissingBadge /></div>;

  const isComingSoon = value === "Coming soon";
  return (
    <div className="flex justify-center">
      {isComingSoon ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
          {value}
        </span>
      ) : (
        <span className="text-sm font-medium text-foreground/90">{value}</span>
      )}
    </div>
  );
}

type TableSection = {
  category: string;
  icon: React.ReactNode;
  rows: { feature: string; starter: CellValue; grower: CellValue; scale: CellValue }[];
};

const TABLE_DATA: TableSection[] = [
  {
    category: "USAGE",
    icon: <Zap className="h-3.5 w-3.5" />,
    rows: [
      { feature: "ISF filings/month", starter: "2", grower: "15", scale: "60" },
      { feature: "Overage rate", starter: null, grower: "$8/filing", scale: "$8/filing" },
      { feature: "ISF 10+2", starter: true, grower: true, scale: true },
      { feature: "ISF-5", starter: true, grower: true, scale: true },
    ],
  },
  {
    category: "FEATURES",
    icon: <LayoutGrid className="h-3.5 w-3.5" />,
    rows: [
      { feature: "Live dashboard", starter: true, grower: true, scale: true },
      { feature: "Compliance center", starter: "Basic", grower: "Full", scale: "Full" },
      { feature: "Templates", starter: null, grower: true, scale: true },
      { feature: "Bulk CSV import", starter: null, grower: null, scale: true },
      { feature: "API access", starter: null, grower: null, scale: true },
      { feature: "Custom roles", starter: null, grower: null, scale: true },
    ],
  },
  {
    category: "TEAM & ACCESS",
    icon: <Users className="h-3.5 w-3.5" />,
    rows: [
      { feature: "Team members", starter: "1", grower: "3", scale: "10" },
      { feature: "Multi-org workspace", starter: null, grower: true, scale: true },
      { feature: "SSO (Google, Microsoft)", starter: null, grower: null, scale: "Coming soon" },
    ],
  },
  {
    category: "SUPPORT & SLA",
    icon: <Headphones className="h-3.5 w-3.5" />,
    rows: [
      { feature: "Email support", starter: true, grower: true, scale: true },
      { feature: "Chat support", starter: null, grower: true, scale: true },
      { feature: "Response SLA", starter: "Best effort", grower: "24h", scale: "4h" },
      { feature: "Dedicated success manager", starter: null, grower: null, scale: null },
    ],
  },
  {
    category: "COMPLIANCE",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    rows: [
      { feature: "Audit trail", starter: true, grower: true, scale: true },
      { feature: "CSV exports", starter: null, grower: true, scale: true },
      { feature: "Retention", starter: "30 days", grower: "1 year", scale: "3 years" },
      { feature: "SOC 2 report access", starter: null, grower: null, scale: "On request" },
    ],
  },
];

export function ComparisonTable() {
  return (
    <section className="py-16 md:py-24 bg-mesh">
      <Container>
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            COMPARE PLANS
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Feature by feature
          </h2>
          <p className="mt-3 text-muted-foreground text-base max-w-xl mx-auto">
            A full breakdown of what&apos;s included at each tier.
          </p>
        </div>

        {/* Outer card panel */}
        <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-card relative">
          {/* Scroll container */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              {/* Sticky header */}
              <thead>
                <tr className="border-b border-border/60">
                  <th className="min-w-[260px] py-5 px-6 text-left sticky top-16 z-20 bg-card/95 backdrop-blur-sm">
                    <span className="text-sm font-semibold text-foreground">Feature</span>
                  </th>
                  {/* Starter */}
                  <th className="min-w-[140px] py-5 px-4 text-center sticky top-16 z-20 bg-card/95 backdrop-blur-sm">
                    <span className="block text-sm font-semibold text-foreground">Starter</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">Free</span>
                  </th>
                  {/* Grower — highlighted column */}
                  <th className="min-w-[140px] py-5 px-4 text-center sticky top-16 z-20 bg-gradient-to-b from-gold/10 to-gold/5 border-l border-r border-gold/20">
                    <span className="block text-sm font-semibold text-gold">Grower</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">$99/mo</span>
                  </th>
                  {/* Scale */}
                  <th className="min-w-[140px] py-5 px-4 text-center sticky top-16 z-20 bg-card/95 backdrop-blur-sm">
                    <span className="block text-sm font-semibold text-foreground">Scale</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">$299/mo</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {TABLE_DATA.map((section, sectionIdx) => (
                  <React.Fragment key={section.category}>
                    {/* Category header row */}
                    <motion.tr
                      key={`cat-${section.category}`}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{
                        duration: 0.5,
                        delay: sectionIdx * 0.05,
                        ease: EASE,
                      }}
                    >
                      <td
                        colSpan={4}
                        className="py-3 px-6"
                        style={{
                          background:
                            "linear-gradient(to right, hsl(43 96% 56% / 0.06), transparent 60%)",
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gold-dark dark:text-gold">
                          {section.icon}
                          {section.category}
                        </span>
                      </td>
                    </motion.tr>

                    {/* Feature rows */}
                    {section.rows.map((row, rowIdx) => {
                      const globalIdx =
                        TABLE_DATA.slice(0, sectionIdx).reduce(
                          (acc, s) => acc + s.rows.length,
                          0
                        ) + rowIdx;
                      return (
                        <motion.tr
                          key={`${section.category}-${row.feature}`}
                          initial={{ opacity: 0, y: 6 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-30px" }}
                          transition={{
                            duration: 0.3,
                            delay: globalIdx * 0.03,
                            ease: EASE,
                          }}
                          className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors duration-150 cursor-default"
                        >
                          <td className="text-sm text-foreground/90 font-medium py-4 px-6">
                            {row.feature}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Cell value={row.starter} />
                          </td>
                          <td className="py-4 px-4 text-center bg-gold/[0.04] border-l border-r border-gold/20">
                            <Cell value={row.grower} />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Cell value={row.scale} />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Below-table link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need higher volume or custom terms?{" "}
          <Link
            href="#enterprise"
            className="text-gold hover:text-gold-dark underline-offset-4 hover:underline font-medium transition-colors"
          >
            Talk to sales →
          </Link>
        </p>
      </Container>
    </section>
  );
}
