"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, BarChart3, TrendingUp } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { MacWindow } from "@/components/ui/mac-window";
import { PageHero } from "@/components/page-hero";
import { ComplianceScene } from "@/components/illustrations/compliance-scene";

const EASE = [0.22, 1, 0.36, 1] as const;

const SCORE_TIERS = [
  {
    range: "80–100",
    label: "Clean",
    color: "bg-green-500/15 border-green-500/25 text-green-700 dark:text-green-400",
    dot: "bg-green-500",
    description: "No issues found. Ready to submit.",
  },
  {
    range: "50–79",
    label: "Warning",
    color: "bg-amber-500/15 border-amber-500/25 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    description: "Minor issues that should be reviewed before submission.",
  },
  {
    range: "0–49",
    label: "Critical",
    color: "bg-red-500/15 border-red-500/25 text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    description: "Errors that will likely result in CBP rejection.",
  },
];

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Reduce rejection rates",
    description:
      "Catch issues before CBP does. Our pre-submission scoring dramatically lowers the rate of CBP rejections.",
  },
  {
    icon: BarChart3,
    title: "Prepare for CBP audits",
    description:
      "Full audit trail with compliance scores per filing. Export-ready for CBP or internal review at any time.",
  },
  {
    icon: TrendingUp,
    title: "Identify training gaps",
    description:
      "Track which team members and which shipment types generate the most issues. Target training where it matters.",
  },
];

export function ComplianceClient() {
  return (
    <>
      <PageHero
        label="COMPLIANCE"
        title="Catch problems before CBP does"
        description="Every filing scored, every issue flagged, every audit answered."
        breadcrumbs={[
          { label: "Features", href: "/features" },
          { label: "Compliance", href: "/features/compliance" },
        ]}
        illustration={<ComplianceScene className="w-full max-w-xs h-auto text-foreground/90" />}
      />

      {/* ── How scoring works ── */}
      <section className="py-14 md:py-20">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="max-w-3xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
              SCORING
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-5">
              How the 0–100 compliance score works
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-10">
              Before any filing reaches CBP, our engine runs it through a rule set that mirrors
              CBP&apos;s own validation logic. Every element — party data, commodity codes,
              consignee addresses, dates — is evaluated and weighted. The result is a single score
              from 0 to 100 that tells you exactly where you stand.
            </p>

            <div className="flex flex-col gap-3">
              {SCORE_TIERS.map((tier) => (
                <div
                  key={tier.label}
                  className={`flex items-center gap-4 rounded-xl border p-4 ${tier.color}`}
                >
                  <span className={`h-3 w-3 rounded-full shrink-0 ${tier.dot}`} />
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-bold text-sm">{tier.label}</span>
                    <span className="text-xs opacity-70">{tier.range}</span>
                    <span className="text-sm opacity-80">{tier.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ── Org-wide metrics ── */}
      <section className="py-14 md:py-16 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="max-w-3xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
              ORG-WIDE METRICS
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-5">
              Track compliance across your entire organization
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              The compliance center gives you more than per-filing scores. See your organization
              pass rate, average score across all filings, and how compliance trends over 7, 30,
              and 90-day windows. Spot problems early and measure the impact of fixes over time.
            </p>
          </motion.div>
        </Container>
      </section>

      {/* ── Screenshot ── */}
      <section className="py-14 md:py-20 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <MacWindow
              title="Compliance — MyCargoLens"
              urlBar="app.mycargolens.com/compliance"
            >
              <Image
                src="/screenshots/compliance.png"
                alt="MyCargoLens compliance center showing pass rate, average score, critical issues, and filing-level scores"
                width={2400}
                height={1500}
                className="w-full h-auto block"
              />
            </MacWindow>
          </motion.div>
        </Container>
      </section>

      {/* ── Benefits ── */}
      <section className="py-14 md:py-20 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Why compliance scoring matters
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BENEFITS.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                className="rounded-xl border border-border/60 bg-card/60 p-6"
              >
                <div className="flex items-center justify-center rounded-lg bg-primary/8 p-2.5 w-10 h-10 mb-4">
                  <benefit.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 md:py-20 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="text-center max-w-xl mx-auto"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              File smarter, not harder
            </h2>
            <p className="text-muted-foreground mb-8">
              Start with 2 free filings per month. Upgrade when you need more.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="gold" size="lg" asChild>
                <a
                  href="https://app.mycargolens.com/sign-up"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Start free
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/features">All features</Link>
              </Button>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  );
}
