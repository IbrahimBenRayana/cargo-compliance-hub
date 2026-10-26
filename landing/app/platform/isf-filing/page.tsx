import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/site/section";
import { FeatureSplit } from "@/components/site/blocks";
import { Screenshot } from "@/components/site/screenshot";
import { ROUTES } from "@/lib/site";
import {
  CodeBlock,
  FaqSection,
  ModuleHero,
  PageSchema,
  ScopeCards,
  StackedShots,
  TextLinks,
  pageMetadata,
} from "../_components/module-page";
import { CtaBand, PRICING_LINK } from "@/components/site/cta-band";
import { DeadlineChips } from "./_components/deadline-chips";

// Copy: marketing/deliverables/2026-10-23-website-rework/copy/platform-isf-filing.md
const PATH = ROUTES.isfFiling.href;
const TITLE = "ISF Filing Software for ISF-10 and ISF-5";
const DESCRIPTION =
  "File ISF-10 and ISF-5 with CBP. Every filing gets a deadline clock with alerts at 72, 48 and 24 hours. CBP ABI certified. Book a demo.";
const SRC = "platform-isf";
const CBP_ISF_FAQ =
  "https://www.cbp.gov/sites/default/files/assets/documents/2023-May/ISF%20FAQ%202.0%20(508).pdf";

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  ogTitle: "ISF filing software with a clock on every filing",
});

const FAQ = [
  {
    q: "When is the ISF-10 due?",
    a: "At least 24 hours before the cargo is laden on the vessel at the foreign port. MyCargoLens calculates that deadline on every filing and alerts you at 72, 48 and 24 hours before it.",
  },
  {
    q: "What's the penalty for a late or missing ISF?",
    a: "CBP can assess liquidated damages of $5,000 per violation, and each house bill counts as its own ISF. Read our guide to ISF late filing penalties.",
  },
  {
    q: "Who files the ISF-10 and who files the ISF-5?",
    a: "The importer, or an agent filing for them, files the ISF-10. The carrier files the ISF-5 for cargo remaining on board and similar shipments. An NVOCC that issues the bill is often the party filing. MyCargoLens handles both.",
  },
  {
    q: "Can we file ISFs for a consolidation with many house bills?",
    a: "Yes. House bills under one master are linked, each with its own deadline clock, and you can submit up to 20 drafts at once.",
  },
  { q: "Do you sell ISF bonds?", a: "No. You file under your own bond or your customer's." },
  {
    q: "Who transmits the ISF to CBP?",
    a: "We do. MyCargoLens is CBP ABI certified and we transmit to CBP ourselves, with no middleman. Every request and response is logged on the filing.",
  },
  {
    q: "What does an ISF cost?",
    a: "Importers filing their own: $45 per shipment, charged only when CBP accepts. NVOCCs, forwarders and brokers filing at volume get volume pricing on request. See pricing or volume pricing.",
  },
  {
    q: "Are you a customs broker?",
    a: "No. MyCargoLens is software for importers, forwarders, NVOCCs and brokers. You or your broker stay in charge of advice and classification decisions.",
  },
];

