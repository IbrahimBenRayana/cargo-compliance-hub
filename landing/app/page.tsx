import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/section";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton, SecondaryCta } from "@/components/site/cta";
import { CheckList } from "@/components/site/blocks";
import { Screenshot } from "@/components/site/screenshot";
import { Faq, type FaqItem } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { Button } from "@/components/ui/button";
import { softwareApplication, type OfferInput } from "@/lib/schema";
import { CTA, ROUTES, ctaHref } from "@/lib/site";
import { cn } from "@/lib/utils";
import PersonaRouter, { type RouterCard } from "./home-client";
import { articleHref, publishedArticles } from "./resources/_content/articles";

/**
 * Home `/` (build plan T4). Copy: copy/home.md (verbatim). Rhythm:
 * wireframes/02-home.html: hero → cream → sky → paper → mint → lilac →
 * peach → ink → mesh → navy (close). Server component; the persona router
 * is the only client island.
 */

const TITLE = "Customs Filing Software for ISF and Entries | MyCargoLens";
const DESCRIPTION =
  "File ISF and customs entries with CBP from one inbox ranked by what needs you now. ISF is $45, charged when CBP accepts.";
const OG_TITLE = "Customs, in focus. ISF and entry software · MyCargoLens";

export const metadata: Metadata = {
  // The root layout's "%s | MyCargoLens" template doesn't apply to the root
  // segment's own page, so the deck's full title is set as absolute.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: OG_TITLE,
    description: DESCRIPTION,
    url: "/",
    type: "website",
    siteName: "MyCargoLens",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: DESCRIPTION,
  },
};

/** The one public price (mirrored from /pricing) for the SoftwareApplication offers. */
const PLANS: OfferInput[] = [{ name: "ISF Filing", price: 45, unitText: "per accepted ISF" }];

/** S6 price strip: ISF has a price; customs entry is "talk to us". */
const PRICE_STRIP = [
  { name: "ISF Filing", value: "$45", unit: "per accepted ISF" },
  { name: "Customs entry", value: "Talk to us", unit: "Priced on a call" },
  { name: "Filing at volume", value: "On request", unit: "NVOCCs, forwarders and brokers" },
];

const FAQ: FaqItem[] = [
  {
    q: "Who sends my filings to CBP?",
    a: "MyCargoLens files them with CBP for you. You review and submit each one from your account.",
  },
  {
    q: "Are you a customs broker?",
    a: "No. MyCargoLens is software for importers, forwarders, NVOCCs and brokers. You or your broker stay in charge of advice and classification decisions.",
  },
  {
    q: "What can I file with MyCargoLens?",
    a: "ISF-10, ISF-5, entry summaries (7501) and cargo release (3461), plus manifest (MBOL) queries. In-bond (7512), FTZ, drawback and AES aren't available today, and we don't sell ISF bonds.",
  },
  {
    q: "If something goes wrong, who is liable?",
    a: "The importer of record, whoever transmits the filing. That's why it helps to see and check every ISF and entry you file before it goes to CBP.",
  },
  {
    q: "What does it cost?",
    a: "ISF is $45 per accepted ISF, with no monthly fee. You're charged only when CBP accepts. For customs entry, talk to us on a demo. NVOCCs, forwarders and brokers filing at volume get volume pricing on request.",
  },
  {
    q: "You're a young company. Why should we trust you with filings?",
    a: "We're early, and we'd rather say so. You see and check every filing before it goes, and ISF is charged only when CBP accepts it, with no monthly fee.",
  },
  {
    q: "What happens on the demo?",
    a: "In 20 minutes we walk through how you file today, show the parts that matter for your shipments in a demo account and tell you what it would cost. If it fits, we set up your team.",
  },
];

const ROUTER: RouterCard[] = [
  {
    persona: "importer",
    title: "Importers",
    line: "Check every ISF and entry you file before CBP does, from ISF to liquidation.",
    linkLabel: "For importers",
    href: ROUTES.importers.href,
    module: "entry",
  },
  {
    persona: "nvocc",
    title: "NVOCCs and forwarders",
    line: "Every house bill on a deadline clock, filed from your TMS or in bulk from templates.",
    linkLabel: "For NVOCCs and forwarders",
    href: ROUTES.nvoccForwarders.href,
    module: "isf",
  },
  {
    persona: "developer",
    title: "Developers",
    line: "File ISF and entries from your own system. REST or XML in, signed webhooks out.",
    linkLabel: "API and webhooks",
    href: ROUTES.api.href,
    module: "api",
  },
  {
    persona: "broker",
    title: "Licensed customs brokers",
    line: "A ranked queue and plain-English rejections, so your team reviews instead of retypes. Ask about a pilot.",
    linkLabel: CTA.pilot.label,
    href: ctaHref({ persona: "broker", src: "home-router" }),
    module: "inbox",
  },
];

