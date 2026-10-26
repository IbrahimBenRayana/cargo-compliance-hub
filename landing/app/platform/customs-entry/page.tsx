import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/site/section";
import { FeatureSplit } from "@/components/site/blocks";
import { SecondaryCta } from "@/components/site/cta";
import { ROUTES } from "@/lib/site";
import {
  FaqSection,
  ModuleHero,
  PageSchema,
  ScopeCards,
  TextLinks,
  pageMetadata,
} from "../_components/module-page";
import { CtaBand, PRICING_LINK } from "@/components/site/cta-band";
import { SourceNote } from "../pre-filing-checks/_components/module-links";

// Copy: marketing/deliverables/2026-10-23-website-rework/copy/platform-customs-entry.md
const PATH = ROUTES.customsEntry.href;
const TITLE = "Customs Entry Software for 7501 and 3461";
const DESCRIPTION =
  "File entry summaries (7501) and cargo release (3461) with CBP, prefilled from the accepted ISF. Linked ISF and entry billed once. Book a demo.";
const SRC = "platform-entry";

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

const FAQ = [
  {
    q: "What's the difference between a 7501 and a 3461?",
    a: "The 3461 asks CBP to release the cargo. The 7501 entry summary declares the classification, value and duties. MyCargoLens files both.",
  },
  {
    q: "Can I start an entry without an ISF in MyCargoLens?",
    a: "Yes. Starting from an accepted ISF saves retyping, but you can create an entry on its own.",
  },
  {
    q: "Do I need my own filer code and bond?",
    a: "It depends on how you file today. Ask us on the demo and we'll tell you what you need on day one.",
  },
  {
    q: "Do you file in-bond (7512) entries?",
    a: "Not yet. Today we file ISF-10, ISF-5, entry summaries (7501) and cargo release (3461).",
  },
  {
    q: "Does MyCargoLens classify my goods?",
    a: "It suggests HTS codes with alternatives and reasoning. Your team or your broker decides. Suggestions are not rulings.",
  },
  {
    q: "Who is liable if an entry is wrong?",
    a: "The importer of record, whoever transmits it. That's why you want to see and check every entry first.",
  },
  {
    q: "Who transmits the entry to CBP?",
    a: "We do. MyCargoLens is CBP ABI certified, with a direct connection to CBP. Every request and response is logged.",
  },
];

