import type { Metadata } from "next";
import { BookADemoClient } from "./book-a-demo-client";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "See MyCargoLens in action. Book a 20-minute demo and we'll set up your account on the right plan afterward.",
};

export default function BookADemoPage() {
  return <BookADemoClient />;
}
