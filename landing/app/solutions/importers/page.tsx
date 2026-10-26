import * as React from "react";
import Link from "next/link";
import { FileStack, MessagesSquare, Ship } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton, SecondaryCta } from "@/components/site/cta";
import { CertBadge } from "@/components/site/cert-badge";
import { CardGrid, CheckList, FeatureSplit } from "@/components/site/blocks";
import { Faq, type FaqItem } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { StickyDemoBar } from "@/components/site/sticky-demo-bar";
import { webPage } from "@/lib/schema";
import { ROUTES } from "@/lib/site";
import { CtaBand, PRICING_LINK } from "@/components/site/cta-band";
import { ArrowLink, DashList, pageMetadata } from "../_components/page-bits";

// Copy: marketing/deliverables/2026-10-23-website-rework/copy/solutions-importers.md
const PATH = ROUTES.importers.href;
const DESCRIPTION =
  "See and check every ISF and entry you file under your IOR number before CBP does. $45 ISF, $180 ISF + Entry, charged only when CBP accepts.";

export const metadata = pageMetadata({
  path: PATH,
  title: "Importer self-filing software: ISF and entry",
  description: DESCRIPTION,
  ogTitle: "Check every ISF and entry before CBP does",
});

const AJOT_URL = "https://www.ajot.com/news/us-importers-turn-to-brokers-to-navigate-trump-era-tariffs-at-a-cost";
const TR_301_URL =
  "https://www.thomsonreuters.com/en-us/help/onesource-global-trade/regulatory-insights/2026/july-24th/us-imposes-section-301-forced-labor-tariffs-60";

const TIERS = [
  { name: "ISF Filing", price: "$45", body: "ISF-10 and ISF-5, templates, manifest query, deadline tracking", module: "isf" as const },
  {
    name: "ISF + Entry",
    price: "$180",
    body: "+ Entry summary (7501) and cargo release (3461); a linked ISF and entry billed once",
    module: "entry" as const,
  },
  { name: "Complete", price: "$280", body: "+ Container tracking and the duty calculator", module: "compliance" as const },
];

const FAQ: FaqItem[] = [
  {
    q: "Is MyCargoLens a customs broker?",
    a: "No. MyCargoLens is software for importers, forwarders, NVOCCs and customs brokers. You, or your broker, stay in charge of advice and classification decisions.",
  },
  {
    q: "Our broker already files for us. Why would we use this?",
    a: "You might keep them. You can file your own ISFs and leave entries with the broker, or file both and keep the broker for advice. Either way, everything you file through MyCargoLens is checked before it goes and tracked through liquidation in one inbox.",
  },
  {
    q: "Is $180 cheaper than a broker?",
    a: "Often it's about the same as a typical broker fee per shipment. The difference is that the price is written on our website, a linked ISF and entry is billed once, and rejected filings aren't charged.",
  },
  {
    q: "Do we need our own filer code and bond to file?",
    a: "Self-filing has requirements of its own, and they depend on what you file. Ask us on the demo and we'll go through what you'd need on day one.",
  },
  {
    q: "If something goes wrong, who's responsible?",
    a: "The importer of record stays responsible for its filings, whoever transmits them. That's why the deadline clock, the checks and the full record of every CBP request and response matter. We flag and explain; we don't promise to prevent penalties.",
  },
  {
    q: "Who sends our filings to CBP?",
    a: "We do. MyCargoLens is CBP ABI certified, with a direct connection to CBP, and every request and response is logged.",
  },
  {
    q: "Does the AI pick the right HTS code?",
    a: "It suggests a code with alternatives and its reasoning. Your team or your broker makes the call. We don't publish an accuracy figure.",
  },
  {
    q: "What happens if CBP rejects an entry?",
    a: "You get the error in plain English with numbered fix steps. Fix it and resubmit. Rejected filings aren't charged, and the resubmit is never charged twice.",
  },
  {
    q: "Is there a monthly fee?",
    a: "There's no monthly fee on the public plans. You pay per shipment when CBP accepts it.",
  },
];

const linkCls = "font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current";

