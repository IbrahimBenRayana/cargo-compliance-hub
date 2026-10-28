import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building2, CodeXml, Ship, Stamp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, SectionHeading } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton } from "@/components/site/cta";
import { Faq, type FaqItem } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { webPage } from "@/lib/schema";
import { ROUTES, ctaHref } from "@/lib/site";
import { CtaBand, PRICING_LINK } from "@/components/site/cta-band";
import { PriceLine, pageMetadata } from "./_components/page-bits";

// Copy: marketing/deliverables/2026-10-23-website-rework/copy/solutions.md
const PATH = ROUTES.solutions.href;
const DESCRIPTION =
  "ISF and customs entry software for NVOCCs, forwarders and importers who file their own. Pick your lane: volume and API, or $45 per ISF.";

export const metadata = pageMetadata({
  path: PATH,
  title: "Customs software for forwarders and importers",
  description: DESCRIPTION,
  ogTitle: "Who MyCargoLens is for",
});

type RouterCard = {
  icon: LucideIcon;
  title: string;
  line: string;
  /** Mono line under the body: price (cards 1-2) or scope (card 3). */
  fine?: string;
  href: string;
  linkLabel: string;
  size: "large" | "small";
};

// Importers first (GTM Path B). Brokers have no page yet (P2): their card asks for a pilot.
const CARDS: RouterCard[] = [
  {
    icon: Building2,
    title: "Importers who file their own",
    line: "Check every ISF and entry you file before CBP does, from ISF to liquidation.",
    fine: "ISF $45, charged when CBP accepts. Customs entry: talk to us.",
    href: ROUTES.importers.href,
    linkLabel: "See how importers file",
    size: "large",
  },
  {
    icon: Ship,
    title: "NVOCCs and freight forwarders",
    line: "Every house bill on a deadline clock, filed from your TMS through the API or in bulk from templates.",
    fine: "Volume pricing on request, agreed in writing. Ask about our design-partner program.",
    href: ROUTES.nvoccForwarders.href,
    linkLabel: "See how NVOCCs file",
    size: "large",
  },
  {
    icon: Stamp,
    title: "Licensed customs brokers",
    line: "A ranked queue and plain-English rejections, so your team reviews instead of retypes. We're offering pilots on the API and the ISF and entry inbox.",
    fine: "We file ISF-10, ISF-5, 7501 and 3461 today. In-bond, FTZ, drawback and AES aren't available.",
    href: ctaHref({ persona: "broker", src: "solutions-router" }),
    linkLabel: "Ask about a pilot",
    size: "small",
  },
  {
    icon: CodeXml,
    title: "Developers integrating filing",
    line: "REST or XML in, HMAC-signed filing.* and entry.* webhooks out, with scoped, revocable keys.",
    href: ROUTES.api.href,
    linkLabel: "See the API",
    size: "small",
  },
];

const TRUST = ["Every edit and CBP response kept on the filing", "Four roles, MFA on every account", "Audit trail exports to CSV"];

