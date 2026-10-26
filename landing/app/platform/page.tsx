import type { Metadata } from "next";
import { Minus } from "lucide-react";
import { Section, SectionHeading, Eyebrow } from "@/components/site/section";
import { CardGrid, CheckList, FeatureSplit, StepFlow } from "@/components/site/blocks";
import { Screenshot } from "@/components/site/screenshot";
import { CertBadge } from "@/components/site/cert-badge";
import { SecondaryCta } from "@/components/site/cta";
import { accentClass, type ModuleKey } from "@/lib/accents";
import { ROUTES, type SiteRoute } from "@/lib/site";
import type { ScreenKey } from "@/lib/screens";
import {
  FaqSection,
  ModuleHero,
  PageSchema,
  ScreenCrop,
  StackedShots,
  TextLinks,
  pageMetadata,
} from "./_components/module-page";
import { CtaBand, PRICING_LINK } from "@/components/site/cta-band";

// Copy: marketing/deliverables/2026-10-23-website-rework/copy/platform.md
const PATH = ROUTES.platform.href;
const TITLE = "ABI Filing Software for ISF and Entries";
const DESCRIPTION =
  "ABI filing software for ISF-10, ISF-5, 7501 and 3461, with one inbox from ISF to liquidation. CBP ABI certified. Charged per accepted shipment.";

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

/** Hero flow strip: real dashboard crops (wireframe 03). */
const FLOW: { label: string; screen: ScreenKey; module: ModuleKey }[] = [
  { label: "ISF filed", screen: "app-flow-1", module: "isf" },
  { label: "Manifest verified", screen: "app-flow-2", module: "inbox" },
  { label: "Entry filed", screen: "app-flow-3", module: "entry" },
  { label: "Cleared by CBP", screen: "app-flow-4", module: "checks" },
];

type Part = { route: SiteRoute; body: string; link: string };

const PARTS: Record<"file" | "stayAhead", Part[]> = {
  file: [
    { route: ROUTES.isfFiling, body: "ISF-10 and ISF-5, with a deadline clock on every filing.", link: "ISF filing software" },
    {
      route: ROUTES.customsEntry,
      body: "Entry summary (7501) and cargo release (3461), prefilled from the accepted ISF.",
      link: "Customs entry filing",
    },
    { route: ROUTES.api, body: "REST or XML in, HMAC-signed status webhooks out.", link: "The filing API" },
  ],
  stayAhead: [
    {
      route: ROUTES.inbox,
      body: "Open work ranked by urgency, with CBP responses picked up every minute.",
      link: "How the inbox ranks filings",
    },
    {
      route: ROUTES.preFilingChecks,
      body: "Rule checks on every draft, an AI review when you want one, rejections in plain English.",
      link: "Checks before you submit",
    },
    {
      route: ROUTES.compliance,
      body: "Liquidation and PSC clocks, daily ADD/CVD pulls, UFLPA and PGA flags, HTS suggestions.",
      link: "Compliance after entry",
    },
  ],
};

const FAQ = [
  {
    q: "Do we have to replace our current system?",
    a: "No. You can start with one lane, or with your ISFs only, and add entries later. Your other tools keep running while you try it.",
  },
  {
    q: "Does the AI file anything on its own?",
    a: "No. Rule checks run on every draft, and an AI review runs only when you ask for one. It points out problems and suggests HTS codes with its reasoning. Your team decides and submits.",
  },
  {
    q: "Can our TMS file instead of our team typing?",
    a: "Yes. The public REST API takes JSON or XML for ISFs and entries, with scoped, revocable keys and HMAC-signed status webhooks. Ask about API access on your demo.",
  },
  {
    q: "Which filings can we make?",
    a: "ISF-10, ISF-5, entry summaries (7501), cargo release (3461) and manifest queries. In-bond, FTZ, drawback and AES aren't available today.",
  },
  {
    q: "Who on our team can see and change what?",
    a: "Four roles: Owner, Admin, Operator and Viewer. Invites are email-verified, every account has MFA, and every change lands in an audit trail you can export to CSV.",
  },
];

