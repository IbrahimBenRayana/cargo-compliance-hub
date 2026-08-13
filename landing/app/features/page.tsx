import type { Metadata } from "next";
import { FeaturesClient } from "./features-client";

export const metadata: Metadata = {
  title: "Features",
  description:
    "ISF filing, Type 86 e-commerce entries, compliance dashboard, AI assistant, team management, audit trail, and a public REST API for brokers and 3PLs — all the CBP compliance tools you need in one platform.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return <FeaturesClient />;
}
