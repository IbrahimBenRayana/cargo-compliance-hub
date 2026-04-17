"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, DollarSign } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { MacWindow } from "@/components/ui/mac-window";
import { PageHero } from "@/components/page-hero";
import { IsfScene } from "@/components/illustrations/isf-scene";

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    step: "01",
    title: "Enter shipment data",
    description:
      "Smart forms with BOL lookup, auto-fill from past filings, and template support make data entry fast and accurate.",
  },
  {
    step: "02",
    title: "Validate against CBP rules",
    description:
      "Our engine checks all 10+2 elements for completeness, format, and consistency — before you submit.",
  },
  {
    step: "03",
    title: "Submit to CBP",
    description:
      "One-click transmission via our direct ACE connection. No middleware, no broker markup.",
  },
  {
    step: "04",
    title: "Track in real-time",
    description:
      "CBP acceptance, rejection, amendment status — all live in your dashboard the moment CBP responds.",
  },
];

const ISF_DETAIL_CARDS = [
  { label: "10", description: "data elements from the importer" },
  { label: "2", description: "data elements from the carrier" },
  { label: "24h", description: "advance filing requirement" },
];

export function ISFFilingClient() {
  return (
    <>
      <PageHero
        label="ISF FILING"
        title="File ISF 10+2 and ISF-5 with confidence"
        description="The same regulatory filing your broker charges $50 for — filed by you in 90 seconds, with full validation and real-time CBP tracking."
        breadcrumbs={[
          { label: "Features", href: "/features" },
          { label: "ISF Filing", href: "/features/isf-filing" },
        ]}
        illustration={<IsfScene className="w-full max-w-xs h-auto text-foreground/90" />}
      />

      {/* ── What is ISF? ── */}
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
              BACKGROUND
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-5">
              What is ISF?
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
              Importer Security Filing (ISF), also known as 10+2, is required by CBP for all ocean
              cargo entering the US. It must be filed at least 24 hours before vessel loading. Late
              or inaccurate filings can result in penalties starting at $5,000.
            </p>

            {/* Detail cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {ISF_DETAIL_CARDS.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-border/60 bg-card/60 p-5 text-center"
                >
                  <p className="text-3xl font-bold text-gold mb-1">{card.label}</p>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ── How MyCargoLens handles ISF ── */}
      <section className="py-14 md:py-20 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="mb-12"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
              HOW IT WORKS
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-xl">
              How MyCargoLens handles ISF
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                className="rounded-xl border border-border/60 bg-card/60 p-6"
              >
                <span className="text-xs font-bold text-gold/70 tracking-widest mb-3 block">
                  {step.step}
                </span>
                <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── ISF-5 support ── */}
      <section className="py-14 md:py-16 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="flex items-start gap-4 max-w-2xl rounded-xl border border-border/60 bg-card/60 p-6"
          >
            <Check
              className="h-5 w-5 text-gold shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <div>
              <h3 className="text-base font-semibold mb-1.5">ISF-5 also supported</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ISF-5 (simplified filing for FROB, IE, and T&amp;E shipments) is fully supported in
                the same workflow. Switch filing types with one click — no separate tools needed.
              </p>
            </div>
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
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-10 rounded-[2rem] hidden lg:block"
              style={{
                background:
                  "radial-gradient(circle at center, hsl(43 96% 56% / 0.07) 0%, transparent 70%)",
              }}
            />
            <MacWindow
              title="Shipments — MyCargoLens"
              urlBar="app.mycargolens.com/shipments"
            >
              <Image
                src="/screenshots/shipments.png"
                alt="MyCargoLens shipments list showing ISF filing status and management"
                width={2400}
                height={1500}
                className="w-full h-auto block"
              />
            </MacWindow>
          </motion.div>
        </Container>
      </section>

      {/* ── Pricing callout ── */}
      <section className="py-12 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-start gap-4 max-w-2xl rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"
          >
            <DollarSign
              className="h-5 w-5 text-amber-500 shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <p className="text-sm text-foreground/80 leading-relaxed">
              ISF filing starts with the{" "}
              <span className="font-semibold">free plan (2 filings/month)</span>. Need more?{" "}
              <Link
                href="/pricing"
                className="text-gold hover:text-gold/80 underline underline-offset-2 transition-colors"
              >
                View pricing →
              </Link>
            </p>
          </motion.div>
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
              Start filing ISFs today
            </h2>
            <p className="text-muted-foreground mb-8">
              No broker. No spreadsheet. No phone calls. Just file.
            </p>
            <Button variant="gold" size="lg" asChild>
              <a
                href="https://app.mycargolens.com/sign-up"
                target="_blank"
                rel="noopener noreferrer"
              >
                Start free
              </a>
            </Button>
          </motion.div>
        </Container>
      </section>
    </>
  );
}
