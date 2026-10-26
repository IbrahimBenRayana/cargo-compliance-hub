import * as React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, SectionHeading, Eyebrow, type Tone } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton, SecondaryCta } from "@/components/site/cta";
import { CertBadge } from "@/components/site/cert-badge";
import { Faq, type FaqItem } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { Screenshot } from "@/components/site/screenshot";
import { webPage } from "@/lib/schema";
import { SCREENS, type ScreenKey } from "@/lib/screens";
import { COMPANY, SITE_URL } from "@/lib/site";
import type { ModuleKey } from "@/lib/accents";
import type { HeroSlug } from "@/components/hero3d/Hero3D";

/**
 * Shared building blocks for the platform overview and the module pages
 * (/platform/isf-filing, /customs-entry, /inbox; T6 reuses them read-only).
 * Server components only.
 */

/* ------------------------------------------------------------------ */
/* Metadata + schema                                                    */
/* ------------------------------------------------------------------ */

/**
 * Route metadata. `title` is the deck's meta title WITHOUT "| MyCargoLens"
 * (the root layout template adds it). OG/Twitter get the full branded title
 * unless `ogTitle` is given.
 */
export function pageMetadata({
  path,
  title,
  description,
  ogTitle,
  ogDescription,
}: {
  path: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
}): Metadata {
  const social = ogTitle ?? `${title} | ${COMPANY.name}`;
  const socialDesc = ogDescription ?? description;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: COMPANY.name,
      url: `${SITE_URL}${path}`,
      title: social,
      description: socialDesc,
    },
    twitter: { card: "summary_large_image", title: social, description: socialDesc },
  };
}

/** WebPage JSON-LD (`about` → /#software). Breadcrumbs and FAQPage come from their blocks. */
export function PageSchema({ path, name, description }: { path: string; name: string; description: string }) {
  return <JsonLd data={webPage({ path, name, description, aboutSoftware: true })} />;
}

/* ------------------------------------------------------------------ */
/* Hero                                                                 */
/* ------------------------------------------------------------------ */

export type ModuleHeroProps = {
  /** Route path, e.g. "/platform/isf-filing" (breadcrumbs). */
  path: string;
  /** Hero3D scene slug (equals the page slug). */
  scene: HeroSlug;
  module?: ModuleKey;
  eyebrow: string;
  title: string;
  sub: string;
  /** `?src=` for Book a demo, e.g. "platform-isf". */
  src: string;
  micro?: string;
  /** Show the "CBP ABI certified" badge (default true). */
  certBadge?: boolean;
  children?: React.ReactNode;
};

/** PageHero (full tier) with Book a demo + See pricing. */
export function ModuleHero({ path, scene, module, eyebrow, title, sub, src, micro, certBadge = true, children }: ModuleHeroProps) {
  return (
    <PageHero
      breadcrumbPath={path}
      accent={module}
      badge={certBadge ? <CertBadge /> : undefined}
      eyebrow={eyebrow}
      title={title}
      sub={sub}
      actions={
        <>
          <DemoButton location="hero" src={src} size="lg" />
          <SecondaryCta location="hero" size="lg" />
        </>
      }
      micro={micro}
      scene={scene}
    >
      {children}
    </PageHero>
  );
}

/* ------------------------------------------------------------------ */
/* Inline links                                                         */
/* ------------------------------------------------------------------ */

export type TextLinkItem = { label: string; href: string };

/** Descriptive in-copy links ("How ISF filing works →"), accent-coloured on module pages. */
export function TextLinks({ links, className }: { links: TextLinkItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            data-location="inline"
            className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-a-ink underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current"
          >
            {l.label}
            <ArrowRight
              aria-hidden
              className="size-3.5 shrink-0 transition-transform duration-200 ease-[var(--ease-out-quart)] [@media(hover:hover)]:group-hover:translate-x-0.5"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Scope cards (template slot S2 on every module page)                 */
/* ------------------------------------------------------------------ */

/** Two plain scope cards + the honest scope line under them. */
export function ScopeCards({
  cards,
  note,
  className,
}: {
  cards: { title: string; body: React.ReactNode }[];
  note: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {cards.map((c) => (
          <li key={c.title} className="rounded-[20px] p-6 site-surface">
            <span aria-hidden className="mb-4 block h-1 w-10 rounded-full bg-a" />
            <h3 className="text-[18px] font-semibold leading-snug tracking-[-0.015em] text-tone-fg">{c.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-tone-muted">{c.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[14px] leading-relaxed text-tone-muted">{note}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Media                                                                */
/* ------------------------------------------------------------------ */

/** A main screen with a smaller second screen overlapping its corner (desktop only). */
export function StackedShots({ main, inset, caption }: { main: ScreenKey; inset: ScreenKey; caption?: string }) {
  return (
    <div className="relative lg:pb-16">
      <Screenshot screen={main} caption={caption} />
      <div className="absolute -bottom-2 -left-6 hidden w-[58%] lg:block">
        <Screenshot screen={inset} sizes="(min-width: 1024px) 320px, 0px" />
      </div>
    </div>
  );
}

/** A small, frameless product crop (flow strips). */
export function ScreenCrop({ screen, className }: { screen: ScreenKey; className?: string }) {
  const meta = SCREENS[screen];
  return (
    <Image
      src={`/screens/${screen}.webp`}
      alt={meta.alt}
      width={meta.width}
      height={meta.height}
      unoptimized
      sizes="(min-width: 1024px) 140px, 45vw"
      className={cn(
        "block h-auto w-full rounded-xl bg-white ring-1 ring-[hsl(var(--surface-border))] shadow-[0_12px_30px_-18px_hsl(222_47%_20%/0.45)]",
        className,
      )}
    />
  );
}

/** Code strip for ink bands. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <figure className="m-0 min-w-0">
      <pre
        aria-label={label}
        className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-5 font-mono text-[13px] leading-relaxed text-[hsl(216_30%_85%)]"
      >
        {code}
      </pre>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ + close band                                                     */
/* ------------------------------------------------------------------ */

/** FAQ section (narrow, FAQPage JSON-LD) with optional related links under it. */
export function FaqSection({
  title,
  items,
  related,
  tone = "mesh",
  accent,
}: {
  title: string;
  items: FaqItem[];
  /** Links the deck puts inside answers (answers stay plain text so JSON-LD matches). */
  related?: TextLinkItem[];
  tone?: Tone;
  accent?: ModuleKey;
}) {
  return (
    <Section tone={tone} id="faq" width="narrow" accent={accent} aria-labelledby="faq-title">
      <SectionHeading id="faq-title" title={title} />
      <Faq className="mt-8" items={items} />
      {related && related.length > 0 && <TextLinks className="mt-8" links={related} />}
    </Section>
  );
}

/**
 * Page-specific pre-footer band (deck copy). Same look as <CtaBand>, which
 * only takes the registry variants: navy, one gold button, at most one link.
 */
export function CloseBand({
  title,
  body,
  src,
  micro,
  pricingLink = true,
}: {
  title: string;
  body: string;
  src: string;
  micro?: string;
  pricingLink?: boolean;
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
          <DemoButton src={src} location="close" size="lg" />
          {pricingLink && <SecondaryCta as="link" location="close" />}
        </div>
        {micro && <p className="mt-5 text-[13px] text-tone-muted">{micro}</p>}
      </div>
    </Section>
  );
}
