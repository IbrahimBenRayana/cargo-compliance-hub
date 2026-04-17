"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { MacWindow } from "@/components/ui/mac-window";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Block {
  label: string;
  headline: string;
  body: string;
  bullets: string[];
  image: {
    src: string;
    alt: string;
    title: string;
    urlBar: string;
  };
  imagePosition: "left" | "right";
}

const BLOCKS: Block[] = [
  {
    label: "AT A GLANCE",
    headline: "Know where every filing stands.",
    body: "One dashboard. Live metrics. No more spreadsheet roll-ups or status emails. Compliance rate, at-CBP queue, rejected filings needing attention — all surfaced the moment something changes.",
    bullets: [
      "Live CBP acceptance rate + trend",
      "Deadline tracker with overdue flags",
      "30-day filing activity chart",
    ],
    image: {
      src: "/screenshots/dashboard.png",
      alt: "MyCargoLens dashboard showing total filings, compliance rate, filings at CBP, items needing attention, upcoming deadlines, and 30-day activity chart",
      title: "Dashboard — MyCargoLens",
      urlBar: "app.mycargolens.com/dashboard",
    },
    imagePosition: "right",
  },
  {
    label: "AT SCALE",
    headline: "Filter, sort, and act — on thousands of shipments.",
    body: "Built for teams that file 50 or 500 per month. Tabs by status, instant search across BOL, importer, product, or ISF ID. Your whole filing pipeline, one keystroke away.",
    bullets: [
      "Status tabs with live counts",
      "Full-text search + port-of-origin filters",
      "Bulk select, bulk edit, bulk file",
    ],
    image: {
      src: "/screenshots/shipments.png",
      alt: "MyCargoLens shipments list with status tabs, filterable table, and detailed columns for BOL, importer, product, origin, status, and deadlines",
      title: "Shipments — MyCargoLens",
      urlBar: "app.mycargolens.com/shipments",
    },
    imagePosition: "left",
  },
  {
    label: "AUDIT-READY",
    headline: "Catch problems before CBP does.",
    body: "Every filing gets a compliance score before it goes out. The engine flags critical issues, warnings, and clean records at a glance — so you never submit a 10+2 with a missing HTS code or a bad manufacturer address.",
    bullets: [
      "Per-filing compliance scoring (0-100)",
      "Critical / Warning / Clean classification",
      "One-click drill-down to specific issues",
    ],
    image: {
      src: "/screenshots/compliance.png",
      alt: "MyCargoLens compliance center showing pass rate, average score, critical issues, warnings, and a grid of filings with compliance scores",
      title: "Compliance — MyCargoLens",
      urlBar: "app.mycargolens.com/compliance",
    },
    imagePosition: "right",
  },
];

export function ProductTour() {
  return (
    <section id="product" className="py-24 md:py-32">
      <Container>
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-20">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4"
          >
            Take a look
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
            className="text-3xl md:text-5xl font-semibold tracking-tight mb-5"
          >
            Built for the way your team actually works.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
            className="text-lg text-muted-foreground leading-relaxed"
          >
            Every screen is designed to give you answers, not more questions.
            Here&apos;s what filing day looks like.
          </motion.p>
        </div>

        {/* Blocks */}
        <div className="flex flex-col gap-20 md:gap-28">
          {BLOCKS.map((block) => (
            <div
              key={block.headline}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center"
            >
              {/* Text column */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, ease: EASE }}
                className={`lg:col-span-5 ${
                  block.imagePosition === "left" ? "lg:order-2" : "lg:order-1"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                  {block.label}
                </p>
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground mb-5 leading-tight">
                  {block.headline}
                </h3>
                <p className="text-base md:text-lg text-muted-foreground mb-6 leading-relaxed">
                  {block.body}
                </p>
                <ul className="space-y-2.5">
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
              </motion.div>

              {/* Screenshot column */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
                className={`lg:col-span-7 relative ${
                  block.imagePosition === "left" ? "lg:order-1" : "lg:order-2"
                }`}
              >
                {/* Gold halo */}
                <div
                  aria-hidden="true"
                  className="absolute -inset-6 -z-10 rounded-[2rem]"
                  style={{
                    background:
                      "radial-gradient(circle at center, hsl(43 96% 56% / 0.10) 0%, transparent 70%)",
                  }}
                />
                <MacWindow
                  title={block.image.title}
                  urlBar={block.image.urlBar}
                >
                  <Image
                    src={block.image.src}
                    alt={block.image.alt}
                    width={2400}
                    height={1500}
                    className="w-full h-auto block"
                    priority={false}
                  />
                </MacWindow>
              </motion.div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