/* ------------------------------------------------------------------ */
/* Page-local pieces                                                    */
/* ------------------------------------------------------------------ */

/** Inline text link with an arrow ("How the inbox ranks your filings →"). */
function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 text-[15px] font-semibold text-tone-fg underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current",
        className,
      )}
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-3.5 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** IL-01: the "six windows" a filing team juggles. Muted on purpose; no real vendor UI. */
function SixWindows() {
  const bar = (label: string) => (
    <div className="flex items-center gap-1 border-b border-[hsl(var(--surface-border))] px-2.5 py-1.5">
      <i className="block size-[7px] rounded-full bg-tone-muted/30" />
      <i className="block size-[7px] rounded-full bg-tone-muted/30" />
      <i className="block size-[7px] rounded-full bg-tone-muted/30" />
      <span className="ml-1.5 truncate font-mono text-[10.5px] text-tone-muted">{label}</span>
    </div>
  );
  const lines = (n: number) => (
    <div className="space-y-2 p-3">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="block h-[7px] rounded-full bg-tone-muted/15" style={{ width: `${88 - i * 14}%` }} />
      ))}
    </div>
  );
  const win = "absolute overflow-hidden rounded-xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--surface-border))] shadow-[0_12px_30px_-18px_hsl(222_47%_20%/0.45)]";
  return (
    <div
      role="img"
      aria-label="Illustration: a spreadsheet of house bills, a terminal filing screen, an email thread about a CBP message and a PDF invoice, piled on top of each other."
      className="relative mx-auto aspect-[4/3] w-full max-w-[520px] opacity-90 saturate-50"
    >
      <div className={cn(win, "left-0 top-0 w-[62%] rotate-[-2deg]")} aria-hidden>
        {bar("house-bills_FINAL_v7.xlsx")}
        <div className="grid grid-cols-4 gap-px bg-[hsl(var(--surface-border))] p-px">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="block h-4 bg-[hsl(var(--card))]" />
          ))}
        </div>
      </div>
      <div className={cn(win, "right-0 top-[14%] w-[54%] rotate-[2deg] bg-[hsl(222_40%_14%)]")} aria-hidden>
        <div className="flex items-center gap-1 border-b border-white/10 px-2.5 py-1.5">
          <span className="truncate font-mono text-[10.5px] text-white/60">terminal</span>
        </div>
        <pre className="m-0 p-3 font-mono text-[10.5px] leading-relaxed text-emerald-300/80">
          {"ISF  STATUS ?\nHBL  ......\nF3=EXIT  F12=CANCEL"}
        </pre>
      </div>
      <div className={cn(win, "bottom-[4%] left-[6%] w-[52%] rotate-[1.5deg]")} aria-hidden>
        {bar("RE: RE: FW: CBP msg")}
        {lines(4)}
      </div>
      <div className={cn(win, "bottom-0 right-[4%] w-[44%] rotate-[-3deg]")} aria-hidden>
        {bar("commercial-invoice.pdf")}
        {lines(3)}
      </div>
    </div>
  );
}

