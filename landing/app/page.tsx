"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HeroBackground } from "@/components/sections/hero-background";
import { HeroScene } from "@/components/illustrations/hero-scene";
import { StatsStrip } from "@/components/sections/stats-strip";
import { FeatureHighlights } from "@/components/sections/feature-highlights";
import { ProductTour } from "@/components/sections/product-tour";
import { SolutionsCallout } from "@/components/sections/solutions-callout";
import { PricingPreview } from "@/components/sections/pricing-preview";
import { ClosingCta } from "@/components/sections/closing-cta";
import { SectionDivider } from "@/components/ui/section-divider";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-28 lg:py-32">
        <HeroBackground />
        <Container className="relative z-10">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Text column */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left"
            >
              {/* Label */}
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-6">
                Overview
              </span>

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6 leading-[1.08]">
                The complete CBP compliance platform for{" "}
                <span className="text-gradient-gold">modern importers</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 leading-relaxed">
                File ISF, Entry, and In-Bond with confidence. One secure workspace
                for your entire customs workflow — from classification to release.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                <Button variant="gold" size="lg" asChild>
                  <a href="https://app.mycargolens.com/register">Start free</a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/pricing">See pricing</Link>
                </Button>
              </div>

              {/* Fine print */}
              <p className="text-xs text-muted-foreground">
                Free forever plan &bull; No credit card required
              </p>
            </motion.div>

            {/* Illustration column */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-6 flex items-center justify-center"
            >
              <HeroScene className="w-full max-w-xl h-auto text-foreground/90" />
            </motion.div>
          </div>
        </Container>
      </section>

      {/* StatsStrip */}
      <div className="bg-muted/30">
        <StatsStrip />
      </div>

      <SectionDivider />

      {/* Feature Highlights — id="features" is set on the section root inside the component */}
      <FeatureHighlights />

      <SectionDivider />

      {/* Product Tour */}
      <div className="bg-muted/30">
        <ProductTour />
      </div>

      <SectionDivider />

      {/* Solutions by role */}
      <SolutionsCallout />

      <SectionDivider />

      {/* Pricing Preview */}
      <div id="pricing" className="bg-muted/30">
        <PricingPreview />
      </div>

      <SectionDivider />

      <ClosingCta />
    </>
  );
}
