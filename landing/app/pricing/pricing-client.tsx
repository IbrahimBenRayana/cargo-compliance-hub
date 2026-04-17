"use client";

import { Check } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { PricingScene } from "@/components/illustrations/pricing-scene";
import { PricingCards } from "@/components/pricing/pricing-cards";
import { ComparisonTable } from "@/components/pricing/comparison-table";
import { EnterpriseCta } from "@/components/pricing/enterprise-cta";
import { PricingFaq } from "@/components/pricing/pricing-faq";

const TRUST_BADGES = [
  "No credit card required",
  "Cancel any time",
  "Transparent overage pricing",
];

export function PricingPageClient() {
  return (
    <>
      <PageHero
        label="PRICING"
        title="Priced by filings. Nothing sneaky."
        description="Start free, upgrade when you need more volume. No per-feature gotchas, no setup fees, no long-term contracts. Cancel anytime."
        illustration={<PricingScene className="w-full max-w-xs h-auto text-foreground/90" />}
      >
        <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
          {TRUST_BADGES.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 border border-border/60 bg-card shadow-sm text-xs font-medium text-foreground/80"
            >
              <Check className="h-3 w-3 text-gold shrink-0" strokeWidth={3} />
              {badge}
            </span>
          ))}
        </div>
      </PageHero>
      <PricingCards />
      <ComparisonTable />
      <EnterpriseCta />
      <PricingFaq />
    </>
  );
}
