import type { Metadata } from "next";
import { FilingsClient } from "./filings-client";

export const metadata: Metadata = {
  title: "Filings: ISF and Entry",
  description:
    "One wizard for every CBP filing type. ISF-10, ISF-5, Entry Summary, and Entry. Templates and bulk submit built in. AI pre-flight before every send. File from your own stack via the public REST API.",
  alternates: { canonical: "/platform/filings" },
};

export default function FilingsPage() {
  return <FilingsClient />;
}
