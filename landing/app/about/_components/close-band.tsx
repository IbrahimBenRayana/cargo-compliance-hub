import * as React from "react";
import { Section, Eyebrow } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";

/**
 * Page-specific pre-footer band. Same markup as components/site/cta-band.tsx,
 * but takes the copy from the page's own deck (about §9, security §11,
 * changelog §6), which differs from the shared CTA_BANDS variants.
 * Shared by the T10 routes (/about, /security, /changelog).
 */
export function CloseBand({
  title,
  sub,
  src,
  link,
  micro,
}: {
  title: string;
  sub: string;
  src: string;
  /** At most one text link next to the button. */
  link?: { label: string; href: string };
  micro?: string;
}) {
  return (
    <Section tone="navy" id="book-a-demo-band" data-cta-band="" aria-labelledby="cta-band-title" className="text-center">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Book a demo</Eyebrow>
        <h2
          id="cta-band-title"
          className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-tone-fg sm:text-[40px]"
        >
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">{sub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <DemoButton src={src} location="close" size="lg" />
          {link && (
            <a
              href={link.href}
              className="inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current"
            >
              {link.label}
            </a>
          )}
        </div>
        {micro && <p className="mt-5 text-[13px] text-tone-muted">{micro}</p>}
      </div>
    </Section>
  );
}
