import type { Metadata } from "next";
import { PricingPageClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Per-shipment pricing for CBP compliance. No monthly fee — sign up free and pay per shipment filed, from $45.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
