import type { Metadata } from "next";
import { AutomationClient } from "./automation-client";

export const metadata: Metadata = {
  title: "Automation — CBP polling, webhooks, Federal Register sync",
  description:
    "Background work happening 24/7. CBP status polled every 5 min. Federal Register synced daily at 04:00 UTC. Deadline alerts every hour. Stale-check sweeps every 6 hours. Filing-status webhooks to your own systems, plus multi-user roles and notifications.",
  alternates: { canonical: "/platform/automation" },
};

export default function AutomationPage() {
  return <AutomationClient />;
}
