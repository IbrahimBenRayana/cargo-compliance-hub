import * as React from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { Section } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";
import { ThemeSwitch } from "@/components/site/theme-switch";
import { accentClass } from "@/lib/accents";
import { COMPANY, ROUTES, UI_STRINGS, footerColumns } from "@/lib/site";

/**
 * Global footer (wireframe 01 "FT", copy/global.md §5). Always light tone
 * (`footer`), dark pair in dark mode. Generated from lib/site.ts.
 * The status strip was removed at launch (CMO decision). Company facts that
 * aren't confirmed (address, LinkedIn URL) stay hidden: no placeholders.
 */
export function Footer() {
  const columns = footerColumns();
  const year = new Date().getFullYear();

  return (
    <Section as="footer" tone="footer" spacing="none" className="pb-10 pt-16 md:pt-20" aria-label="Footer">
      <div className="grid gap-12 lg:grid-cols-[1.25fr_3fr] lg:gap-10">
        {/* Brand column */}
        <div className="max-w-xs">
          <Link href="/" aria-label="MyCargoLens home" className="inline-flex rounded-md">
            <Wordmark />
          </Link>
          <p className="mt-4 text-[14px] leading-relaxed text-tone-muted">{COMPANY.brandLine}</p>
          <div className="mt-5">
            {/* Outline here: the pre-footer band above keeps the only gold button. */}
            <DemoButton location="footer" src="footer" variant="outline" size="sm" className="h-9 px-4" />
          </div>
        </div>

        {/* Link columns */}
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-tone-eyebrow">
                {col.heading}
              </h2>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        data-location="footer"
                        className="text-[14px] text-tone-fg/85 transition-colors hover:text-tone-fg"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className={`group inline-flex items-baseline text-[14px] text-tone-fg/85 transition-colors hover:text-tone-fg ${accentClass(link.module)}`}
                      >
                        {link.module && (
                          <span aria-hidden className="mr-2 inline-block size-[7px] translate-y-[-1px] rounded-[2px] bg-a" />
                        )}
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="mt-14 border-t border-[hsl(var(--surface-border))] pt-6">
        <p className="max-w-3xl text-[14px] leading-relaxed text-tone-fg/85">{COMPANY.disclosure}</p>
        <div className="mt-4 flex flex-col gap-3 text-[13px] text-tone-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>
              © {year} {COMPANY.legalName}
              {COMPANY.postalAddress ? ` · ${COMPANY.postalAddress}` : null}
            </span>
            <span className="flex items-center gap-3">
              <Link href={ROUTES.privacy.href} className="hover:text-tone-fg">
                {ROUTES.privacy.label}
              </Link>
              <Link href={ROUTES.terms.href} className="hover:text-tone-fg">
                {ROUTES.terms.label}
              </Link>
              {COMPANY.linkedInUrl && (
                <a href={COMPANY.linkedInUrl} target="_blank" rel="noopener noreferrer" className="hover:text-tone-fg">
                  LinkedIn<span className="sr-only"> {UI_STRINGS.externalHint}</span>
                </a>
              )}
            </span>
          </div>
          <ThemeSwitch />
        </div>
      </div>
    </Section>
  );
}
