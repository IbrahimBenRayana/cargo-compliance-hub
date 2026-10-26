import * as React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, Eyebrow } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";
import { Button } from "@/components/ui/button";
import type { Persona } from "@/lib/site";

/**
 * Page-local helpers shared by /solutions, /solutions/* and /compare (T7).
 * Nothing here belongs in components/site: if the CMO wants any of it shared,
 * lift it there.
 */

/** Page metadata: title (layout adds "| MyCargoLens"), description, canonical, OG. */
export function pageMetadata({
  path,
  title,
  description,
  ogTitle,
}: {
  path: string;
  title: string;
  description: string;
  ogTitle: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "MyCargoLens",
      url: path,
      title: ogTitle,
      description,
    },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

/** Descriptive inline link with an arrow ("How the inbox ranks work →"). */
export function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current",
        className,
      )}
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-3.5 transition-transform duration-200 ease-[var(--ease-out-quart)] [@media(hover:hover)]:group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** Plain list with calm dashes (the "not available" side of a scope block). */
export function DashList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15.5px] leading-snug text-tone-muted">
          <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-[hsl(var(--surface-border))]">
            <Minus className="size-3" strokeWidth={2.5} />
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Pre-footer band with the page deck's own copy. Same markup and rules as
 * components/site/cta-band.tsx (navy, one gold button, `data-cta-band` so
 * StickyDemoBar hides under it), but CtaBand only takes the global.md
 * variants and each T7 deck writes its own H2 and sub.
 */
export function ClosingBand({
  title,
  sub,
  persona,
  src,
  links = [],
  micro,
}: {
  title: string;
  sub: string;
  persona?: Persona;
  src: string;
  links?: { label: string; href: string }[];
  micro?: string;
}) {
  return (
    <Section tone="navy" id="book-a-demo-band" data-cta-band="" aria-labelledby="cta-band-title" className="text-center">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Book a demo</Eyebrow>
        <h2 id="cta-band-title" className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-tone-fg sm:text-[40px]">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">{sub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <DemoButton persona={persona} src={src} location="close" size="lg" />
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              data-location="close"
              className="inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current"
            >
              {l.label}
            </Link>
          ))}
        </div>
        {micro && <p className="mt-5 text-[13px] text-tone-muted">{micro}</p>}
      </div>
    </Section>
  );
}

/** Small mono/tabular price line (router cards, pricing strips). */
export function PriceLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[13px] leading-relaxed tabular-nums text-tone-fg", className)}>{children}</p>
  );
}

/** Badge with the certification dot, for lines the CertBadge label doesn't cover. */
export function TrustPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-[hsl(var(--card))] py-1 pl-2 pr-3 text-[12.5px] font-semibold text-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]",
        className,
      )}
    >
      <span aria-hidden className="relative grid size-3.5 shrink-0 place-items-center rounded-full bg-emerald-500/15">
        <span className="size-1.5 rounded-full bg-emerald-500" />
      </span>
      {children}
    </span>
  );
}

/** Outline secondary button for deck labels the CTA registry doesn't carry ("See the API"). */
export function OutlineLink({
  href,
  children,
  size = "default",
  location,
}: {
  href: string;
  children: React.ReactNode;
  size?: "default" | "lg";
  location: "hero" | "section" | "close";
}) {
  return (
    <Button asChild variant="outline" size={size} className="bg-[hsl(var(--surface))]">
      <Link href={href} data-location={location}>
        {children}
      </Link>
    </Button>
  );
}
