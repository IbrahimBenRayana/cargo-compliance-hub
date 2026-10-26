import * as React from "react";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";
import type { DemoCtaKey, Persona } from "@/lib/site";

/**
 * Pre-footer band with page-specific copy (module decks write their own H2
 * and body; the shared <CtaBand> only takes the global.md variants). Same
 * look and hooks as <CtaBand>: navy, one gold button, at most one text link,
 * `data-cta-band` so a sticky bar would hide under it.
 * Used by /platform/pre-filing-checks, /platform/compliance and /platform/api.
 */
export function ModuleCloseBand({
  title,
  body,
  cta = "bookDemo",
  persona,
  src,
  link,
}: {
  title: string;
  body: string;
  cta?: DemoCtaKey;
  persona?: Persona;
  src: string;
  link?: { label: string; href: string; id?: string };
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
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">{body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <DemoButton cta={cta} persona={persona} src={src} location="close" size="lg" />
          {link && (
            <Link
              href={link.href}
              data-cta-id={link.id ?? "see_pricing"}
              data-location="close"
              className="inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current"
            >
              {link.label}
            </Link>
          )}
        </div>
      </div>
    </Section>
  );
}

/** In-copy text link ("See it in the inbox →"). */
export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[15px] font-semibold text-a-ink underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current"
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

/** Small cited-source line under a third-party fact. */
export function SourceNote({ label, href }: { label: string; href: string }) {
  return (
    <p className="text-[12.5px] text-tone-muted">
      Source:{" "}
      <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-current/40 underline-offset-2 hover:text-tone-fg">
        {label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
