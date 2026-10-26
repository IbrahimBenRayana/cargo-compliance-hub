import * as React from "react";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton } from "@/components/site/cta";
import { CheckList, FeatureSplit } from "@/components/site/blocks";
import { Screenshot } from "@/components/site/screenshot";
import { Faq, type FaqItem } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { StickyDemoBar } from "@/components/site/sticky-demo-bar";
import { webPage } from "@/lib/schema";
import { ROUTES } from "@/lib/site";
import { isArticleLive } from "@/app/resources/_content/articles";
import { CtaBand } from "@/components/site/cta-band";
import { ArrowLink, DashList, OutlineLink, pageMetadata } from "../_components/page-bits";
import { HouseBillsIllustration } from "../_components/house-bills";

// Copy: marketing/deliverables/2026-10-23-website-rework/copy/solutions-nvocc-forwarders.md
const PATH = ROUTES.nvoccForwarders.href;
const DESCRIPTION =
  "File ISF-10 and ISF-5 for every house bill from your TMS or in bulk, each with a deadline clock. Volume pricing on request.";
const DESIGN_PARTNERS =
  "We're taking a small number of NVOCC and forwarder design partners: API onboarding with the founder, and volume pricing agreed in writing.";
const VOLUME = "/pricing#volume";

export const metadata = pageMetadata({
  path: PATH,
  title: "ISF filing software for NVOCCs and forwarders",
  description: DESCRIPTION,
  ogTitle: "Every house bill on a deadline clock",
});

const SOURCES = [
  { label: "19 CFR 149.2(b)", href: "https://www.law.cornell.edu/cfr/text/19/149.2" },
  { label: "CBP ISF FAQ 2.0 (May 2023)", href: "https://www.cbp.gov/sites/default/files/assets/documents/2023-May/ISF%20FAQ%202.0%20(508).pdf" },
  { label: "Great Lakes Customs Law", href: "https://greatlakescustomslaw.com/?p=9030" },
];

const API_SAMPLE = `# 1. create an ISF draft from your TMS
POST /api/public/v1/shipments
Authorization: Bearer mcl_live_…

# 2. submit it (same checks as the app)
POST /api/public/v1/shipments/{id}/submit

# 3. status comes back, HMAC-SHA256 signed
webhook  filing.accepted · filing.rejected`;

const FAQ: FaqItem[] = [
  {
    q: "Who actually sends our ISFs to CBP?",
    a: "MyCargoLens does, whether your team submits in the app or your TMS submits through the API.",
  },
  {
    q: "We already use another ISF or ABI system. Do we have to switch everything?",
    a: "No. You can start with one lane or one customer's ISFs, run it next to what you have, and decide from there. Your existing system can keep everything else.",
  },
  {
    q: "We pay much less per ISF today. Why would we pay $45?",
    a: "You wouldn't. $45 is the importer price on our website. NVOCCs and forwarders filing at volume get volume pricing on request, agreed in writing, with the same rule: charged only when CBP accepts.",
  },
  {
    q: "Do we need a developer to get started?",
    a: "No. You can file in the app from day one with templates, cloning and bulk submit of up to 20 drafts. When you're ready, your TMS can create and submit filings through the REST API in JSON or XML, and get signed status webhooks back.",
  },
  { q: "Can we file ISF-5 for FROB cargo?", a: "Yes. MyCargoLens files ISF-10 and ISF-5." },
  {
    q: "Do you file in-bond, AES or FTZ, or sell ISF bonds?",
    a: "Not today. We file ISF-10, ISF-5, entry summaries (7501) and cargo release (3461).",
  },
  {
    q: "What happens when CBP rejects an ISF?",
    a: "The error comes back in plain English with numbered fix steps. You fix it and resubmit, and the resubmit is never charged twice.",
  },
  {
    q: "Are you a customs broker?",
    a: "No. MyCargoLens is software. Your team stays the filer, and the importer of record stays responsible for the filing.",
  },
];

