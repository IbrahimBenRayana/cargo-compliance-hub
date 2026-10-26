import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/site/section";
import { CardGrid, FeatureSplit } from "@/components/site/blocks";
import { ROUTES } from "@/lib/site";
import { isArticleLive } from "@/app/resources/_content/articles";
import {
  FaqSection,
  ModuleHero,
  PageSchema,
  TextLinks,
  pageMetadata,
} from "../_components/module-page";
import { CtaBand, PRICING_LINK } from "@/components/site/cta-band";

// Copy: marketing/deliverables/2026-10-23-website-rework/copy/platform-inbox.md
const PATH = ROUTES.inbox.href;
const TITLE = "Customs Filing Tracking in One Ranked Inbox";
const DESCRIPTION =
  "Every open ISF, entry and liquidation in one inbox, ranked by urgency. ISF alerts at 72, 48 and 24 hours. CBP responses picked up every minute.";
const SRC = "platform-inbox";

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

const FAQ = [
  {
    q: "How does the inbox decide what's urgent?",
    a: "Each item gets a severity (critical, high, medium or low) from what it is: a rejection or a passed deadline ranks above a draft to review. Within the same severity, newer items come first.",
  },
  {
    q: "When do ISF deadline alerts go out?",
    a: "At 72, 48 and 24 hours before the ISF deadline, which is 24 hours before lading.",
  },
  {
    q: "How often do you check CBP status?",
    a: "CBP responses are picked up every minute, and any transmission CBP hasn't answered gets flagged.",
  },
  {
    q: "Does the inbox cover entries after they're accepted?",
    a: "Yes. Accepted entries stay tracked through liquidation, with the PSC deadline and the protest window. See compliance.",
  },
  { q: "Can I export the history of a filing?", a: "Yes: one PDF per filing, and the audit trail as CSV." },
  {
    q: "Will it stop us from getting penalties?",
    a: "No software can promise that. The inbox puts the deadline and the problem in front of your team early, ranked by urgency.",
  },
];

const linkCls = "font-semibold text-a-ink underline decoration-current/30 underline-offset-4 hover:decoration-current";

