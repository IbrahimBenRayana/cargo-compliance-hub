import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  FileWarning,
  Inbox,
  RadioTower,
  Scale,
  ScrollText,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Section, SectionHeading, Eyebrow } from "@/components/site/section";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton } from "@/components/site/cta";
import { CheckList } from "@/components/site/blocks";
import { Faq } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { StickyDemoBar } from "@/components/site/sticky-demo-bar";
import { Button } from "@/components/ui/button";
import { accentClass } from "@/lib/accents";
import { CTA, ROUTES, ctaHref } from "@/lib/site";
import { graph, softwareApplication, webPage } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { LaneSwitch } from "./_components/lane-switch";
import { Estimator } from "./_components/estimator";
import {
  FAQ,
  GOOD_TO_KNOW,
  ON_EVERY_PLAN,
  PER,
  PRICE_NOTE,
  TIERS,
  TRUST,
  UNDER_CARDS,
  VOLUME,
  usd,
  type Tier,
} from "./_components/pricing-data";

const TITLE = "Customs Filing Software Pricing, Per Shipment";
const DESCRIPTION =
  "ISF $45, ISF + Entry $180, Complete $280 per shipment. No monthly fee. Charged only when CBP accepts. Volume and API pricing for NVOCCs on request.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/pricing",
    types: { "text/markdown": "/pricing.md" },
  },
  openGraph: {
    title: `${TITLE} | MyCargoLens`,
    description: DESCRIPTION,
    url: "/pricing",
    type: "website",
  },
  twitter: { title: `${TITLE} | MyCargoLens`, description: DESCRIPTION },
};

const PLAN_ICONS: LucideIcon[] = [Inbox, ShieldCheck, FileWarning, RadioTower, Scale, CalendarClock, UsersRound, ScrollText];

/** Navy in light, sky ink in dark (primary flips to gold in dark, so not used here). */
const NAVY_BORDER = "border-[hsl(222_47%_22%)] dark:border-[hsl(205_90%_78%)]";
const NAVY_PILL = "bg-[hsl(222_47%_22%)] text-white dark:bg-[hsl(205_90%_78%)] dark:text-[hsl(222_47%_11%)]";

function tierHref(id: Tier["id"]) {
  return `${ctaHref({ persona: "importer" })}&tier=${id}&src=pricing`;
}

