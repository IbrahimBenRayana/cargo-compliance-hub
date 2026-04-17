"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Zap, Lock } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/page-hero";
import { AboutScene } from "@/components/illustrations/about-scene";

const EASE = [0.22, 1, 0.36, 1] as const;

const VALUES = [
  {
    icon: Eye,
    title: "Transparency",
    description:
      "No hidden fees. No broker markups passed through silently. No black-box filing processes. You see exactly what was filed, when, and what CBP said back.",
  },
  {
    icon: Zap,
    title: "Simplicity",
    description:
      "Compliance software has historically been complex because the underlying regulation is complex. We don't think those two things need to go together. Our job is to absorb the complexity so yours disappears.",
  },
  {
    icon: Lock,
    title: "Security",
    description:
      "CBP data is sensitive data. We treat it that way — encrypted at rest and in transit, SOC 2-aligned controls, and no data sharing with third parties. Ever.",
  },
];

export function AboutClient() {
  return (
    <>
      <PageHero
        label="COMPANY"
        title="Making CBP compliance simple for every importer"
        description="MyCargoLens was built because customs compliance shouldn't require a broker, a spreadsheet, and three phone calls."
        illustration={<AboutScene className="w-full max-w-xs h-auto text-foreground/90" />}
      />

      {/* ── Mission ── */}
      <section className="py-14 md:py-20">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="max-w-2xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-5">
              MISSION
            </p>
            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-5 text-muted-foreground leading-relaxed">
              <p className="text-base md:text-lg">
                Trade compliance in the US has been gated behind brokers and expensive enterprise
                software for decades. If you import goods — even a small number of shipments a year
                — you&apos;ve probably paid a customs broker $50–200 per Importer Security Filing, waited
                on email responses, and had no visibility into what was actually submitted or why CBP
                rejected it.
              </p>
              <p className="text-base md:text-lg">
                We built MyCargoLens to change that. Direct ACE integration, real-time CBP feedback,
                pre-submission validation, and a compliance record your team can actually understand.
                No middleman required.
              </p>
              <p className="text-base md:text-lg">
                We&apos;re starting with ISF filing — the first mandatory touchpoint for most ocean
                importers — and building outward from there. Entry Summary, Cargo Release, In-Bond,
                Drawback. The full picture. The whole stack. No switching tools.
              </p>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ── Values ── */}
      <section className="py-14 md:py-16 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="mb-10"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
              PRINCIPLES
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              What we believe
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VALUES.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.09, ease: EASE }}
                className="rounded-xl border border-border/60 bg-card/60 p-6"
              >
                <div className="flex items-center justify-center rounded-lg bg-primary/8 p-2.5 w-10 h-10 mb-4">
                  <value.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-semibold mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {value.description}
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
              See what we&apos;ve built
            </h2>
            <p className="text-muted-foreground mb-8">
              ISF filing is live. More coming soon.
            </p>
            <Button variant="gold" size="lg" asChild>
              <Link href="/features">Explore features</Link>
            </Button>
          </motion.div>
        </Container>
      </section>
    </>
  );
}
