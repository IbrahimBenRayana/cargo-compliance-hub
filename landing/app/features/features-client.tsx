"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  Package,
  Truck,
  ClipboardList,
  ScrollText,
  Tag,
  RotateCcw,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { MacWindow } from "@/components/ui/mac-window";
import { PageHero } from "@/components/page-hero";
import { FeaturesScene } from "@/components/illustrations/features-scene";

const EASE = [0.22, 1, 0.36, 1] as const;

interface FeatureBlock {
  label: string;
  headline: string;
  body: string;
  bullets: string[];
  image: { src: string; alt: string; title: string; urlBar: string };
  imagePosition: "left" | "right";
  ctaLabel: string;
  ctaHref: string;
}

const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    label: "ISF FILING",
    headline: "ISF 10+2 and ISF-5 filing — done right.",
    body: "Create, validate, and submit Importer Security Filings directly to CBP. Smart forms, real-time validation, amendment tracking, and instant CBP responses.",
    bullets: [
      "90-second average filing time",
      "Built-in CBP rule validation",
      "Amendments and cancellations — always free",
    ],
    image: {
      src: "/screenshots/shipments.png",
      alt: "MyCargoLens shipments list showing ISF filing workflow",
      title: "Shipments — MyCargoLens",
      urlBar: "app.mycargolens.com/shipments",
    },
    imagePosition: "right",
    ctaLabel: "Learn more about ISF filing →",
    ctaHref: "/features/isf-filing",
  },
  {
    label: "COMPLIANCE",
    headline: "Know your compliance score before CBP does.",
    body: "Every filing is scored against CBP requirements before submission. Critical issues, warnings, and clean records — surfaced instantly.",
    bullets: [
      "Per-filing compliance scoring (0-100)",
      "Critical / Warning / Clean classification",
      "Organization-wide pass rate tracking",
    ],
    image: {
      src: "/screenshots/compliance.png",
      alt: "MyCargoLens compliance center showing pass rate and scoring",
      title: "Compliance — MyCargoLens",
      urlBar: "app.mycargolens.com/compliance",
    },
    imagePosition: "left",
    ctaLabel: "Explore compliance tools →",
    ctaHref: "/features/compliance",
  },
  {
    label: "DASHBOARD",
    headline: "One view for your entire operation.",
    body: "Live metrics, filing activity trends, deadline tracking, and team performance — all in a dashboard designed for compliance teams that move fast.",
    bullets: [
      "Real-time CBP status updates",
      "Upcoming deadline alerts",
      "7/30/90-day filing trends",
    ],
    image: {
      src: "/screenshots/dashboard.png",
      alt: "MyCargoLens dashboard showing live metrics and filing activity",
      title: "Dashboard — MyCargoLens",
      urlBar: "app.mycargolens.com/dashboard",
    },
    imagePosition: "right",
    ctaLabel: "See the dashboard →",
    ctaHref: "/features/team",
  },
];

const COMING_SOON = [
  {
    icon: Package,
    title: "Entry Summary",
    date: "Q3 2026",
    description: "File CBP Form 7501 for formal and informal entries.",
  },
  {
    icon: Truck,
    title: "Cargo Release",
    date: "Q3 2026",
    description: "Automated cargo release requests and status tracking.",
  },
  {
    icon: ClipboardList,
    title: "In-Bond Filing",
    date: "Q4 2026",
    description: "Manage in-bond movements with full CBP integration.",
  },
  {
    icon: ScrollText,
    title: "Manifest Filing",
    date: "Q4 2026",
    description: "Submit vessel, air, and rail manifests directly.",
  },
  {
    icon: Tag,
    title: "HTSUS Classifier",
    date: "Q4 2026",
    description: "AI-assisted HTS code lookup and duty rate estimation.",
  },
  {
    icon: RotateCcw,
    title: "Drawback",
    date: "2027",
    description: "Automated duty drawback claims and tracking.",
  },
];

export function FeaturesPageClient() {
  return (
    <>
      <PageHero
        label="PLATFORM"
        title="Everything you need for CBP compliance"
        description="One platform for every filing type, every team member, every audit. Start with ISF — expand as we build."
        illustration={<FeaturesScene className="w-full max-w-xs h-auto text-foreground/90" />}
      />

      {/* ── Feature blocks ── */}
      <section className="py-16 md:py-24">
        <Container>
          <div className="flex flex-col gap-20 md:gap-28">
            {FEATURE_BLOCKS.map((block) => (
              <motion.div
                key={block.headline}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.65, ease: EASE }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center"
              >
                {/* Text column */}
                <div
                  className={`lg:col-span-5 ${
                    block.imagePosition === "left" ? "lg:order-2" : "lg:order-1"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                    {block.label}
                  </p>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground mb-5 leading-tight">
                    {block.headline}
                  </h2>
                  <p className="text-base md:text-lg text-muted-foreground mb-6 leading-relaxed">
                    {block.body}
                  </p>
                  <ul className="space-y-2.5 mb-7">
                    {block.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-sm text-foreground/90"
                      >
                        <Check
                          className="h-4 w-4 text-gold shrink-0 mt-0.5"
                          strokeWidth={2.5}
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={block.ctaHref}
                    className="text-sm font-medium text-gold hover:text-gold/80 transition-colors"
                  >
                    {block.ctaLabel}
                  </Link>
                </div>

                {/* Screenshot column */}
                <div
                  className={`lg:col-span-7 relative ${
                    block.imagePosition === "left" ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className="absolute -inset-6 -z-10 rounded-[2rem]"
                    style={{
                      background:
                        "radial-gradient(circle at center, hsl(43 96% 56% / 0.08) 0%, transparent 70%)",
                    }}
                  />
                  <MacWindow title={block.image.title} urlBar={block.image.urlBar}>
                    <Image
                      src={block.image.src}
                      alt={block.image.alt}
                      width={2400}
                      height={1500}
                      className="w-full h-auto block"
                    />
                  </MacWindow>
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Coming soon ── */}
      <section className="py-16 md:py-20 border-t border-border/60">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="max-w-2xl mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              More capabilities, coming soon
            </h2>
            <p className="text-muted-foreground">
              {`We're building the complete CBP compliance suite. Here's what's next.`}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMING_SOON.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
                className="rounded-xl border border-border/60 bg-card/60 p-5 flex items-start gap-4"
              >
                <div className="shrink-0 flex items-center justify-center rounded-lg bg-muted/60 p-2.5">
                  <item.icon
                    className="h-4 w-4 text-muted-foreground/60"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground/80">
                      {item.title}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Coming {item.date}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
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
              Ready to start filing?
            </h2>
            <p className="text-muted-foreground mb-8">
              Free plan includes 2 ISF filings per month. No credit card required.
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
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  );
}
