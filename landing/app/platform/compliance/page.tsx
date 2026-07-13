import type { Metadata } from "next";
import { ComplianceClient } from "./compliance-client";

export const metadata: Metadata = {
  title: "Compliance Center — UFLPA, ADD/CVD, Liquidation",
  description:
    "An inbox for US customs compliance. Action queue, UFLPA risk inbox, ADD/CVD daily sync from the Federal Register, FTA preference calculator (17 programs), and 314-day liquidation pipeline.",
  alternates: { canonical: "/platform/compliance" },
};

export default function CompliancePage() {
  return <ComplianceClient />;
}