/** S2 cited risk cards (static numbers; the first cites two sources, so not <StatCards>). */
function RiskStats() {
  const src = (label: string, href: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-current/40 underline-offset-2 hover:text-tone-fg"
    >
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-col rounded-[20px] p-6 site-surface">
        <dt className="order-2 mt-2 text-[15px] leading-snug text-tone-muted">
          in liquidated damages per ISF violation. On a consolidation, each house bill counts.
        </dt>
        <dd className="order-1 text-[36px] font-semibold leading-none tracking-[-0.03em] text-tone-fg tabular-nums sm:text-[44px]">
          $5,000
        </dd>
        <dd className="order-3 mt-4 text-[12.5px] text-tone-muted">
          Source:{" "}
          {src(
            "CBP, ISF FAQ 2.0 (May 2023)",
            "https://www.cbp.gov/sites/default/files/assets/documents/2023-May/ISF%20FAQ%202.0%20(508).pdf",
          )}
          ; {src("Great Lakes Customs Law", "https://greatlakescustomslaw.com/?p=9030")}
        </dd>
      </div>
      <div className="flex flex-col rounded-[20px] p-6 site-surface">
        <dt className="order-2 mt-2 text-[15px] leading-snug text-tone-muted">
          trade liquidated-damages cases, FY2024 to FY2025. All trade LDs, not ISF only.
        </dt>
        <dd className="order-1 text-[30px] font-semibold leading-none tracking-[-0.03em] text-tone-fg tabular-nums sm:text-[40px]">
          22,399 → 53,052
        </dd>
        <dd className="order-3 mt-4 text-[12.5px] text-tone-muted">
          Source: {src("CBP trade statistics", "https://www.cbp.gov/newsroom/stats/trade")}
        </dd>
      </div>
    </dl>
  );
}