function TierCard({ tier }: { tier: Tier }) {
  const featured = !!tier.featured;
  return (
    <article
      aria-labelledby={`tier-${tier.id}`}
      className={cn(
        "relative flex min-w-0 flex-col rounded-[24px] p-6 site-surface sm:p-7",
        accentClass(tier.accent),
        featured ? cn("order-first border-2 md:order-none lg:-my-4 lg:py-10", NAVY_BORDER) : "",
      )}
    >
      <span aria-hidden className="mb-5 block h-1.5 w-12 rounded-full bg-a" />
      {tier.badge && (
        <p className={cn("absolute right-5 top-5 rounded-full px-3 py-1 text-[12px] font-semibold", NAVY_PILL)}>
          {tier.badge}
        </p>
      )}
      <h3 id={`tier-${tier.id}`} className="text-[20px] font-semibold tracking-[-0.015em] text-tone-fg">
        {tier.name}
      </h3>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums text-tone-fg">
          {usd(tier.price)}
        </span>
        <span className="text-[14px] font-medium text-tone-muted">{PER}</span>
      </p>
      <p className="mt-2 text-[13.5px] font-medium text-tone-muted">{PRICE_NOTE}</p>
      <p className="mt-5 text-[15px] leading-relaxed text-tone-fg">{tier.who}</p>
      <ul className="mt-5 flex-1 space-y-2.5 border-t border-[hsl(var(--surface-border))] pt-5">
        {tier.includes.map((item) => (
          <li key={item} className="flex gap-2.5 text-[14.5px] leading-snug text-tone-fg">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-a-ink" strokeWidth={2.5} />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
      <Button
        asChild
        variant={featured ? "gold" : "outline"}
        size="lg"
        className={cn("mt-7 w-full", !featured && "bg-[hsl(var(--surface))]")}
      >
        <Link href={tierHref(tier.id)} data-cta-id={CTA.bookDemo.id} data-location="section" data-tier={tier.id}>
          {CTA.bookDemo.label}
        </Link>
      </Button>
    </article>
  );
}

const textLink =
  "inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current";

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPage({ path: "/pricing", name: TITLE, description: DESCRIPTION, aboutSoftware: true }),
          {
            // Product + SoftwareApplication: the three public Offers (UnitPriceSpecification,
            // per shipment, USD). No price node for volume pricing.
            ...softwareApplication({
              description:
                "ISF and customs entry filing software, priced per shipment and charged when CBP accepts.",
              offers: TIERS.map((t) => ({
                name: t.name,
                price: t.price,
                description: `${usd(t.price)} ${PER}, charged when CBP accepts. ${PRICE_NOTE}.`,
              })),
            }),
            "@type": ["SoftwareApplication", "Product"],
          },
        )}
      />

      {/* S1 · Hero + lane switch */}
      <PageHero
        size="compact"
        breadcrumbPath="/pricing"
        eyebrow="Pricing"
        title="A price per shipment, charged when CBP accepts."
        sub="Importers see the full price below, with no monthly fee on the public plans. Rejected filings aren't charged, and resubmits are never charged twice."
        scene="pricing"
      >
        <LaneSwitch />
      </PageHero>

      {/* S2 · The importer card */}
      <Section tone="cream" id="importers" aria-labelledby="importer-card">
        <SectionHeading id="importer-card" title="For importers filing their own ISF and entries" />
        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-3 lg:gap-6">
          {TIERS.map((t) => (
            <TierCard key={t.id} tier={t} />
          ))}
        </div>
        <p className="mt-10 max-w-3xl text-[15px] leading-relaxed text-tone-muted">{UNDER_CARDS}</p>
      </Section>

      {/* S3 · On every plan */}
      <Section tone="sky" spacing="compact" aria-labelledby="every-plan">
        <SectionHeading id="every-plan" title="On every plan" />
        <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {ON_EVERY_PLAN.map((item, i) => {
            const Icon = PLAN_ICONS[i];
            return (
              <li key={item} className="flex gap-3">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[10px] site-surface">
                  <Icon className="size-[18px] text-tone-eyebrow" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 pt-1.5 text-[15px] leading-snug text-tone-fg">{item}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* S4 · Volume lane */}
      <Section tone="navy" id="volume" aria-labelledby="volume-title">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <SectionHeading id="volume-title" eyebrow={VOLUME.eyebrow} title={VOLUME.title} intro={VOLUME.body} />
            <p className="mt-6 max-w-2xl border-l-2 border-[hsl(205_90%_78%/0.6)] pl-4 text-[16px] leading-relaxed text-tone-fg">
              {VOLUME.partners}
            </p>
            <div className="mt-8">
              <DemoButton cta="volumePricing" persona="nvocc" src="pricing-volume" location="section" size="lg" />
              <p className="mt-4 text-[13.5px] text-tone-muted">{VOLUME.micro}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              <Link
                href={ctaHref({ persona: "broker", src: "pricing-volume" })}
                data-cta-id={CTA.pilot.id}
                data-location="section"
                className={textLink}
              >
                Brokers: ask about a pilot →
              </Link>
              <Link href={ROUTES.api.href} className={textLink}>
                How the API works →
              </Link>
            </div>
          </div>
          <div className="min-w-0 self-start rounded-[24px] p-6 site-surface sm:p-8">
            <Eyebrow>Includes</Eyebrow>
            <CheckList className="mt-5" items={[...VOLUME.includes]} />
          </div>
        </div>
      </Section>

      {/* S5 · Estimator */}
      <Section tone="paper" spacing="compact" aria-labelledby="estimator-title">
        <SectionHeading id="estimator-title" as="h3" title="What would a month cost?" />
        <div className="mt-8">
          <Estimator />
        </div>
      </Section>

      {/* S6 · What isn't included */}
      <Section tone="mint" spacing="compact" aria-labelledby="good-to-know">
        <SectionHeading id="good-to-know" title="Good to know before you book" />
        <ul className="mt-8 max-w-3xl space-y-4">
          {GOOD_TO_KNOW.map((line) => (
            <li key={line} className="text-[16px] leading-relaxed text-tone-fg">
              {line}
            </li>
          ))}
        </ul>
      </Section>

      {/* S7 · Trust strip */}
      <Section tone="lilac" spacing="compact" aria-label="Trust">
        <ul className="flex flex-wrap gap-x-8 gap-y-3">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-2.5 text-[15px] font-semibold text-tone-fg">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          <Link href={ROUTES.security.href} className={textLink}>
            Security and access →
          </Link>
          <Link href={ROUTES.compare.href} className={textLink}>
            How we compare to your broker or current vendor →
          </Link>
        </div>
      </Section>

      {/* S8 · Pricing FAQ */}
      <Section tone="peach" width="narrow" aria-labelledby="pricing-faq">
        <SectionHeading id="pricing-faq" title="Pricing questions" />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      {/* S9 · Final CTA band */}
      <CtaBand
        title="Find out which plan fits in 20 minutes."
        sub="Tell us what you ship and how you file today. We'll show you the inbox on shipments like yours and set your team up on the right plan."
        src="pricing-close"
        links={[
          {
            label: "Filing at volume? Talk to us about volume pricing →",
            href: ctaHref({ persona: "nvocc", src: "pricing-close" }),
            id: CTA.volumePricing.id,
          },
        ]}
        micro="Pay per shipment, only when CBP accepts. No monthly fee on the public plans."
      />

      <StickyDemoBar persona="importer" src="pricing-sticky" />
    </>
  );
}
