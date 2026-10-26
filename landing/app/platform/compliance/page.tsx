import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton, SecondaryCta } from "@/components/site/cta";
import { CertBadge } from "@/components/site/cert-badge";
import { FeatureSplit } from "@/components/site/blocks";
import { Faq } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { webPage } from "@/lib/schema";
import { ROUTES } from "@/lib/site";
import { CtaBand, PRICING_LINK } from "@/components/site/cta-band";
import { InlineLink, SourceNote } from "../pre-filing-checks/_components/module-links";
import { ClockStrip } from "./_components/clock-strip";

const PATH = ROUTES.compliance.href;
const TITLE = "Trade Compliance Software for Importers";
const DESCRIPTION =
  "Track every entry to liquidation with the PSC deadline in view. Daily ADD/CVD pulls, UFLPA and PGA flags, HTS suggestions with reasoning.";
const SRC = "platform-compliance";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: PATH,
    siteName: "MyCargoLens",
    title: `${TITLE} | MyCargoLens`,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: `${TITLE} | MyCargoLens`, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "How long until an entry liquidates?",
    a: "CBP usually liquidates about 314 days after entry. MyCargoLens tracks the estimated date on every accepted entry.",
  },
  {
    q: "When is a post-summary correction due?",
    a: "Within 300 days of the date of entry, CBP's regular PSC window, and before the entry liquidates. MyCargoLens puts the deadline on each entry and in the inbox.",
  },
  {
    q: "Are HTS suggestions binding?",
    a: "No. They're suggestions with reasoning. For a binding answer, ask CBP for a ruling or talk to a licensed broker.",
  },
  {
    q: "How accurate are the HTS suggestions?",
    a: "We don't publish an accuracy number. Treat each suggestion as a starting point and check it before you file.",
  },
  {
    q: "Does a clean UFLPA flag mean we're compliant?",
    a: "No. The flag is a prompt based on origin details and HTS chapter. Your supply chain evidence is what counts.",
  },
  {
    q: "How current is the ADD/CVD list?",
    a: "New orders are pulled from the Federal Register daily and reviewed before use.",
  },
  {
    q: "Is MyCargoLens a customs broker?",
    a: "No. It's software. You or your broker stay in charge of classification and advice.",
  },
];