function PartsGroup({ heading, items }: { heading: string; items: Part[] }) {
  return (
    <div>
      <Eyebrow className="mb-4">{heading}</Eyebrow>
      <CardGrid
        items={items.map((p) => ({
          title: p.route.label,
          body: p.body,
          href: p.route.href,
          linkLabel: p.link,
          module: p.route.module,
        }))}
      />
    </div>
  );
}

export default function PlatformPage() {
  return (
    <>
      <PageSchema path={PATH} name={TITLE} description={DESCRIPTION} />

      <ModuleHero
        path={PATH}
        scene="platform"
        eyebrow="Platform"
        title="ABI filing software, from the ISF to liquidation."
        sub="MyCargoLens takes a shipment from ISF-10 or ISF-5 to entry summary and cargo release, then tracks the entry until it liquidates. One inbox ranks the open work across all of it."
        src="platform-hero"
      >
        <ol aria-label="One shipment, from ISF to cleared" className="hidden max-w-xl grid-cols-4 gap-3 sm:grid">
          {FLOW.map((f) => (
            <li key={f.screen} className={`min-w-0 ${accentClass(f.module)}`}>
              <p className="mb-2 whitespace-nowrap text-[10.5px] font-semibold uppercase leading-tight tracking-[0.04em] text-a-ink">{f.label}</p>
              <ScreenCrop screen={f.screen} />
            </li>
          ))}
        </ol>
      </ModuleHero>

      {/* S2 · How a shipment moves */}
      <Section tone="cream" id="flow">
        <SectionHeading eyebrow="The flow" title="How a shipment moves through MyCargoLens" />
        <StepFlow
          className="mt-12"
          steps={[
            {
              module: "isf",
              title: "Start from what you filed last time",
              body: "Reuse saved parties, ports, HTS codes and bond details from a template, or clone any past filing. Group house bills under one master for a consolidation, and submit up to 20 drafts at once. When the ISF is accepted, the entry starts prefilled from it with the bond carried over.",
              media: (
                <Screenshot
                  placeholder="Template picker"
                  url="app.mycargolens.com/shipments/new"
                  aspect="16/10"
                />
              ),
            },
            {
              module: "checks",
              title: "Checked before it goes",
              body: "Every draft passes rule-based checks before you can submit. You can also run an AI review on any draft. If CBP rejects a filing, you get the error in plain English with numbered fix steps.",
              media: <Screenshot screen="app-isf-wizard" aspect="16/10" sizes="(min-width: 1024px) 260px, 100vw" />,
            },
            {
              module: "entry",
              title: "Filed with CBP",
              body: "MyCargoLens files ISF-10, ISF-5, entry summaries (7501) and cargo release (3461) directly with CBP, and every request and response is logged.",
              media: <Screenshot screen="app-isf-timeline" aspect="16/10" sizes="(min-width: 1024px) 260px, 100vw" />,
            },
            {
              module: "compliance",
              title: "Tracked until it's closed",
              body: "CBP responses are picked up every minute, and any transmission CBP hasn't answered gets flagged. Each ISF carries its deadline clock, and each accepted entry carries its 314-day liquidation window. The post-summary correction deadline is marked at day 300 after entry, CBP's regular PSC window. On the Complete plan, containers show vessel ETAs and last free day.",
              media: <Screenshot screen="app-liquidation-clocks" aspect="16/10" sizes="(min-width: 1024px) 260px, 100vw" />,
            },
          ]}
        />
      </Section>

      {/* S3 · The six parts */}
      <Section tone="sky" id="parts">
        <SectionHeading
          eyebrow="What's inside"
          title="Six parts, one record per shipment"
          intro="Each part has its own page. Start with the job you do most."
        />
        <div className="mt-10 space-y-10">
          <PartsGroup heading="File" items={PARTS.file} />
          <PartsGroup heading="Stay ahead" items={PARTS.stayAhead} />
        </div>
      </Section>

      {/* S4 · One record per shipment */}
      <Section tone="paper" id="record">
        <FeatureSplit
          reverse
          eyebrow="The record"
          title="Everything about a shipment on one record"
          body={
            <p>
              Open any filing and you see its whole life: the ISF, the linked entry, every CBP response and every edit
              with the name of whoever made it. When a customer or an auditor asks, export the full lifecycle as one PDF,
              or the audit trail as CSV.
            </p>
          }
          bullets={[
            "A linked ISF and entry is one shipment, billed once.",
            "Four roles (Owner, Admin, Operator, Viewer) and MFA on every account.",
            "Duty calculator with rates, MPF/HMF and a total from HTS reference data (Complete plan).",
          ]}
          actions={<TextLinks links={[{ label: "Roles, MFA and the audit trail", href: ROUTES.security.href }]} />}
          media={<StackedShots main="app-isf-consolidation" inset="app-isf-timeline" />}
        />
      </Section>

      {/* S5 · Certified, and on the record */}
      <Section tone="mint" id="certified" spacing="compact">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <CertBadge link />
            <h2 className="mt-5 text-[26px] font-semibold leading-[1.12] tracking-[-0.028em] text-tone-fg sm:text-[32px]">
              Every transmission on the record
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
              CBP ABI certified, with a direct connection to CBP. Every request to CBP and every response is logged where
              your team can read it.
            </p>
          </div>
          <Screenshot screen="app-isf-status-history" />
        </div>
      </Section>

      {/* S6 · What MyCargoLens files today */}
      <Section tone="lilac" id="scope">
        <SectionHeading title="What you can file today" />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          <div className="rounded-[20px] p-6 site-surface">
            <h3 className="text-[17px] font-semibold text-tone-fg">Available</h3>
            <CheckList
              className="mt-5"
              items={["ISF-10 (10+2)", "ISF-5 (FROB)", "Entry summary (7501)", "Cargo release (3461)", "Manifest (MBOL) query"]}
            />
          </div>
          <div className="rounded-[20px] p-6 site-surface">
            <h3 className="text-[17px] font-semibold text-tone-fg">Not available today</h3>
            <ul className="mt-5 space-y-3">
              {["In-bond (7512)", "FTZ", "Drawback", "AES", "ISF bonds"].map((x) => (
                <li key={x} className="flex gap-3 text-[15.5px] leading-snug text-tone-muted">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-[hsl(var(--surface-border))]"
                  >
                    <Minus className="size-3" strokeWidth={3} />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-6 space-y-1.5 text-[14px] leading-relaxed text-tone-muted">
          <p>HTS codes are suggestions with reasoning. Classification decisions stay with you or your broker.</p>
          <p>MyCargoLens is software. We are not a licensed customs broker.</p>
        </div>
      </Section>

      {/* S7 · Pricing pointer */}
      <Section tone="peach" id="pricing" spacing="compact">
        <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <SectionHeading
              title="Priced per shipment, charged when CBP accepts"
              intro="Importers pick a plan: $45 for ISF, $180 for ISF + Entry or $280 for Complete, per shipment, with no monthly fee. NVOCCs, forwarders and brokers filing at volume get volume pricing on request."
            />
          </div>
          <div className="min-w-0 space-y-6">
            <SecondaryCta location="section" size="lg" />
            <TextLinks
              links={[
                { label: "Volume and API pricing", href: "/pricing#volume" },
                { label: "Weighing this against your broker or your current vendor? How we compare", href: ROUTES.compare.href },
              ]}
            />
          </div>
        </div>
      </Section>

      <FaqSection title="Questions about the platform" items={FAQ} />

      <CtaBand
        title="Watch one shipment go from ISF to entry in 20 minutes."
        sub="We'll run a sample ISF and entry in a demo account on shipments like yours, then tell you what it would cost."
        src="platform-close"
        micro="Pay per shipment, only when CBP accepts."
        links={[PRICING_LINK]}
      />
    </>
  );
}