export default function InboxPage() {
  return (
    <>
      <PageSchema path={PATH} name={TITLE} description={DESCRIPTION} />

      <ModuleHero
        path={PATH}
        scene="inbox"
        module="inbox"
        certBadge={false}
        eyebrow="The inbox"
        title="Customs filing tracking, ranked by what needs you now"
        sub="An inbox for US customs, not another dashboard. Every open ISF, entry and liquidation in one list, with the most urgent at the top."
        src={SRC}
      />

      {/* S2 · What lands in the inbox */}
      <Section tone="cream" id="what-lands" accent="inbox">
        <FeatureSplit
          eyebrow="What rises to the top"
          title="Seven kinds of work, sorted for you"
          body={<p>You don&apos;t build the list. MyCargoLens fills it from your filings and sorts it by severity, then by time.</p>}
          bullets={[
            <>
              <strong className="font-semibold">ISF deadlines.</strong> Filings getting close to 24 hours before lading.{" "}
              <Link href={ROUTES.isfFiling.href} className={linkCls}>
                How ISF filing works
              </Link>
            </>,
            <>
              <strong className="font-semibold">Rejections.</strong> Anything CBP rejected, with the fix steps one click
              away.
            </>,
            <>
              <strong className="font-semibold">Possible UFLPA exposure.</strong> High-risk filings, flagged before or
              while they&apos;re in flight.
            </>,
            <>
              <strong className="font-semibold">PSC deadlines.</strong> Entries whose 300-day post-summary correction
              window is closing.
            </>,
            <>
              <strong className="font-semibold">Liquidation coming up.</strong> Entries within 14 days of estimated
              liquidation.
            </>,
            <>
              <strong className="font-semibold">The same error, three times.</strong> When three or more recent
              rejections share one cause, you see it once, with every affected filing.
            </>,
            <>
              <strong className="font-semibold">Drafts to review.</strong> Drafts that still need work before they can
              go.
            </>,
          ]}
          screenshot={{ screen: "app-compliance-inbox", caption: "The inbox, with sample data." }}
        />
      </Section>

      {/* S3 · Daily brief */}
      <Section tone="sky" id="daily-brief" accent="inbox">
        <FeatureSplit
          reverse
          eyebrow="Daily brief"
          title="A one-line brief, generated daily"
          body={
            <p>
              Open the inbox and the top line tells you what changed and what&apos;s due today. Not your problem yet?
              Snooze it and it comes back later.
            </p>
          }
          screenshot={{ screen: "app-m-compliance" }}
        />
      </Section>

      {/* S4 · How the inbox stays current */}
      <Section tone="paper" id="behind-the-list" accent="inbox">
        <SectionHeading eyebrow="Behind the list" title="Four jobs keep the list current while you work" />
        <CardGrid
          className="mt-10"
          columns={4}
          items={[
            {
              kicker: "72 · 48 · 24h",
              title: "ISF deadline alerts",
              body: "Alerts at 72, 48 and 24 hours before each ISF deadline, one at a time.",
            },
            {
              kicker: "Every minute",
              title: "CBP responses",
              body: "CBP responses are picked up every minute, and any transmission CBP hasn't answered gets flagged.",
            },
            {
              kicker: "After 20 minutes",
              title: "Waiting on CBP",
              body: "A transmission CBP hasn't answered within 20 minutes gets flagged so someone looks. The check runs every 5 minutes.",
            },
            {
              kicker: "Daily",
              title: "New ADD/CVD orders",
              body: "Pulled from the Federal Register daily and reviewed before they're used in flags.",
            },
          ]}
        />
        {isArticleLive("isf-late-filing-penalties") && (
          <TextLinks
            className="mt-8"
            links={[
              {
                label: "Why the 24-hour line matters: ISF late filing penalties",
                href: ROUTES.isfLateFilingPenalties.href,
              },
            ]}
          />
        )}
      </Section>

      {/* S5 · Open any item */}
      <Section tone="mint" id="record" accent="inbox">
        <FeatureSplit
          eyebrow="The record"
          title="Open any item and see its whole history"
          body={
            <>
              <p>
                Every filing has a timeline: who created it, what changed, what was sent to CBP and what came back. The
                ISF and its entry are linked. Export the whole thing as one PDF when someone asks.
              </p>
              <p>
                Every CBP request and response is logged. Edits show the before and after. The audit trail exports to
                CSV, and four roles (Owner, Admin, Operator, Viewer) control who can do what.
              </p>
            </>
          }
          actions={<TextLinks links={[{ label: "Roles, MFA and the audit trail", href: ROUTES.security.href }]} />}
          screenshot={{ screen: "app-isf-timeline" }}
        />
      </Section>

      {/* S6 · Containers and last free day */}
      <Section tone="lilac" id="containers" accent="inbox" spacing="compact">
        <SectionHeading
          eyebrow="Tracking (Complete plan)"
          title="Vessel ETAs and last free day next to the filing"
          intro="On the Complete plan, tracked containers show vessel ETAs, port arrival and the last free day, so the filing and the box sit in the same place."
        />
      </Section>

      {/* S7 · Webhooks */}
      <Section tone="ink" id="webhooks" accent="inbox" spacing="compact">
        <div className="grid items-end gap-8 lg:grid-cols-[1.4fr_1fr]">
          <SectionHeading
            eyebrow="Webhooks"
            title="Send status changes to your own systems"
            intro={
              <>
                The status changes that move the inbox can also go to your TMS: signed webhooks for{" "}
                <code className="font-mono text-[0.9em] text-tone-fg">filing.*</code> and{" "}
                <code className="font-mono text-[0.9em] text-tone-fg">entry.*</code> events.
              </>
            }
          />
          <TextLinks className="lg:justify-self-end" links={[{ label: "Webhooks to your own systems", href: ROUTES.api.href }]} />
        </div>
      </Section>

      <FaqSection
        title="Questions about the inbox"
        items={FAQ}
        accent="inbox"
        related={[{ label: "Liquidation and PSC tracking after entry", href: ROUTES.compliance.href }]}
      />

      <CtaBand
        title="See your own filings ranked"
        sub="Book a 20-minute demo. We'll load shipments like yours into a demo account and show you what the inbox would put first."
        src={SRC}
        links={[PRICING_LINK]}
      />
    </>
  );
}