const FAQ: FaqItem[] = [
  {
    q: "Is MyCargoLens a customs broker?",
    a: "No. MyCargoLens is software for importers, forwarders, NVOCCs and customs brokers. You, or your broker, stay in charge of advice and classification decisions.",
  },
  {
    q: "What does MyCargoLens file with CBP?",
    a: "ISF-10, ISF-5, entry summaries (7501) and cargo release (3461). In-bond, FTZ, drawback and AES aren't available.",
  },
  {
    q: "Why is pricing different for forwarders and importers?",
    a: "The $45 ISF price is built for importers filing their own shipments, and customs entry is priced on a call. NVOCCs, forwarders and brokers filing at volume get volume pricing on request, agreed in writing. Both are charged only when CBP accepts.",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <JsonLd
        data={webPage({
          path: PATH,
          name: "Customs software for forwarders and importers",
          description: DESCRIPTION,
          type: "CollectionPage",
          aboutSoftware: true,
        })}
      />

      <PageHero
        breadcrumbPath={PATH}
        eyebrow="Solutions"
        title="Customs filing software for the people who file"
        sub="MyCargoLens files ISF-10, ISF-5, entry summaries (7501) and cargo release (3461) with CBP. Pick the page that sounds like your desk."
        actions={<DemoButton location="hero" src="solutions-hero" size="lg" />}
        scene="solutions"
        size="compact"
      />

      <Section tone="cream" id="who-its-for" aria-labelledby="who-its-for-title">
        <h2 id="who-its-for-title" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-tone-eyebrow">
          Who it&apos;s for
        </h2>
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {CARDS.map((c) => (
            <li key={c.title} className="flex">
              <RouterCardView card={c} />
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="sky" spacing="compact" aria-label="Comparing options">
        <p className="text-center text-[17px] leading-relaxed text-tone-fg sm:text-[18px]">
          Still comparing options, including keeping your broker? Read{" "}
          <Link href={ROUTES.compare.href} className="font-semibold underline decoration-current/35 underline-offset-4 hover:decoration-current">
            how MyCargoLens compares
          </Link>
          .
        </p>
      </Section>

      <Section tone="paper" spacing="compact" aria-label="What gets logged and who can see it">
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {TRUST.map((t) => (
            <li
              key={t}
              className="inline-flex items-center rounded-full border border-border/80 bg-[hsl(var(--card))] px-3 py-1 text-[12.5px] font-semibold text-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]"
            >
              {t}
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-5 max-w-2xl text-center text-[13.5px] leading-relaxed text-tone-muted">
          MyCargoLens is software for importers, forwarders, NVOCCs and customs brokers. We are not a licensed customs broker.
        </p>
      </Section>

      <Section tone="mint" id="faq" width="narrow">
        <SectionHeading title="Questions" />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      <CtaBand
        title="Twenty minutes, your filings, your price."
        sub="Tell us how you file today. We'll show you the parts that matter and what it would cost."
        src="solutions-close"
        links={[PRICING_LINK]}
        micro="ISF is $45, charged only when CBP accepts. No monthly fee."
      />
    </>
  );
}

/** Whole card is the click target (stretched link); the link text is the accessible name. */
function RouterCardView({ card }: { card: RouterCard }) {
  const large = card.size === "large";
  const Icon = card.icon;
  return (
    <div
      className={cn(
        "group relative flex w-full flex-col rounded-[20px] p-6 transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-quart)] focus-within:ring-2 focus-within:ring-ring [@media(hover:hover)]:hover:-translate-y-px",
        large ? "site-surface md:p-8" : "border border-[hsl(var(--surface-border))] [@media(hover:hover)]:hover:border-foreground/20",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mb-4 grid place-items-center rounded-xl text-tone-fg ring-1 ring-[hsl(var(--surface-border))]",
          large ? "size-11 bg-[hsl(var(--card))]" : "size-9",
        )}
      >
        <Icon className={large ? "size-5" : "size-[18px]"} strokeWidth={1.9} />
      </span>
      <h3 className={cn("font-semibold leading-snug tracking-[-0.015em] text-tone-fg", large ? "text-[21px] sm:text-[23px]" : "text-[17px]")}>
        {card.title}
      </h3>
      <p className={cn("mt-2 leading-relaxed text-tone-muted", large ? "text-[16px]" : "text-[15px]")}>{card.line}</p>
      {card.fine && (
        <PriceLine className={cn("mt-4 border-t border-[hsl(var(--surface-border))] pt-4", !large && "text-tone-muted")}>
          {card.fine}
        </PriceLine>
      )}
      <Link
        href={card.href}
        className="mt-auto inline-flex items-center gap-1 pt-5 text-[14.5px] font-semibold text-tone-fg after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none"
      >
        {card.linkLabel}
        <ArrowRight
          aria-hidden
          className="size-3.5 transition-transform duration-200 ease-[var(--ease-out-quart)] [@media(hover:hover)]:group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  );
}
