import type { Metadata } from "next";
import { LifecycleClient } from "./lifecycle-client";

export const metadata: Metadata = {
  title: "Lifecycle — Timeline, score history, PDF export",
  description:
    "Per-filing timeline from created to liquidated. Compliance score sparkline with event ticker. CBP rejections translated into plain English. ISF→ABI→manifest chain. PDF export at any stage.",
};

export default function LifecyclePage() {
  return <LifecycleClient />;
}
