"use client";

import { Hero } from "@/components/sections/home/hero";
import { ContrastBand } from "@/components/sections/home/contrast-band";
import { Workflow } from "@/components/sections/home/workflow";
import { Watchtower } from "@/components/sections/home/watchtower";
import { ActTrack } from "@/components/sections/home/act-track";
import { Trust } from "@/components/sections/home/trust";
import { ClosingCta } from "@/components/sections/closing-cta";

/**
 * Homepage composition. Seven beats, light-led, with exactly two dark
 * passages (the 1998 contrast band and the closing CTA) so the page
 * itself argues the product thesis: one calm surface.
 *
 * 1. Hero — the inbox itself in the first viewport, on every device.
 * 2. Contrast — customs software stuck in 1998, then the calm queue.
 * 3. Workflow — file / triage / fix inside one product window.
 * 4. Watchtower — HTS, ADD/CVD, UFLPA, PGA + the automation strip.
 * 5. Track — every entry's 314-day liquidation clock.
 * 6. Trust — teams, audit log, and the rails CBP actually uses.
 * 7. Closing CTA.
 */
export default function HomeClient() {
  return (
    <>
      <Hero />
      <ContrastBand />
      <Workflow />
      <Watchtower />
      <ActTrack />
      <Trust />
      <ClosingCta />
    </>
  );
}
