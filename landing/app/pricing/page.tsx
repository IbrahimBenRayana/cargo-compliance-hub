import type { Metadata } from "next";
import { PricingPageClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing — MyCargoLens",
  description:
    "Simple, filings-based pricing for CBP compliance. Start free with 2 filings per month. Scale when you're ready.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
