import type { Metadata } from "next";
import { AiClient } from "./ai-client";

export const metadata: Metadata = {
  title: "AI — Assistant, Coach, HTS Classifier",
  description:
    "An AI assistant on every page: it deep-links you to the right screen, answers from your own org's filings, and hands off to a live human specialist. AI Coach explains every CBP rejection in plain English. Pre-flight catches issues before you submit. HTS Classifier finds the right code.",
  alternates: { canonical: "/platform/ai" },
};

export default function AiPage() {
  return <AiClient />;
}
