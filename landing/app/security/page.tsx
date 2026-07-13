import type { Metadata } from "next";
import { SecurityClient } from "./security-client";

export const metadata: Metadata = {
  title: "Security & trust",
  description:
    "How MyCargoLens keeps your customs data safe. Authentication, RBAC, encryption, data residency, audit trail, and the third-party vendors we use.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return <SecurityClient />;
}