export default function CompliancePage() {
  return (
    <>
      <JsonLd data={webPage({ path: PATH, name: TITLE, description: DESCRIPTION, aboutSoftware: true })} />

      {/* S1 Hero */}
      <PageHero
        breadcrumbPath={PATH}
        accent="compliance"
        badge={<CertBadge />}
        eyebrow="Compliance"
        title="Trade compliance software for what happens after entry"
        sub="CBP accepting the entry is the start of its clock. MyCargoLens tracks every entry until it liquidates, flags possible ADD/CVD and UFLPA exposure on your HTS codes, and suggests codes with the reasoning shown."
        actions={
          <>
            <DemoButton location="hero" persona="importer" src={SRC} size="lg" />
            <SecondaryCta location="hero" size="lg" />
          </>
        }
        scene="compliance"
      />

      {/* S2 Liquidation, PSC and protest */}
      <Section tone="cream" id="liquidation" accent="compliance">
        <FeatureSplit
          eyebrow="After entry"
          title="Every entry has a 314-day clock"
          body={
            <p>
              CBP usually liquidates an entry about 314 days after entry. Until then you can correct it with a
              post-summary correction, inside CBP&apos;s regular 300-day window from the date of entry. MyCargoLens
              tracks each accepted entry through that window and puts the PSC deadline in your inbox before it closes.
              Entries within 14 days of liquidation show up there too. Once CBP liquidates, the 180-day protest window
              gets its own date.
            </p>
          }
          actions={
            <div className="space-y-4">
              <InlineLink href={ROUTES.inbox.href}>See it in the inbox</InlineLink>
              <SourceNote
                label="CBP, Federal Register doc 2026-13574"
                href="https://public-inspection.federalregister.gov/2026-13574.pdf"
              />
            </div>
          }
          media={<ClockStrip />}
        />
      </Section>

      {/* S3 ADD/CVD */}
      <Section tone="sky" id="add-cvd" accent="compliance">
        <FeatureSplit
          reverse
          eyebrow="Antidumping and countervailing duties"
          title="New ADD/CVD orders, pulled daily"
          body={
            <p>
              MyCargoLens pulls new antidumping and countervailing duty orders from the Federal Register every day. Our
              team reviews each one before it&apos;s used to flag your HTS codes, so a bad parse doesn&apos;t become a
              false alarm on your entry.
            </p>
          }
          screenshot={{
            placeholder: "Recent ADD/CVD updates, each marked reviewed",
            url: "app.mycargolens.com/compliance",
          }}
        />
      </Section>

      {/* S4 UFLPA and PGA */}
      <Section tone="paper" id="risk-flags" accent="compliance">
        <FeatureSplit
          eyebrow="Risk flags"
          title="Possible UFLPA exposure and agency flags by HTS code"
          body={
            <>
              <p>
                Filings are flagged for possible UFLPA exposure when origin details on the parties point to the Xinjiang
                region or the HTS code sits in a high-risk chapter. A flag is a prompt to check your supply chain
                evidence. It doesn&apos;t prove anything either way.
              </p>
              <p>
                For each HTS code, see which agencies may want their own data: FDA, USDA-APHIS, EPA, FCC and others.
              </p>
              <p className="font-medium text-tone-fg">
                Section 301 duties now cover 60 economies from July 24, 2026. A code you filed last year may carry a
                different duty this year.
              </p>
            </>
          }
          actions={
            <div className="space-y-4">
              <InlineLink href={ROUTES.preFilingChecks.href}>How flags show up on a draft</InlineLink>
              <SourceNote
                label="Thomson Reuters, Jul 24 2026"
                href="https://www.thomsonreuters.com/en-us/help/onesource-global-trade/regulatory-insights/2026/july-24th/us-imposes-section-301-forced-labor-tariffs-60"
              />
            </div>
          }
          screenshot={{ screen: "app-risk-watch" }}
        />
      </Section>

      {/* S5 HTS suggestions */}
      <Section tone="mint" id="hts-suggestions" accent="compliance">
        <FeatureSplit
          reverse
          eyebrow="Classification help"
          title="HTS suggestions with the reasoning shown"
          body={
            <p>
              Describe the goods. MyCargoLens suggests an HTS code, a few alternatives, and why each one might fit. Your
              team or your broker picks the code.
            </p>
          }
          actions={
            <p className="rounded-2xl border border-[hsl(var(--a)/0.3)] bg-a-soft px-4 py-3 text-[15px] leading-relaxed text-tone-fg">
              These are suggestions, not rulings. We don&apos;t publish an accuracy figure, and you shouldn&apos;t file a
              code you haven&apos;t checked.
            </p>
          }
          screenshot={{
            placeholder: "HTS suggestion: one suggested code and two alternatives, each with its reasoning",
            url: "app.mycargolens.com/compliance",
          }}
        />
      </Section>

      {/* S6 Duty and FTA */}
      <Section tone="lilac" id="duty-fta" accent="compliance">
        <FeatureSplit
          eyebrow="Landed cost"
          title="The duty before you file, and the first FTA question answered"
          body={
            <>
              <p>
                The duty calculator shows the rate, MPF, HMF and total for a line from HTS reference data. The FTA lookup
                tells you which trade programs include the origin country. Whether the goods meet the rules of origin
                stays your call.
              </p>
              <p className="text-[13.5px]">The duty calculator is on the Complete plan.</p>
            </>
          }
          actions={<InlineLink href={ROUTES.customsEntry.href}>File the entry with these numbers</InlineLink>}
          screenshot={{
            placeholder: "Duty calculator result: rate, MPF, HMF and total for one line",
            url: "app.mycargolens.com/compliance",
          }}
        />
      </Section>

      {/* S7 FAQ */}
      <Section tone="mesh" id="faq" width="narrow" accent="compliance">
        <SectionHeading title="Questions about compliance tracking" />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      {/* S8 Final CTA band */}
      <CtaBand
        title="See your entries on the clock"
        sub="Book a 20-minute demo. We'll show the liquidation clock, the PSC deadline and the flags on entries like yours."
        persona="importer"
        src={SRC}
        links={[PRICING_LINK]}
      />
    </>
  );
}
