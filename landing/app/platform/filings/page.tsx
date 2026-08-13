import type { Metadata } from "next";
import { FilingsClient } from "./filings-client";

export const metadata: Metadata = {
  title: "Filings — ISF, Entry, Type 86, In-Bond",
  description:
    "One wizard for every CBP filing type. ISF-10, ISF-5, Entry Summary, Entry, In-Bond, and Type 86 (Section 321) e-commerce entries. Templates and bulk submit built in. AI pre-flight before every send. File from your own stack via the public REST API.",
  alternates: { canonical: "/platform/filings" },
};

export default function FilingsPage() {
  return <FilingsClient />;
}
