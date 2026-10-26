import * as React from "react";
import { Section, Eyebrow } from "@/components/site/section";
import { DemoButton, SecondaryCta } from "@/components/site/cta";
import { CTA_BANDS, type CtaBandVariant } from "@/lib/site";

export type CtaBandProps = {
  /** Copy variant from global.md §4 (default, importer, nvocc, developer, security, company). */
  variant?: CtaBandVariant;
  /** `?src=` for the button. Defaults to "band". e.g. "pricing-close". */
  src?: string;
  /** Hide the "See pricing" link even when the variant allows it (non-product pages). */
  hidePricingLink?: boolean;
};

/**
 * Pre-footer CTA band: navy, one headline, one sub, one gold button, at most
 * one text link. Render it as the last thing in a page (before the global
 * footer) on every page except /book-a-demo, /thanks, legal pages and 404.
 */
export function CtaBand({ variant = "default", src = "band", hidePricingLink = false }: CtaBandProps) {
  const c = CTA_BANDS[variant];
  return (
    <Section tone="navy" id="book-a-demo-band" data-cta-band="" aria-labelledby="cta-band-title" className="text-center">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Book a demo</Eyebrow>
        <h2
          id="cta-band-title"
          className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-tone-fg sm:text-[40px]"
        >
          {c.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">{c.sub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <DemoButton cta={c.cta} persona={c.persona} src={src} location="close" size="lg" />
          {c.pricingLink && !hidePricingLink && <SecondaryCta as="link" location="close" />}
        </div>
        {c.micro && <p className="mt-5 text-[13px] text-tone-muted">{c.micro}</p>}
      </div>
    </Section>
  );
}