export default function CustomsEntryPage() {
  return (
    <>
      <PageSchema path={PATH} name={TITLE} description={DESCRIPTION} />

      <ModuleHero
        path={PATH}
        scene="customs-entry"
        module="entry"
        eyebrow="Customs entry"
        title="Customs entry software that starts from your accepted ISF"
        sub="File entry summaries (7501) and cargo release (3461) with CBP. The entry opens with the ISF's parties and bond already filled in, gets checked before it goes, and stays on a clock until it liquidates."
        src={SRC}
        micro="Bring your last rejection and we'll walk through it."
      />

      {/* S2 · What you file */}
      <Section tone="cream" id="what-you-file" accent="entry">
        <SectionHeading eyebrow="What you file" title="Entry summary (7501) and cargo release (3461)" />
        <ScopeCards
          className="mt-10"
          cards={[
            {
              title: "Entry summary, CBP Form 7501",
              body: "Lines, HTS codes, values, duties and fees, under your importer of record number and bond.",
            },
            {
              title: "Cargo release, CBP Form 3461",
              body: "Ask CBP to release the goods, then file the summary.",
            },
          ]}
          note="In-bond (7512) isn't available yet. FTZ, drawback and AES aren't part of MyCargoLens."
        />
      </Section>

      {/* S3 · Prefilled from the ISF */}
      <Section tone="sky" id="prefilled" accent="entry">
        <FeatureSplit
          eyebrow="Less retyping"
          title="Start the entry from the ISF, not from a blank form"
          body={
            <>
              <p>
                The ISF already holds the parties, the importer of record number and the bond. Create the entry from the
                accepted ISF and those carry over. You add what the entry needs on top: lines, values and the entry type.
              </p>
              <p>
                The ISF and the entry stay linked, so anyone opening one can see the other and its full history.
              </p>
            </>
          }
          actions={<TextLinks links={[{ label: "How ISF filing works", href: ROUTES.isfFiling.href }]} />}
          screenshot={{ screen: "app-dashboard-stages" }}
        />
      </Section>

      {/* S4 · Checked before it goes */}
      <Section tone="paper" id="checks" accent="entry">
        <FeatureSplit
          reverse
          eyebrow="Before CBP sees it"
          title="Checked before you send, explained if CBP says no"
          body={
            <>
              <p>
                Every entry draft passes rule checks before it can be sent, and you can ask for an AI review of the draft
                as well. If CBP rejects it, you get the error in plain English with numbered steps to fix it.
              </p>
              <p>
                While you build the entry, MyCargoLens flags HTS codes that may fall under an ADD/CVD order, lines with
                possible UFLPA exposure, and the agencies (FDA, USDA-APHIS, EPA, FCC) that may want their own data for a
                code.
              </p>
              <p className="text-[14px] font-medium text-tone-fg">We flag and explain. You or your broker decide.</p>
            </>
          }
          actions={<TextLinks links={[{ label: "The checks every draft gets", href: ROUTES.preFilingChecks.href }]} />}
          screenshot={{ screen: "app-risk-watch" }}
        />
      </Section>

      {/* S5 · Classification and duty help */}
      <Section tone="mint" id="hts-and-duty" accent="entry">
        <FeatureSplit
          eyebrow="HTS and duty"
          title="Suggestions for the HTS code, and the duty before you file"
          body={
            <>
              <p>
                Describe the goods and get a suggested HTS code with alternatives and the reasoning behind each. Your team
                or broker picks the code. The duty calculator shows the rate, MPF, HMF and total for a line from HTS
                reference data.
              </p>
              <p className="text-[14px] font-medium text-tone-fg">
                Suggestions, not rulings. We don&apos;t publish an accuracy figure.
              </p>
              <p className="text-[13.5px]">HTS suggestions are on every plan. The duty calculator is on the Complete plan.</p>
            </>
          }
        />
      </Section>

      {/* S6 · After acceptance */}
      <Section tone="lilac" id="liquidation" accent="entry">
        <FeatureSplit
          reverse
          eyebrow="After entry"
          title="Every entry stays on a clock until it liquidates"
          body={
            <p>
              CBP usually liquidates an entry about 314 days after entry. Until then you can fix it with a post-summary
              correction, inside CBP&apos;s regular 300-day window from the date of entry. MyCargoLens tracks each
              accepted entry through that window and puts the PSC deadline in the inbox before it closes. After
              liquidation, the 180-day protest window gets its own date.
            </p>
          }
          actions={
            <div className="space-y-4">
              <TextLinks links={[{ label: "Liquidation and PSC tracking", href: ROUTES.compliance.href }]} />
              <SourceNote label="19 U.S.C. 1514 (protests)" href="https://www.law.cornell.edu/uscode/text/19/1514" />
            </div>
          }
          screenshot={{ screen: "app-liquidation-clocks" }}
        />
      </Section>

      {/* S7 · Price */}
      <Section tone="peach" id="price" accent="entry">
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <SectionHeading eyebrow="Price" title="One price for the shipment, ISF and entry together" />
            <div className="mt-4 space-y-3 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
              <p>
                ISF + Entry is $180 per shipment, with no monthly fee. A linked ISF and entry is billed once, and only
                when CBP accepts. Rejected filings aren&apos;t charged, and resubmits and amendments are never charged
                twice.
              </p>
              <p>Filing entries for clients at volume? Volume pricing is on request.</p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <SecondaryCta location="section" />
              <TextLinks links={[{ label: "Volume pricing", href: "/pricing#volume" }]} />
            </div>
          </div>
          <div className="min-w-0 rounded-[20px] p-7 site-surface">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-a-ink">ISF + Entry</p>
            <p className="mt-3 text-[44px] font-semibold leading-none tracking-[-0.03em] text-tone-fg tabular-nums">
              $180
            </p>
            <p className="mt-2 text-[15px] text-tone-muted">per shipment, no monthly fee</p>
            <ul className="mt-6 space-y-2 border-t border-[hsl(var(--surface-border))] pt-5 text-[14.5px] text-tone-fg">
              <li>Linked ISF and entry billed once</li>
              <li>Charged only when CBP accepts</li>
              <li>Rejected filings aren&apos;t charged</li>
            </ul>
          </div>
        </div>
      </Section>

      <FaqSection title="Questions about filing entries" items={FAQ} accent="entry" />

      <CtaBand
        title="See an entry built from your own ISF"
        sub="Book a 20-minute demo. We'll file a sample ISF and entry in a demo account, on shipments like yours."
        src={SRC}
        links={[PRICING_LINK]}
      />
    </>
  );
}