/** S3 proof chip: value + label. */
function ProofChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl px-5 py-4 site-surface sm:flex-row sm:items-baseline sm:gap-5">
      <p className="shrink-0 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-tone-fg tabular-nums sm:w-[150px]">
        {value}
      </p>
      <p className="text-[14.5px] leading-snug text-tone-muted">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const latestGuide = publishedArticles()[0];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          ...softwareApplication({
            offers: PLANS,
            description:
              "ISF and customs entry filing software: file ISF-10, ISF-5, entry summaries (7501) and cargo release (3461) with CBP from one inbox ranked by urgency.",
          }),
        }}
      />

      {/* S1 · Hero */}
      <PageHero
        size="full"
        scene="home"
        eyebrow="ISF and customs entry filing software"
        title="Customs, in focus."
        sub="Customs filing software that shows which ISF or entry needs you now. File ISF-10, ISF-5, entry summaries (7501) and cargo release (3461) with CBP from one inbox, check every draft before it goes, and see the ISF price on this website."
        actions={
          <>
            <DemoButton location="hero" src="home-hero" size="lg" />
            <SecondaryCta location="hero" size="lg" />
          </>
        }
        micro="20 minutes on your kind of shipments. We set your team up after."
      />

      {/* S2 · The day you know (contrast). No CTA. */}
      <Section tone="cream" id="where-filings-go-wrong" aria-labelledby="s2-title">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <SectionHeading
              id="s2-title"
              eyebrow="Where filings go wrong"
              title="You know these screens."
              intro="Most filing teams track house bills in a spreadsheet, file from a vendor screen and read CBP messages in email. The filing that's due tomorrow is in there somewhere. Meanwhile the rules keep moving and the ISF deadline stays exactly where it was."
            />
            <div className="mt-10">
              <SixWindows />
            </div>
          </div>
          <RiskStats />
        </div>
      </Section>

      {/* S3 · Pillar 1: the inbox */}
      <Section tone="sky" id="inbox" accent="inbox" aria-labelledby="s3-title">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="relative min-w-0 lg:pb-14 lg:pr-12">
            {/* Desktop: the browser capture with the phone over its corner. Mobile: the phone alone. */}
            <Screenshot screen="app-compliance-inbox" className="hidden lg:block" />
            <Screenshot
              screen="app-m-compliance"
              sizes="(min-width: 1024px) 184px, 264px"
              className="mx-auto w-[264px] max-w-[72vw] lg:absolute lg:bottom-0 lg:right-0 lg:mx-0 lg:w-[184px]"
            />
            <p className="mt-6 text-center text-[13px] leading-snug text-tone-muted lg:mt-3 lg:pr-48 lg:text-left">
              The inbox with sample data. Each ISF deadline is 24 hours before lading (19 CFR 149.2(b)).
            </p>
          </div>
          <div className="min-w-0">
            <SectionHeading
              id="s3-title"
              eyebrow="An inbox for US customs, not another dashboard"
              title="The inbox ranks itself."
              intro="Open work across ISF, entry and liquidation sits in one list, ordered by urgency. Each ISF has a deadline 24 hours before lading, and you get alerts at 72, 48 and 24 hours before it."
            />
            <p className="mt-3 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
              CBP&apos;s response shows on each filing, so you can see what was accepted, what was rejected and what is still waiting.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3">
              <ProofChip value="72 · 48 · 24 h" label="ISF alerts before the deadline" />
              <ProofChip
                value="314 days"
                label="Each accepted entry tracked to liquidation, with the 300-day PSC deadline in the inbox"
              />
            </div>
            <ArrowLink href={ROUTES.inbox.href} className="mt-8">
              How the inbox ranks your filings
            </ArrowLink>
          </div>
        </div>
      </Section>

      {/* S4 · Pillar 2: caught before CBP */}
      <Section tone="paper" id="pre-filing-checks" accent="checks" aria-labelledby="s4-title">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <SectionHeading
              id="s4-title"
              eyebrow="Pre-filing checks"
              title="Catch it before CBP does."
              intro="Every draft runs through rule-based checks before you can submit it. Want a second read? Run an AI review on any draft. If CBP still rejects the filing, the error comes back in plain English with numbered steps to fix it."
            />
            <h3 className="mt-8 text-[17px] font-semibold tracking-[-0.01em] text-tone-fg">The flags around the filing</h3>
            <CheckList
              className="mt-4"
              items={[
                "New ADD/CVD orders pulled from the Federal Register daily",
                "Possible UFLPA exposure flagged, plus the agencies (FDA, USDA-APHIS, EPA, FCC) that may own an HTS code",
                "HTS code suggestions with alternatives and the reasoning behind them",
              ]}
            />
            <p className="mt-5 text-[13.5px] text-tone-muted">
              MyCargoLens flags and explains. You or your broker make the call.
            </p>
            <ArrowLink href={ROUTES.preFilingChecks.href} className="mt-7">
              What gets checked before you submit
            </ArrowLink>
          </div>
          <div className="relative min-w-0 lg:pb-16">
            <Screenshot screen="app-risk-watch" caption="Risk and watch, with sample data." />
            <Screenshot
              screen="app-compliance-queue"
              className="mt-6 lg:absolute lg:-bottom-4 lg:-left-10 lg:mt-0 lg:w-[62%]"
            />
          </div>
        </div>
      </Section>

      {/* S5 · Audit trail: what's logged and who can see it */}
      <Section tone="mint" id="on-the-record" accent="compliance" aria-labelledby="s5-title">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="relative min-w-0 lg:order-1 order-2">
            <Screenshot
              screen="app-isf-timeline"
              caption="A filing record with sample data: lifecycle, timeline and every CBP response."
            />
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <SectionHeading
              id="s5-title"
              eyebrow="Audit trail"
              title="See who changed what, and what CBP sent back."
              intro="Each filing keeps its own history: who edited it, who submitted it, and every message to and from CBP, with times. Your team works under four roles with MFA, and the full audit trail exports to CSV."
            />
            <ArrowLink href={ROUTES.security.href} className="mt-8">
              How we handle security and access
            </ArrowLink>
          </div>
        </div>
      </Section>

      {/* S6 · Pillar 3: the price */}
      <Section tone="lilac" id="pricing" aria-labelledby="s6-title">
        <SectionHeading
          id="s6-title"
          eyebrow="Pricing"
          title="The ISF price is on the website."
          intro="ISF is $45 per accepted ISF, with no monthly fee. Customs entry is priced on a call, so talk to us."
        />
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
          {PRICE_STRIP.map((p) => (
            <li key={p.name} className="rounded-[20px] p-6 site-surface">
              <p className="text-[15px] font-semibold text-tone-fg">{p.name}</p>
              <p className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.03em] text-tone-fg tabular-nums">
                {p.value}
              </p>
              <p className="mt-2 text-[13.5px] text-tone-muted">{p.unit}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <ul className="space-y-2.5">
            {[
              "You're charged when CBP accepts the ISF.",
              "Rejected filings and amendments aren't charged.",
              "Drafts and manifest queries are free.",
            ].map((rule) => (
              <li key={rule} className="flex gap-3 text-[15.5px] leading-snug text-tone-fg">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-tone-eyebrow" strokeWidth={2.6} />
                {rule}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" size="lg" className="w-fit bg-[hsl(var(--surface))]">
            <Link href={CTA.seePricing.href} data-cta-id={CTA.seePricing.id} data-location="section">
              See full pricing
            </Link>
          </Button>
        </div>
        <div className="mt-10 rounded-2xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--tone-fg)/0.04)] p-5 sm:p-6">
          <p className="text-[15px] leading-relaxed text-tone-muted">
            <span className="font-semibold text-tone-fg">Filing for others at volume?</span> NVOCCs, forwarders and brokers
            get volume pricing on request, agreed in writing. Same rule: charged only when CBP accepts.
          </p>
          <ArrowLink href={`${ROUTES.pricing.href}#volume`} className="mt-3 text-[14.5px]">
            Talk to us about volume pricing
          </ArrowLink>
        </div>
      </Section>

      {/* S7 · Who it's for (persona router) */}
      <Section tone="peach" id="who-its-for" aria-labelledby="s7-title">
        <SectionHeading id="s7-title" title="Which of these sounds like you?" />
        <div className="mt-10">
          <PersonaRouter cards={ROUTER} />
        </div>
        <p className="mt-6 text-[13.5px] text-tone-muted">
          MyCargoLens is software for importers, forwarders, NVOCCs and brokers. We are not a licensed customs broker.
        </p>
      </Section>

      {/* S8 · Your systems (API strip) */}
      <Section tone="ink" id="api" accent="api" aria-labelledby="s8-title">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <SectionHeading
              id="s8-title"
              eyebrow="For your systems"
              title="Your TMS can file through the API."
              intro="The public REST API takes JSON or XML. Create, submit and read ISFs and entries with scoped, revocable keys, and get status back as HMAC-signed webhooks."
            />
            <Button asChild variant="outline" size="lg" className="mt-8 w-fit border-white/20 bg-transparent text-tone-fg hover:bg-white/10 hover:text-tone-fg">
              <Link href={ROUTES.api.href} data-cta-id={CTA.apiOverview.id} data-location="section">
                Read about the API
              </Link>
            </Button>
          </div>
          <div className="min-w-0">
            <pre
              tabIndex={0}
              role="region"
              aria-label="Example: create an ISF draft, submit it, then receive a signed filing.accepted webhook"
              className="m-0 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-5 font-mono text-[12.5px] leading-relaxed text-[hsl(216_30%_85%)] sm:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(205_90%_78%)]"
            >
              <code>
                <span className="text-[hsl(216_20%_58%)]"># 1. create an ISF draft from your TMS</span>
                {"\n"}
                <span className="font-semibold text-a">POST</span> /api/public/v1/shipments
                {"\n"}Authorization: Bearer mcl_live_…{"\n\n"}
                <span className="text-[hsl(216_20%_58%)]"># 2. submit it (same checks as the app)</span>
                {"\n"}
                <span className="font-semibold text-a">POST</span> /api/public/v1/shipments/{"{id}"}/submit{"\n\n"}
                <span className="text-[hsl(216_20%_58%)]"># 3. status comes back, HMAC-SHA256 signed</span>
                {"\n"}
                <span className="font-semibold text-a">webhook</span> filing.accepted{"\n"}
                X-MCL-Event: filing.accepted{"\n"}
                X-MCL-Signature: sha256=9f2c…e41a{"\n"}
                {'{ "event": "filing.accepted", "createdAt": "…", "data": { … } }'}
              </code>
            </pre>
            <p className="mt-4 font-mono text-[12px] leading-relaxed text-tone-muted">
              filing.submitted · filing.accepted · filing.rejected · entry.sent · entry.accepted · entry.rejected
            </p>
          </div>
        </div>
      </Section>

      {/* S9 · Straight answers (FAQ) */}
      <Section tone="mesh" id="faq" width="narrow" aria-labelledby="s9-title">
        <SectionHeading id="s9-title" title="Straight answers." />
        <Faq className="mt-8" items={FAQ} />
        {/* Only a published guide: held-back articles are noindex and unlisted. */}
        {latestGuide && (
          <p className="mt-8 text-[14.5px] text-tone-muted">
            Latest guide:{" "}
            <Link
              href={articleHref(latestGuide.slug)}
              className="font-semibold text-tone-fg underline decoration-current/30 underline-offset-4 hover:decoration-current"
            >
              {latestGuide.shortTitle}
            </Link>
          </p>
        )}
      </Section>

      {/* S10 · Final CTA band */}
      <CtaBand
        title="See how your shipments would run through the inbox."
        sub="Book a 20-minute demo. We'll walk through how you file today, show you the parts that matter and tell you what it costs."
        src="home-close"
        micro="ISF is $45, charged only when CBP accepts. No monthly fee."
        note="Software, not a customs broker"
      />
    </>
  );
}
