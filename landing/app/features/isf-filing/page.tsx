import type { Metadata } from "next";
import { ISFFilingClient } from "./isf-filing-client";

export const metadata: Metadata = {
  title: "ISF Filing",
  description:
    "File ISF 10+2 and ISF-5 directly to CBP in 90 seconds. Smart forms, real-time validation, amendment tracking, and instant CBP responses.",
};

export default function ISFFilingPage() {
  return <ISFFilingClient />;
}
