import type { Metadata } from "next";
import { FilingsClient } from "./filings-client";

export const metadata: Metadata = {
  title: "Filings — ISF, Entry, In-Bond",
  description:
    "One wizard for every CBP filing type. ISF-10, ISF-5, Entry Summary, Entry, In-Bond. Templates and bulk submit built in. AI pre-flight before every send.",
};

export default function FilingsPage() {
  return <FilingsClient />;
}
