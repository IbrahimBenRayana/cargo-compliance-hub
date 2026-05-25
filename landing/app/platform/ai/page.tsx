import type { Metadata } from "next";
import { AiClient } from "./ai-client";

export const metadata: Metadata = {
  title: "AI — Today's brief, Coach, HTS Classifier",
  description:
    "Today's brief. AI Coach explains every CBP rejection in plain English. AI Pre-flight catches issues before you submit. HTS Classifier finds the right code from a description. Built on gpt-4o.",
};

export default function AiPage() {
  return <AiClient />;
}