export default function ImportersPage() {
  return (
    <>
      <JsonLd
        data={{
          ...webPage({ path: PATH, name: "Importer self-filing software: ISF and entry", description: DESCRIPTION, aboutSoftware: true }),
          audience: { "@type": "BusinessAudience", name: "Importers of record" },
        }}
      />

      <PageHero
        breadcrumbPath={PATH}
        accent="checks"
        badge={<CertBadge />}
        eyebrow="For importers who file their own"
        title={
          <>
            Check every ISF and entry before CBP does.
            <span className="mt-3 block text-[20px] font-medium leading-snug tracking-[-0.015em] text-tone-muted sm:text-[24px]">
              Importer self-filing software, from ISF to liquidation.
            </span>
          </>
        }
        sub="File ISF-10, entry summaries (7501) and cargo release (3461) under your IOR number. Every draft is checked before it goes, and the price per shipment is on our website, charged only when CBP accepts."
        actions={
          <>
            <DemoButton persona="importer" location="hero" src="importer-hero" size="lg" />
            <SecondaryCta location="hero" size="lg" />
          </>
        }
        micro="Bring your last rejection and we'll walk through it."
        scene="importers"
      />

      {/* S2 · You and your broker */}
      <Section tone="cream" id="you-and-your-broker">
        <SectionHeading eyebrow="You and your broker" title="Keep your broker for advice. File and see your own filings." />
        <p className="mt-5 max-w-3xl text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
          Brokers have had a hard year too. One brokerage CEO{" "}
          <a href={AJOT_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-current/35 underline-offset-2 hover:text-tone-fg">
            told Reuters<span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          they raised US rates &ldquo;because of the new and added complexity&rdquo;. Whoever transmits, the importer of record stays
          responsible for the filing. That&apos;s why it helps to see what goes out under your name before CBP does.
        </p>
        <CardGrid
          className="mt-10"
          items={[
            { icon: Ship, module: "isf", title: "File your own ISFs", body: "and leave entries with your broker." },
            {
              icon: FileStack,
              module: "entry",
              title: "File ISF and entry together",
              body: (
                <>
                  with the entry{" "}
                  <Link href={ROUTES.customsEntry.href} className={linkCls}>
                    prefilled from the accepted ISF
                  </Link>{" "}
                  and the bond carried over.
                </>
              ),
            },
            {
              icon: MessagesSquare,
              module: "inbox",
              title: "Keep a broker for advice",
              body: "on classification and compliance questions while your team files and tracks in one inbox.",
            },
          ]}
        />
        <p className="mt-8 text-[14px] leading-relaxed text-tone-muted">
          MyCargoLens is software. We&apos;re not a customs broker, and we don&apos;t give classification or legal advice.
        </p>
        <p className="mt-4 text-[15px] text-tone-muted">
          Comparing your options? <ArrowLink href={ROUTES.compare.href}>See how we compare</ArrowLink>
        </p>
      </Section>

      {/* S3 · Pillar 2: checks */}
      <Section tone="sky" id="checks" accent="checks">
        <FeatureSplit
          eyebrow="Checks"
          title="Catch it before CBP does"
          body={
            <p>
              Tariffs keep moving. Section 301 duties now apply to goods from 60 economies,{" "}
              <a href={TR_301_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-current/35 underline-offset-2 hover:text-tone-fg">
                from July 24, 2026<span className="sr-only"> (opens in a new tab)</span>
              </a>
              . A CBP rejection is an expensive way to find out a rule changed. MyCargoLens checks each draft before it goes and
              flags what needs a second look. You or your broker make the call.
            </p>
          }
          bullets={[
            "Every draft passes rule-based checks before submit, and you can run an AI review on any draft",
            "If CBP rejects, the error comes back in plain English with numbered fix steps",
            "New ADD/CVD orders pulled from the Federal Register daily",
            "Flags filings with possible UFLPA exposure, and shows which agencies (FDA, USDA-APHIS, EPA, FCC) may own an HTS code",
            "HTS code suggestions with alternatives and the reasoning behind them",
            "Duty calculator: rates, MPF/HMF and the total from HTS reference data",
          ]}
          actions={<ArrowLink href={ROUTES.preFilingChecks.href}>How pre-filing checks work</ArrowLink>}
          screenshot={{ screen: "app-risk-watch", caption: "Risk and watch: UFLPA flags and the PGA lookup. Sample data." }}
        />
      </Section>

      {/* S4 · Pillar 1: the inbox */}
      <Section tone="paper" id="inbox" accent="compliance">
        <FeatureSplit
          reverse
          eyebrow="The inbox"
          title="Every entry has a 314-day clock"
          body={
            <p>
              Open work across ISF, entry and liquidation is ranked by urgency in one inbox. You start with the few filings that
              need you today.
            </p>
          }
          bullets={[
            "ISF deadline clock set 24 hours before lading, with alerts at 72, 48 and 24 hours before it",
            "CBP responses picked up every minute, and any transmission CBP hasn't answered gets flagged",
            "Each accepted entry tracked through its 314-day liquidation window, with the post-summary correction deadline (300 days from entry, CBP's regular PSC window) in the inbox",
            "Container tracking with vessel ETAs and last free day, on the Complete plan",
          ]}
          actions={<ArrowLink href={ROUTES.compliance.href}>See the compliance view</ArrowLink>}
          screenshot={{ screen: "app-liquidation-clocks", caption: "Liquidation pipeline, a clock per entry. Sample data." }}
        />
      </Section>

      {/* S5 · Pillar 3: the price */}
      <Section tone="mint" id="pricing">
        <SectionHeading eyebrow="Pricing" title="The price is on the website" />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => (
            <li key={t.name} className={`acc-${t.module} flex flex-col rounded-[20px] p-6 site-surface`}>
              <span aria-hidden className="mb-4 block h-1 w-10 rounded-full bg-a" />
              <h3 className="text-[15px] font-semibold text-tone-fg">{t.name}</h3>
              <p className="mt-2 text-tone-fg">
                <span className="text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{t.price}</span>{" "}
                <span className="text-[14px] text-tone-muted">per shipment</span>
              </p>
              <p className="mt-4 text-[14.5px] leading-relaxed text-tone-muted">{t.body}</p>
            </li>
          ))}
        </ul>
        <CheckList
          className="mt-8"
          items={[
            "You're charged when CBP accepts the shipment. Rejected filings aren't charged",
            "Resubmits and amendments are never charged twice",
            "No monthly fee. Drafts and manifest queries are free",
          ]}
        />
        <p className="mt-6 max-w-3xl text-[15.5px] leading-relaxed text-tone-muted">
          At $180, ISF + Entry costs about what many brokers charge per shipment. For that you get one written price per shipment
          and the filing in your own hands.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <DemoButton persona="importer" location="section" src="importer-pricing" />
          <ArrowLink href={ROUTES.pricing.href}>Full pricing and FAQ</ArrowLink>
        </div>
        <p className="mt-5 text-[13px] text-tone-muted">
          Filing for others at volume? See{" "}
          <Link href="/pricing#volume" className="underline decoration-current/35 underline-offset-2 hover:text-tone-fg">
            volume pricing
          </Link>
          .
        </p>
      </Section>

      {/* S6 · Trust bar (short band) */}
      <Section tone="lilac" id="on-the-record" spacing="compact">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto] md:gap-10">
          <div className="min-w-0">
            <h2 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.025em] text-tone-fg sm:text-[28px]">
              CBP ABI certified. Every transmission on the record.
            </h2>
            <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-tone-muted">
              Direct connection to CBP. Every CBP request and
              response is logged, and your team works with four roles, MFA and an audit trail you can export to CSV.
            </p>
          </div>
          <ArrowLink href={ROUTES.security.href}>Security</ArrowLink>
        </div>
      </Section>

      {/* S7 · Fit (S8 proof slot hidden until a permissioned quote exists) */}
      <Section tone="peach" id="fit">
        <SectionHeading title="Who this is built for" />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="acc-checks rounded-[20px] p-6 site-surface sm:p-8">
            <h3 className="text-[15px] font-semibold text-tone-fg">A good fit</h3>
            <CheckList
              className="mt-4"
              items={[
                "Importers who ship every week or month and want their own team to see and check each ISF and entry.",
                "Teams that need several people with different roles in one account.",
              ]}
            />
          </div>
          <div className="rounded-[20px] border border-[hsl(var(--surface-border))] p-6 sm:p-8">
            <h3 className="text-[15px] font-semibold text-tone-fg">Probably not a fit yet</h3>
            <DashList
              className="mt-4"
              items={[
                "One-off shipments, where a licensed broker or a DIY filing service will usually be simpler and cost less.",
                "Teams that need FTZ, drawback or AES in the same tool.",
              ]}
            />
          </div>
        </div>
      </Section>

      {/* S9 · FAQ */}
      <Section tone="mesh" id="faq" width="narrow">
        <SectionHeading title="Questions importers ask" />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      <CtaBand
        title="See your own kind of shipment in the inbox."
        sub="In 20 minutes we'll walk through how you file today, run a draft through the checks, and tell you what it would cost per shipment. Then we set your team up."
        persona="importer"
        src="importer-close"
        links={[PRICING_LINK]}
        micro="Pay per shipment, only when CBP accepts. No monthly fee on the public plans."
      />
      <StickyDemoBar persona="importer" src="importer-sticky" />
    </>
  );
}
