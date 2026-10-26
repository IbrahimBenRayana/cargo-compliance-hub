import * as React from "react";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";
import { CTA, CTA_BANDS, type CtaBandVariant, type CtaId, type DemoCtaKey, type Persona } from "@/lib/site";

export type CtaBandLink = { label: string; href: string; id?: CtaId };

/** The "See pricing" text link, for bands that carry it. */
export const PRICING_LINK: CtaBandLink = {
  label: CTA.seePricing.label,
  href: CTA.seePricing.href,
  id: CTA.seePricing.id,
};

export type CtaBandProps = {
  /** Copy variant from global.md §4 (default, importer, nvocc, developer, security, company). */
  variant?: CtaBandVariant;
  /** `?src=` for the button. Defaults to "band". e.g. "pricing-close". */
  src?: string;
  /** Hide the "See pricing" link even when the variant allows it (non-product pages). */
  hidePricingLink?: boolean;
  /**
   * Page-specific copy from the page's own deck. Each field overrides the
   * variant; when `title` is set, links default to none (pass `links`).
   */
  title?: string;
  sub?: string;
  cta?: DemoCtaKey;
  persona?: Persona;
  /** Text links next to the button (keep it to one where the deck allows). */
  links?: CtaBandLink[];
  /** Under-button microcopy (one line). */
  micro?: string;
  /** Small trust line under the microcopy (home only). */
  note?: string;
};

/**
 * Pre-footer CTA band: navy, one headline, one sub, one gold button, text
 * links. Render it as the last thing in a page (before the global footer) on
 * every page except /book-a-demo, /thanks, legal pages and 404.
 */
export function CtaBand({
  variant = "default",
  src = "band",
  hidePricingLink = false,
  title,
  sub,
  cta,
  persona,
  links,
  micro,
  note,
}: CtaBandProps) {
  const c = CTA_BANDS[variant];
  const custom = title !== undefined;
  const bandLinks = links ?? (!custom && c.pricingLink && !hidePricingLink ? [PRICING_LINK] : []);
  const microLine = micro ?? (custom ? undefined : c.micro);

  return (
    <Section tone="navy" id="book-a-demo-band" data-cta-band="" aria-labelledby="cta-band-title" className="text-center">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Book a demo</Eyebrow>
        <h2
          id="cta-band-title"
          className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-tone-fg sm:text-[40px]"
        >
          {title ?? c.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
          {sub ?? c.sub}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <DemoButton
            cta={cta ?? c.cta}
            persona={persona ?? (custom ? undefined : c.persona)}
            src={src}
            location="close"
            size="lg"
          />
          {bandLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              data-cta-id={l.id}
              data-location="close"
              className="inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current"
            >
              {l.label}
            </Link>
          ))}
        </div>
        {microLine && <p className="mt-5 text-[13px] text-tone-muted">{microLine}</p>}
        {note && <p className="mt-2 text-[12.5px] font-medium text-tone-muted">{note}</p>}
      </div>
    </Section>
  );
}