export default function IsfFilingPage() {
  return (
    <>
      <PageSchema path={PATH} name={TITLE} description={DESCRIPTION} />

      <ModuleHero
        path={PATH}
        scene="isf-filing"
        module="isf"
        eyebrow="ISF filing"
        title="ISF filing software with a clock on every filing"
        sub="File ISF-10 and ISF-5 with CBP from one inbox. Each filing shows its deadline and alerts your team at 72, 48 and 24 hours before it. Templates, bulk submit and linked house bills keep the volume work short."
        src={SRC}
        micro="20 minutes, on shipments like yours. We set your team up after."
      />

      {/* S2 · What you can file */}
      <Section tone="cream" id="what-you-file" accent="isf">
        <SectionHeading
          eyebrow="What you file"
          title="ISF-10 and ISF-5, built on CBP's ABI standards"
          intro={`MyCargoLens files the importer security filing (ISF-10, the "10+2") and the carrier filing (ISF-5) with CBP.`}
        />
        <ScopeCards
          className="mt-10"
          cards={[
            {
              title: "ISF-10",
              body: "The ten importer data elements: seller, buyer, importer of record number, consignee number, manufacturer, ship-to party, country of origin, HTS code, container stuffing location and consolidator. Filed before the cargo is laden at the foreign port.",
            },
            {
              title: "ISF-5",
              body: "For cargo remaining on board (FROB) and other shipments where the carrier files. Booking party and foreign port of unlading included.",
            },
          ]}
          note="We don't sell ISF bonds. You file under your own continuous or single-transaction bond, or your customer's."
        />
      </Section>

      {/* S3 · The deadline clock */}
      <Section tone="sky" id="deadline-clock" accent="isf">
        <FeatureSplit
          eyebrow="On time"
          title="Every ISF on a clock, from the moment you create it"
          body={
            <>
              <p>
                CBP wants the ISF-10 at least 24 hours before the cargo is laden on the vessel at the foreign port.
                MyCargoLens works out that deadline for each filing and puts it on the record, in the list and in the
                inbox. Your team gets alerts at 72, 48 and 24 hours before it. Drafts with a deadline under 24 hours away
                are flagged when you open them.
              </p>
              <p className="text-[15px]">
                CBP can claim liquidated damages of $5,000 per ISF violation, and each house bill is its own filing. The
                clock is how you see that risk in time.{" "}
                <a
                  href={CBP_ISF_FAQ}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap text-[13px] underline decoration-current/40 underline-offset-2 hover:text-tone-fg"
                >
                  Source: CBP ISF FAQ 2.0<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            </>
          }
          actions={
            <TextLinks
              links={[
                { label: "See how the ISF deadline clock feeds the inbox", href: ROUTES.inbox.href },
                { label: "What a late ISF actually costs", href: ROUTES.isfLateFilingPenalties.href },
              ]}
            />
          }
          media={
            <div className="space-y-5">
              <Screenshot screen="app-compliance-queue" caption="The inbox, with sample data." />
              <DeadlineChips />
            </div>
          }
        />
      </Section>

      {/* S4 · Built for volume */}
      <Section tone="paper" id="volume" accent="isf">
        <FeatureSplit
          reverse
          eyebrow="Volume work"
          title="Built for the house bills that repeat"
          body={
            <p>
              Most ISFs repeat. Same seller, same factory, same consolidator, a new bill number. Save the repeat parts
              once and spend your time on what changed.
            </p>
          }
          bullets={[
            <>
              <strong className="font-semibold">Templates.</strong> Save parties, ports, HTS codes and bond details,
              then start a new ISF from them.
            </>,
            <>
              <strong className="font-semibold">Duplicate.</strong> Clone any filing and change the bill and dates.
            </>,
            <>
              <strong className="font-semibold">Bulk submit.</strong> Send up to 20 drafts in one action. Each one still
              goes through the checks first.
            </>,
            <>
              <strong className="font-semibold">Consolidations.</strong> House bills under one master are linked, each
              with its own deadline. Open one and the siblings are a click away.
            </>,
          ]}
          actions={
            <TextLinks
              links={[
                { label: "Filing ISF for every house bill at an NVOCC or forwarder?", href: ROUTES.nvoccForwarders.href },
              ]}
            />
          }
          media={<StackedShots main="app-shipments-list" inset="app-isf-consolidation" />}
        />
      </Section>

      {/* S5 · Checked before it goes */}
      <Section tone="mint" id="checks" accent="isf">
        <FeatureSplit
          eyebrow="Before CBP sees it"
          title="Every draft is checked before it goes to CBP"
          body={
            <>
              <p>
                Rule checks run on every ISF before submit: HTS codes between 6 and 10 digits in a valid chapter,
                two-letter ISO country codes, a four-letter SCAC, arrival after departure, an importer of record number,
                the ISF-5 booking party. You can also ask for an AI review of any draft.
              </p>
              <p>
                If CBP rejects a filing anyway, the rejection comes back in plain English with numbered steps to fix it.
                Fix it and resubmit. You&apos;re never charged twice for the same shipment.
              </p>
            </>
          }
          actions={<TextLinks links={[{ label: "How the pre-filing checks work", href: ROUTES.preFilingChecks.href }]} />}
          screenshot={{ screen: "app-isf-wizard" }}
        />
      </Section>

      {/* S6 · After you submit */}
      <Section tone="lilac" id="after-submit" accent="isf">
        <FeatureSplit
          reverse
          eyebrow="After submit"
          title="Know what CBP said without refreshing a screen"
          body={
            <>
              <p>
                CBP responses are picked up every minute and move into the inbox: accepted, rejected or still waiting.
                Any transmission CBP hasn&apos;t answered gets flagged.
              </p>
              <p>
                Query by master bill to see CBP&apos;s dispositions on each house bill, such as 1W (arrived) and 1C
                (cargo released). Manifest queries are free, like drafts.
              </p>
            </>
          }
          screenshot={{ screen: "app-manifest-dispositions" }}
        />
      </Section>

      {/* S7 · From ISF to entry */}
      <Section tone="peach" id="to-entry" accent="isf">
        <FeatureSplit
          eyebrow="Next step"
          title="File the entry from the accepted ISF"
          body={
            <p>
              When the ISF is accepted, start the entry summary (7501) or cargo release (3461) from it. The parties and
              bond carry over. For importers on the ISF + Entry plan, a linked ISF and entry is billed once.
            </p>
          }
          actions={<TextLinks links={[{ label: "Customs entry, prefilled from the ISF", href: ROUTES.customsEntry.href }]} />}
          screenshot={{ screen: "app-dashboard-stages" }}
        />
      </Section>

      {/* S8 · From your own system */}
      <Section tone="ink" id="api" accent="isf">
        <FeatureSplit
          eyebrow="API"
          title="Filing from a TMS? Send ISFs through the API"
          body={
            <p>
              Create and submit ISFs from your own system over REST, in JSON or XML. Status comes back to you as signed
              webhooks (<code className="font-mono text-[0.9em]">filing.accepted</code>,{" "}
              <code className="font-mono text-[0.9em]">filing.rejected</code>). The same checks run on API submissions
              as in the app.
            </p>
          }
          actions={<TextLinks links={[{ label: "ISF API and webhooks", href: ROUTES.api.href }]} />}
          media={
            <CodeBlock
              label="Example API request to submit an ISF"
              code={`POST /api/public/v1/shipments/{id}/submit
Authorization: Bearer mcl_live_…

# → webhook filing.accepted | filing.rejected`}
            />
          }
        />
      </Section>

      <FaqSection
        title="Questions ISF teams ask us"
        items={FAQ}
        accent="isf"
        related={[
          { label: "ISF late filing penalties", href: ROUTES.isfLateFilingPenalties.href },
          { label: "Volume pricing", href: "/pricing#volume" },
        ]}
      />

      <CtaBand
        title="See your own ISFs on the clock"
        sub="Book a 20-minute demo. Bring a recent house bill and we'll file a sample ISF in a demo account while you watch."
        src={SRC}
        links={[PRICING_LINK]}
      />
    </>
  );
}
