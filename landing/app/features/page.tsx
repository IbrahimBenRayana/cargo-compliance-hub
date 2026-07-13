import type { Metadata } from "next";
import { FeaturesClient } from "./features-client";

export const metadata: Metadata = {
  title: "Features",
  description:
    "ISF filing, compliance dashboard, team management, audit trail, and more — all the CBP compliance tools you need in one platform.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return <FeaturesClient />;
}
