import type { Metadata } from "next";
import { FeaturesPageClient } from "./features-client";

export const metadata: Metadata = {
  title: "Features",
  description:
    "ISF filing, compliance dashboard, team management, audit trail, and more — all the CBP compliance tools you need in one platform.",
};

export default function FeaturesPage() {
  return <FeaturesPageClient />;
}
