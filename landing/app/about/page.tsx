import type { Metadata } from "next";
import { AboutClient } from "./about-client";

export const metadata: Metadata = {
  title: "About",
  description:
    "MyCargoLens was built because customs compliance shouldn't require a broker, a spreadsheet, and three phone calls.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <AboutClient />;
}
