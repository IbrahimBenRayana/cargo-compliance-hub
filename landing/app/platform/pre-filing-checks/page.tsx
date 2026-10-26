import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton, SecondaryCta } from "@/components/site/cta";
import { CertBadge } from "@/components/site/cert-badge";
import { FeatureSplit } from "@/components/site/blocks";
import { Faq } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { webPage } from "@/lib/schema";
import { ROUTES } from "@/lib/site";
import { CheckPanel } from "./_components/check-panel";
import { CtaBand, PRICING_LINK } from "@/components/site/cta-band";
import { InlineLink, SourceNote } from "./_components/module-links";

const PATH = ROUTES.preFilingChecks.href;
const TITLE = "Customs Filing Error Checks Before You Submit";
const DESCRIPTION =
  "Rule checks on every ISF and entry draft, an optional AI review, and CBP rejections explained in plain English with numbered fix steps.";
const SRC = "platform-checks";

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
    q: "Can I submit a filing that fails a check?",
    a: "Not if it has a critical error. Warnings don't block you; they tell you what to look at.",
  },
  {
    q: "Do API and bulk submissions get the same checks?",
    a: "Yes. Every submit path runs the same checks first.",
  },
  {
    q: "Is the AI review required?",
    a: "No. It runs only when someone on your team asks for it.",
  },
  {
    q: "Does the AI see our data?",
    a: "It sees the filing it's reviewing, sent with the setting that asks the provider not to store it.",
  },
  {
    q: "If CBP rejects a filing, do we pay again to resubmit?",
    a: "No. You're charged when CBP accepts the shipment, and resubmits and amendments are never charged twice.",
  },
  {
    q: "Will this stop all rejections?",
    a: "No. It catches the errors the rules and the review can see, and explains the rest when CBP answers.",
  },
  {
    q: "Does it replace my broker's review?",
    a: "No. MyCargoLens is software, not a customs broker. It gives your team or broker a cleaner draft and a clearer answer.",
  },
];

export default function PreFilingChecksPage() {
  return (
    <>
      <JsonLd data={webPage({ path: PATH, name: TITLE, description: DESCRIPTION, aboutSoftware: true })} />

      {/* S1 Hero */}
      <PageHero
        breadcrumbPath={PATH}
        accent="checks"
        badge={<CertBadge />}
        eyebrow="Pre-filing checks"
        title="Catch filing errors before CBP does"
        sub="Every ISF and entry draft is checked against the rules before you can submit it. Ask for an AI review when a draft looks off. And if CBP still rejects it, the error comes back in plain English with the steps to fix it."
        actions={
          <>
            <DemoButton location="hero" src={SRC} size="lg" />
            <SecondaryCta location="hero" size="lg" />
          </>
        }
        micro="Bring your last rejection and we'll walk through it."
        scene="pre-filing-checks"
      />

      {/* S2 Layer 1: rule checks */}
      <Section tone="cream" id="rule-checks" accent="checks">
        <FeatureSplit
          eyebrow="Every draft"
          title="Rule checks run on every draft, every time"
          body={
            <p>
                Before a filing can go to CBP, it passes a fixed set of checks, on ISF and{" "}
                <Link href={ROUTES.customsEntry.href} className="font-medium text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current">
                  entry
                </Link>{" "}
                drafts alike. They&apos;re the same whether you submit from the app, in bulk, or through the API.
            </p>
          }
          bullets={[
            "HTS code must be 6 to 10 digits in a valid chapter",
            "Country codes must be valid two-letter ISO codes",
            "SCAC must be exactly four letters",
            "Arrival date must be after departure",
            "Importer of record number required",
            "ISF-5 needs the booking party",
            "Deadline under 24 hours away, or already passed",
          ]}
          actions={
            <p className="text-[16px] leading-relaxed text-tone-muted">
              Critical errors block the submit. Warnings tell you what to look at.
            </p>
          }
          media={<CheckPanel />}
        />
      </Section>

      {/* S3 Layer 2: AI review */}
      <Section tone="sky" id="ai-review" accent="checks">
        <FeatureSplit
          reverse
          eyebrow="Optional"
          title="A second read of the draft before it goes"
          body={
            <>
              <p>
                On any draft, ask the AI to review it. It reads the filing and points out what looks inconsistent: a
                description that doesn&apos;t match the HTS chapter, a party that looks incomplete. It runs only when you
                ask, and your team makes the call.
              </p>
              <p className="text-[13.5px]">
                We send only the filing being reviewed, with the setting that asks the AI provider not to store it.
              </p>
            </>
          }
        />
      </Section>

      {/* S4 Layer 3: rejections in plain English */}
      <Section tone="paper" id="rejections" accent="checks">
        <FeatureSplit
          eyebrow="If CBP says no"
          title="Rejections come back in plain English"
          body={
            <>
              <p>
                CBP answers with codes. MyCargoLens translates the code into what went wrong and numbered steps to fix
                it, right on the filing. Fix it, resubmit, and you&apos;re never charged twice for the same shipment.
              </p>
              <p>
                When three or more recent rejections share one cause, the inbox shows it once with every affected
                filing, so you fix the template, not twenty filings.
              </p>
            </>
          }
        />
      </Section>

      {/* S5 Risk flags */}
      <Section tone="mint" id="risk-flags" accent="checks">
        <FeatureSplit
          reverse
          eyebrow="Risk flags"
          title="Duty and agency flags while you're still drafting"
          body={
            <p>
              The rules keep moving. Section 301 duties now cover 60 economies from July 24, 2026. MyCargoLens flags
              what you&apos;d want to know before you file:
            </p>
          }
          bullets={[
            "HTS codes that may fall under an ADD/CVD order, from orders pulled from the Federal Register daily.",
            "Possible UFLPA exposure, from origin details on the parties and high-risk HTS chapters.",
            "Agencies that may own the code: FDA, USDA-APHIS, EPA, FCC and others.",
          ]}
          actions={
            <div className="space-y-4">
              <p className="text-[16px] font-medium text-tone-fg">We flag and explain. You or your broker decide.</p>
              <InlineLink href={ROUTES.compliance.href}>ADD/CVD and UFLPA flags in detail</InlineLink>
              <SourceNote
                label="Thomson Reuters, Jul 24 2026"
                href="https://www.thomsonreuters.com/en-us/help/onesource-global-trade/regulatory-insights/2026/july-24th/us-imposes-section-301-forced-labor-tariffs-60"
              />
            </div>
          }
          screenshot={{ screen: "app-risk-watch" }}
        />
      </Section>

      {/* S6 FAQ */}
      <Section tone="mesh" id="faq" width="narrow" accent="checks">
        <SectionHeading title="Questions about the checks" />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      {/* S7 Final CTA band */}
      <CtaBand
        title="Bring your last rejection"
        sub="Book a 20-minute demo. We'll rebuild the filing in a demo account and walk through what the checks flag on it."
        src={SRC}
        links={[PRICING_LINK]}
      />
    </>
  );
}
