import type { Metadata } from "next";
import { ComplianceClient } from "./compliance-client";

export const metadata: Metadata = {
  title: "Compliance",
  description:
    "Every filing scored against CBP requirements before submission. Catch critical issues, warnings, and track organization-wide pass rates.",
};

export default function CompliancePage() {
  return <ComplianceClient />;
}