export default function NvoccForwardersPage() {
  return (
    <>
      <JsonLd
        data={{
          ...webPage({ path: PATH, name: "ISF filing software for NVOCCs and forwarders", description: DESCRIPTION, aboutSoftware: true }),
          audience: { "@type": "BusinessAudience", name: "NVOCCs and freight forwarders" },
        }}
      />

      <PageHero
        breadcrumbPath={PATH}
        accent="isf"
        eyebrow="For NVOCCs and freight forwarders"
        title={
          <>
            Every house bill on a deadline clock.
            <span className="mt-3 block text-[20px] font-medium leading-snug tracking-[-0.015em] text-tone-muted sm:text-[24px]">
              ISF filing software for NVOCCs and forwarders.
            </span>
          </>
        }
        sub="File ISF-10 and ISF-5 from your TMS through our API, or in bulk from templates. Each ISF gets a clock set 24 hours before lading, with alerts at 72, 48 and 24 hours before it."
        actions={
          <>
            <DemoButton persona="nvocc" location="hero" src="nvocc-hero" size="lg" />
            <OutlineLink href={ROUTES.api.href} location="hero" size="lg">
              See the API
            </OutlineLink>
          </>
        }
        micro={DESIGN_PARTNERS}
        scene="nvocc-forwarders"
      />

      {/* S2 · The problem */}
      <Section tone="cream" id="the-problem" accent="isf">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <SectionHeading eyebrow="Why the ISF desk gets busy" title="One master bill. Several house bills. Several clocks." />
            <div className="mt-5 space-y-3 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
              <p>
                The ISF is due 24 hours before the cargo is laden at the foreign port. On a consolidation each house bill is its
                own ISF, so each one carries its own liquidated-damages exposure. CBP&apos;s guideline amount is $5,000 per
                violation. Five late house bills on one consolidation is $25,000 of exposure.
              </p>
              <p>And the shipper&apos;s data is often the last thing to arrive.</p>
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-tone-muted">
              Sources:{" "}
              {SOURCES.map((s, i) => (
                <React.Fragment key={s.href}>
                  {i > 0 && " · "}
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline decoration-current/35 underline-offset-2 hover:text-tone-fg">
                    {s.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </React.Fragment>
              ))}
              . Figures are CBP&apos;s guideline amounts, not a prediction of any claim.
            </p>
            {isArticleLive("isf-late-filing-penalties") && (
              <ArrowLink href={ROUTES.isfLateFilingPenalties.href} className="mt-5">
                {ROUTES.isfLateFilingPenalties.label}
              </ArrowLink>
            )}
          </div>
          <div className="min-w-0">
            <HouseBillsIllustration />
          </div>
        </div>
      </Section>

      {/* S3 · Pillar 1: the inbox */}
      <Section tone="sky" id="inbox" accent="inbox">
        <FeatureSplit
          eyebrow="The inbox"
          title="Know which house bill needs you now"
          body={
            <p>
              Open work is ranked by urgency in one inbox, so the ISF due tomorrow sits above the one due next week. House bills
              under one master stay linked, each with its own clock. See{" "}
              <Link href={ROUTES.isfFiling.href} className="font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current">
                how ISF filing works
              </Link>
              .
            </p>
          }
          bullets={[
            "Deadline clock on every ISF, with alerts at 72, 48 and 24 hours before it",
            "CBP's response on every ISF: accepted, rejected or still waiting",
            "Manifest (MBOL) query by master bill shows CBP's disposition per house bill, so you can see whether the bill is on file. Queries are free",
            "Every filing's full history in one timeline, with a PDF export",
          ]}
          actions={<ArrowLink href={ROUTES.inbox.href}>How the inbox ranks work</ArrowLink>}
          media={
            <div className="relative">
              <Screenshot screen="app-isf-consolidation" />
              <Screenshot
                screen="app-manifest-dispositions"
                aspect="16/9"
                sizes="(min-width: 1024px) 300px, 80vw"
                className="mt-6 w-[85%] lg:absolute lg:-bottom-14 lg:-right-6 lg:mt-0 lg:w-[52%]"
              />
              <p className="mt-3 text-[13px] leading-snug text-tone-muted lg:max-w-[45%]">
                Consolidation OOLU210577643: three house bills, each its own ISF, and the manifest query per house bill. Sample data.
              </p>
            </div>
          }
        />
      </Section>

      {/* S4 · File at your volume */}
      <Section tone="paper" id="two-ways-in" accent="api">
        <SectionHeading eyebrow="Two ways in" title="Start in the app. Add the API when you're ready." intro="You don't need a developer to start." />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="acc-isf flex min-w-0 flex-col rounded-[20px] p-6 site-surface sm:p-8">
            <h3 className="text-[19px] font-semibold tracking-[-0.015em] text-tone-fg">In the app: templates and bulk submit</h3>
            <CheckList
              className="mt-5"
              items={[
                "Save parties, ports, HTS lines and bond details as templates for repeat shippers",
                "Clone any filing",
                "Submit up to 20 drafts at once",
                "File ISF-10, and ISF-5 for FROB cargo",
              ]}
            />
            <Screenshot screen="app-shipments-list" aspect="16/10" className="mt-8" sizes="(min-width: 1024px) 520px, 100vw" />
          </div>
          <div className="flex min-w-0 flex-col rounded-[20px] p-6 site-surface sm:p-8">
            <h3 className="text-[19px] font-semibold tracking-[-0.015em] text-tone-fg">From your TMS: REST or XML API</h3>
            <CheckList
              className="mt-5"
              items={[
                <>
                  <code className="font-mono text-[14px]">/api/public/v1</code>: create, submit and read ISFs and entries
                </>,
                "JSON or XML, with scoped, revocable keys",
                <>
                  HMAC-SHA256-signed <code className="font-mono text-[14px]">filing.*</code> and{" "}
                  <code className="font-mono text-[14px]">entry.*</code> webhooks push status back to your system
                </>,
                "The same checks and audit trail as the app",
              ]}
            />
            <pre tabIndex={0} className="mt-8 overflow-x-auto rounded-2xl bg-[hsl(224_50%_7%)] p-5 font-mono text-[12.5px] leading-relaxed text-[hsl(216_30%_85%)] ring-1 ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(205_90%_78%)]">
              {API_SAMPLE}
            </pre>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <OutlineLink href={ROUTES.api.href} location="section">
            See the API
          </OutlineLink>
          <p className="text-[13px] text-tone-muted">The API is at version 1.0.0-foundation. There are no SDKs yet.</p>
        </div>
      </Section>

      {/* S5 · Audit trail */}
      <Section tone="mint" id="on-the-record">
        <FeatureSplit
          reverse
          eyebrow="Audit trail"
          title="Show a customer exactly what was filed."
          body={
            <p>
              Every edit, submission and CBP response stays on the filing, so you can show what was sent, when and by whom.
              Your team works under four roles (Owner, Admin, Operator, Viewer) with MFA, and the audit trail exports to CSV.
            </p>
          }
          actions={<ArrowLink href={ROUTES.security.href}>Security and audit trail</ArrowLink>}
          screenshot={{ screen: "app-isf-timeline", caption: "The filing record: every transmission and CBP response. Sample data." }}
        />
      </Section>

      {/* S6 · Pricing for volume filers */}
      <Section tone="lilac" id="pricing">
        <div className="mx-auto max-w-3xl rounded-[24px] border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-6 sm:p-10">
          <SectionHeading eyebrow="Pricing" title="Volume pricing, written down" />
          <div className="mt-5 space-y-3 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
            <p>
              The per-shipment card on our pricing page is built for importers filing their own shipments. Teams filing ISFs at
              volume get volume pricing on request, agreed in writing.
            </p>
            <p className="text-tone-fg">{DESIGN_PARTNERS}</p>
          </div>
          <CheckList
            className="mt-6"
            items={[
              "You're charged when CBP accepts the shipment",
              "Rejected filings aren't charged, and resubmits and amendments are never charged twice",
              "Drafts and manifest queries are free",
            ]}
          />
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <DemoButton persona="nvocc" location="section" src="nvocc-pricing" />
            <ArrowLink href={VOLUME}>How pricing works</ArrowLink>
          </div>
          <p className="mt-4 text-[13px] text-tone-muted">Tell us your monthly ISF count. We&apos;ll send the volume terms in writing.</p>
        </div>
      </Section>

      {/* S7 · Scope */}
      <Section tone="peach" id="scope">
        <SectionHeading title="What MyCargoLens files today" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <div className="acc-checks rounded-[20px] p-6 site-surface">
            <h3 className="text-[15px] font-semibold text-tone-fg">Files today</h3>
            <CheckList
              className="mt-4"
              items={["ISF-10", "ISF-5 (FROB)", "Entry summary (7501)", "Cargo release (3461)", "Manifest (MBOL) query"]}
            />
          </div>
          <div className="rounded-[20px] border border-[hsl(var(--surface-border))] p-6">
            <h3 className="text-[15px] font-semibold text-tone-fg">Not available</h3>
            <DashList className="mt-4" items={["In-bond (7512)", "FTZ", "Drawback", "AES", "ISF bonds"]} />
          </div>
        </div>
        <p className="mt-6 max-w-2xl text-[15.5px] leading-relaxed text-tone-muted">
          If you need those in the same system every week, a broader suite may fit you better today. Tell us on the call and
          we&apos;ll say so.
        </p>
      </Section>

      {/* S8 · Proof without logos (quote slot hidden until a permissioned quote exists) */}
      <Section tone="mesh" id="proof">
        <SectionHeading title="What you can check before you sign" />
        <dl className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["The price principle", "Written on our website: you're charged only when CBP accepts."],
            ["What we file", "ISF-10, ISF-5, 7501 and 3461, plus manifest queries."],
            ["The record", "Every CBP request and response, logged and exportable."],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[20px] p-6 site-surface">
              <dt className="text-[12px] font-semibold uppercase tracking-[0.14em] text-tone-eyebrow">{k}</dt>
              <dd className="mt-2 text-[16px] leading-relaxed text-tone-fg">{v}</dd>
            </div>
          ))}
        </dl>
        <ArrowLink href={ROUTES.changelog.href} className="mt-8">
          See what we&apos;ve shipped
        </ArrowLink>
      </Section>

      {/* S9 · FAQ */}
      <Section tone="cream" id="faq" width="narrow">
        <SectionHeading title="Questions NVOCC teams ask" />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      <CtaBand
        title="Bring a week of house bills."
        sub="In 20 minutes we'll show your kind of consolidations in the inbox, how your TMS could file through the API, and how our design-partner program works. Then we set your team up."
        persona="nvocc"
        src="nvocc-close"
        links={[{ label: "See the API", href: ROUTES.api.href }]}
        micro="Volume and API pricing, written down."
      />
      <StickyDemoBar persona="nvocc" src="nvocc-sticky" />
    </>
  );
}
