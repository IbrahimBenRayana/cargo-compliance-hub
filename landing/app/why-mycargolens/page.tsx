import type { Metadata } from "next";
import { WhyMyCargoLensClient } from "./why-mycargolens-client";

export const metadata: Metadata = {
  title: "Why MyCargoLens",
  description:
    "Customs filing that feels like an inbox, not enterprise software. AI pre-flight review and a plain-English rejection coach, a calm modern interface for ISF, Entry, tracking, and HTS, and transparent per-shipment pricing — pay only when you file.",
};

export default function WhyMyCargoLensPage() {
  return <WhyMyCargoLensClient />;
}
