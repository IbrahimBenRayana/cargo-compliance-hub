// Server entry for the home route (audit Phase 9.3).
//
// Pre-Phase-9 app/page.tsx was a client component, which meant the
// route inherited only the root layout's title/description without any
// per-page metadata refinement. Splitting into a thin server page that
// composes a client HomeClient lets us export route-level metadata
// (canonical, openGraph overrides, twitter) without losing the
// interactive sections.
import type { Metadata } from "next";
import HomeClient from "./home-client";

export const metadata: Metadata = {
  title: "MyCargoLens — CBP Compliance Platform",
  description:
    "Know which CBP filing needs you now. File ISF, Entry, and In-Bond in one calm workspace — with an AI Coach for every rejection.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MyCargoLens — CBP Compliance Platform",
    description:
      "Know which CBP filing needs you now. File ISF, Entry, and In-Bond in one calm workspace — with an AI Coach for every rejection.",
    url: "https://mycargolens.com",
    type: "website",
    siteName: "MyCargoLens",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyCargoLens — CBP Compliance Platform",
    description:
      "Know which CBP filing needs you now. File ISF, Entry, and In-Bond in one calm workspace.",
  },
};

export default function HomePage() {
  return <HomeClient />;
}
