import type { Metadata } from "next";
import { ChangelogClient } from "./changelog-client";

export const metadata: Metadata = {
  title: "Changelog — what shipped",
  description:
    "Recent releases of MyCargoLens. Hand-curated release notes, reverse chronological. We ship continuously.",
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  return <ChangelogClient />;
}
