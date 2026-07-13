import type { Metadata } from "next";
import { SolutionsClient } from "./solutions-client";

export const metadata: Metadata = {
  title: "Solutions — by persona",
  description:
    "MyCargoLens for ops managers, customs brokerages, and freight forwarders. Same product, three angles — what you actually use, depending on who you are.",
  alternates: { canonical: "/solutions" },
};

export default function SolutionsPage() {
  return <SolutionsClient />;
}
