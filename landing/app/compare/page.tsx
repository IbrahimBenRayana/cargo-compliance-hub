import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, SectionHeading } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton } from "@/components/site/cta";
import { CheckList, StepFlow } from "@/components/site/blocks";
import { Faq, type FaqItem } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { webPage } from "@/lib/schema";
import { ROUTES } from "@/lib/site";
import { CtaBand } from "@/components/site/cta-band";
import { ArrowLink, DashList, PriceLine, pageMetadata } from "../solutions/_components/page-bits";

// Copy: marketing/deliverables/2026-10-23-website-rework/copy/compare.md
const PATH = ROUTES.compare.href;
const DESCRIPTION =
  "Customs broker vs self-filing software vs legacy ABI vendors: when each fits, when teams switch, and what MyCargoLens costs per shipment.";

export const metadata = pageMetadata({
  path: PATH,
  title: "Customs broker vs self-filing software",
  description: DESCRIPTION,
  ogTitle: "Four ways to file US customs, compared",
});

const ext = "underline decoration-current/35 underline-offset-2 hover:text-tone-fg";
const AJOT_URL = "https://www.ajot.com/news/us-importers-turn-to-brokers-to-navigate-trump-era-tariffs-at-a-cost";

const OPTIONS = ["Your customs broker", "Spreadsheets, email and a terminal", "Established ABI software", "DIY online filing services", "MyCargoLens"];

/** Rows of the side-by-side table: [label, broker, spreadsheets, legacy, DIY, MyCargoLens]. Words only, no icons. */
const ROWS: [string, string, string, string, string, string][] = [
  [
    "Who sends it to CBP",
    "Your broker",
    "Your team, through whatever system you have",
    "Your team, through the vendor's software",
    "The service, for you",
    "Your team, through MyCargoLens",
  ],
  [
    "Who's responsible",
    "The importer of record",
    "The importer of record",
    "The importer of record",
    "The importer of record",
    "The importer of record. We're software, not a broker",
  ],
  [
    "When you see the price",
    "Your broker's fee schedule, on the invoice",
    "Your team's time",
    "Usually a quote, licence or contract; most don't publish software prices on their websites (checked October 23, 2026)",
    "Published on their websites",
    "On our website, per shipment, charged when CBP accepts. Volume filers: written quote",
  ],
  [
    "Seeing deadlines coming",
    "What your broker reports to you",
    "Whoever watches the sheet",
    "Varies by product. Ask to see it in a demo",
    "Varies by service",
    "A clock on every ISF, alerts at 72, 48 and 24 hours before it; open work ranked in one inbox",
  ],
  [
    "Checks before CBP",
    "Your broker's licensed review",
    "Manual",
    "Data checks are common. Compare what each one flags",
    "Varies by service",
    "Rule checks on every draft, optional AI review, rejections explained with fix steps",
  ],
  [
    "Advice on classification and compliance",
    "Yes (licensed)",
    "No",
    "No",
    "Some partner with a licensed broker",
    "No. HTS suggestions with reasoning; you or your broker decide",
  ],
  [
    "Scope",
    "Whatever your broker handles",
    "Whatever you build",
    "Often the broadest: some file in-bond, FTZ, drawback and AES",
    "Usually ISF, entry summary and bonds",
    "ISF-10, ISF-5, 7501, 3461. In-bond, FTZ, drawback, AES aren't available",
  ],
];

type Fact = { text: string; sources: { label: string; href: string }[] };
type OptionBlock = {
  title: string;
  rightWhen: string;
  elsewhereWhen: React.ReactNode;
  fits: string;
  link?: { label: string; href: string };
  facts?: Fact[];
};

const BLOCKS: OptionBlock[] = [
  {
    title: "Your customs broker files it",
    rightWhen: "you want zero involvement, you need licensed advice on most shipments, or you ship a few times a year.",
    elsewhereWhen: (
      <>
        fees keep rising, a rejection or redo arrives without a clear explanation, or nobody in-house can see what went out under
        the IOR number. One brokerage CEO{" "}
        <a href={AJOT_URL} target="_blank" rel="noopener noreferrer" className={ext}>
          told Reuters<span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        they raised US rates &ldquo;because of the new and added complexity&rdquo;.
      </>
    ),
    fits: "keep your broker for advice if you like. Your team files ISFs, or ISF and entry together, and sees each one checked and tracked through liquidation.",
    link: { label: "For importers", href: ROUTES.importers.href },
  },
  {
    title: "Spreadsheets, email and a terminal",
    rightWhen: "volume is small, the team knows the routine, and nothing has gone wrong yet.",
    elsewhereWhen: "an ISF slips, the team grows, or an audit asks who sent what and when.",
    fits: "the same work, ranked by what needs you first, a deadline clock on every ISF, and every CBP request and response kept on the filing.",
  },
  {
    title: "Established ABI software",
    rightWhen:
      "you need in-bond, FTZ, drawback or AES in the same system, you run bulk e-commerce volumes, or your forwarding ERP already includes customs.",
    elsewhereWhen:
      "renewal comes up and the price isn't known in advance, or the team only needs ISF and entry and wants one inbox for them.",
    fits: "narrower on purpose. ISF and entry with a ranked inbox, checks before submit, and a price written down. You can start with one lane, next to what you already run.",
    facts: [
      { text: "Descartes' NetCHB site does not publish software prices.", sources: [{ label: "home.netchb.com", href: "https://home.netchb.com/" }] },
      {
        text: "Magaya describes its ACELYNK customs software as a subscription licence, does not publish prices, and lists in-bond, FTZ, drawback and AES filing.",
        sources: [{ label: "magaya.com/acelynk", href: "https://www.magaya.com/acelynk/" }],
      },
      {
        text: "WiseTech introduced per-transaction “Value Pack” pricing for CargoWise in December 2025; December invoices were the first under it.",
        sources: [
          { label: "ecommercenews.com.au", href: "https://ecommercenews.com.au/story/wisetech-shifts-cargowise-pricing-to-per-transaction" },
          { label: "The Loadstar, Jan 2026", href: "https://theloadstar.com/cargowise-customers-confused-by-first-invoices-under-new-pricing-model/" },
        ],
      },
    ],
  },
  {
    title: "DIY online filing services",
    rightWhen:
      "it's your first import or a one-off, you want a guided form and a partner broker behind it, and the lowest price per single filing matters most.",
    elsewhereWhen: "they file every week, several people need access, or they want consolidations, ISF-5 or an API.",
    fits: "built for teams filing regularly: templates and bulk submit, four roles, ISF-5 and an API with signed webhooks. For a single ISF, a DIY service will usually cost less than our $45.",
    facts: [
      {
        text: "eezyimport publishes ISF filing from $25 and entry summaries from $115 (one invoice, five lines), plus $7 per extra line and $10 per extra invoice, and states that it is not a customs broker.",
        sources: [
          { label: "eezyimport.com/pricing", href: "https://www.eezyimport.com/pricing" },
          { label: "eezyimport.com", href: "https://www.eezyimport.com/" },
        ],
      },
    ],
  },
];

const FAQ: FaqItem[] = [
  {
    q: "Can an importer file its own ISF and entries instead of using a customs broker?",
    a: "Yes, importers can file their own, and many use a broker for some or all of it. Self-filing comes with requirements that depend on what you file; we'll go through them with you on the demo.",
  },
  {
    q: "Is MyCargoLens cheaper than a customs broker?",
    a: "Not necessarily. Our ISF + Entry price is $180 per shipment, about what many brokers charge. You get one written price, a linked ISF and entry billed once, and no charge for rejected filings.",
  },
  {
    q: "How does MyCargoLens compare with Descartes, CargoWise or Magaya?",
    a: "They're broader. Some file in-bond, FTZ, drawback and AES, and some include a forwarding ERP. MyCargoLens focuses on ISF and entry, with a ranked inbox, checks on every draft and a price on the website. You can start with one lane next to your current system.",
  },
  {
    q: "Is MyCargoLens a customs broker?",
    a: "No. MyCargoLens is software for importers, forwarders, NVOCCs and customs brokers. You, or your broker, stay in charge of advice and classification decisions.",
  },
  {
    q: "Who sends filings to CBP when we use MyCargoLens?",
    a: "MyCargoLens does, after your team reviews and submits each one. Every request and response is logged.",
  },
  {
    q: "You're a young company. What if it doesn't work out?",
    a: "There's no monthly fee on the public plans, and you pay per shipment when CBP accepts it. Your audit trail exports to CSV and each filing exports as a PDF.",
  },
  {
    q: "What doesn't MyCargoLens file?",
    a: "In-bond, FTZ, drawback and AES aren't available. We file ISF-10, ISF-5, entry summaries (7501) and cargo release (3461).",
  },
];


export default function ComparePage() {
  return (
    <>
      <JsonLd data={webPage({ path: PATH, name: "Customs broker vs self-filing software", description: DESCRIPTION, aboutSoftware: true })} />

      <PageHero
        breadcrumbPath={PATH}
        eyebrow="How we compare"
        title={
          <>
            Four ways to file US customs.
            <span className="mt-3 block text-[20px] font-medium leading-snug tracking-[-0.015em] text-tone-muted sm:text-[24px]">
              Customs broker vs self-filing software, and the options in between.
            </span>
          </>
        }
        sub="Each option below is the right call for somebody. Here's when each one fits, when teams move on, and where MyCargoLens sits."
        actions={<DemoButton location="hero" src="compare-hero" size="lg" />}
        micro="Facts about other providers last checked October 23, 2026. We re-check every quarter."
        scene="compare"
        size="compact"
      />

      {/* S2 · The short answer */}
      <Section tone="cream" id="short-answer" width="narrow">
        <SectionHeading title="The short answer" />
        <ul className="mt-6 space-y-3 text-[16.5px] leading-relaxed text-tone-muted sm:text-[17.5px]">
          <li>
            <strong className="font-semibold text-tone-fg">Keep your broker</strong> if you want someone else to handle filing and
            advice, and your volume is low.
          </li>
          <li>
            <strong className="font-semibold text-tone-fg">Pick a broad ABI suite</strong> if you need in-bond, FTZ, drawback or AES
            in one system.
          </li>
          <li>
            <strong className="font-semibold text-tone-fg">Pick MyCargoLens</strong> if you file ISF and entries yourself, every week,
            and want each filing checked before CBP sees it at a price on the website.
          </li>
        </ul>
      </Section>

      {/* S3 · Criteria */}
      <Section tone="sky" id="what-to-compare">
        <SectionHeading title="Five questions to ask any option" />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            <>
              <strong className="font-semibold text-tone-fg">Who sends the filing to CBP, and who&apos;s responsible for it?</strong>{" "}
              (The importer of record is responsible either way.)
            </>,
            <>
              <strong className="font-semibold text-tone-fg">When do you see the price?</strong> Before you file, on the invoice, or
              at contract renewal?
            </>,
            <>
              <strong className="font-semibold text-tone-fg">How do you see a deadline coming?</strong> A clock on every ISF, or
              someone watching a sheet?
            </>,
            <>
              <strong className="font-semibold text-tone-fg">What gets checked before CBP sees it,</strong> and how is a rejection
              explained?
            </>,
            <>
              <strong className="font-semibold text-tone-fg">What does it file,</strong> and what doesn&apos;t it?
            </>,
          ].map((q, i) => (
            <li key={i} className="flex flex-col rounded-[20px] p-5 site-surface">
              <span aria-hidden className="font-mono text-[13px] font-semibold tabular-nums text-tone-eyebrow">
                0{i + 1}
              </span>
              <p className="mt-3 text-[15px] leading-relaxed text-tone-muted">{q}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* S4 · Table (desktop) / stacked cards (mobile) */}
      <Section tone="paper" id="side-by-side" width="wide">
        <SectionHeading title="Side by side" />
        <div className="mt-10 hidden overflow-hidden rounded-[20px] site-surface lg:block">
          <table className="w-full table-fixed border-collapse text-left text-[14px] leading-snug">
            <caption className="sr-only">Four ways to file US customs compared with MyCargoLens</caption>
            <colgroup>
              <col className="w-[15%]" />
              <col span={4} className="w-[17%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[hsl(var(--surface-border))]">
                <td className="p-4" />
                {OPTIONS.map((o, i) => (
                  <th
                    key={o}
                    scope="col"
                    className={cn(
                      "p-4 align-bottom text-[14px] font-semibold text-tone-fg",
                      i === OPTIONS.length - 1 && "bg-[hsl(222_60%_45%/0.07)] dark:bg-[hsl(214_90%_70%/0.08)]",
                    )}
                  >
                    {o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, ...cells]) => (
                <tr key={label} className="border-b border-[hsl(var(--surface-border))] last:border-b-0">
                  <th scope="row" className="p-4 align-top text-[13.5px] font-semibold text-tone-fg">
                    {label}
                  </th>
                  {cells.map((c, i) => (
                    <td
                      key={i}
                      className={cn(
                        "p-4 align-top text-tone-muted",
                        i === cells.length - 1 &&
                          "bg-[hsl(222_60%_45%/0.07)] font-medium text-tone-fg dark:bg-[hsl(214_90%_70%/0.08)]",
                      )}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-8 space-y-4 lg:hidden">
          {OPTIONS.map((o, oi) => {
            const ours = oi === OPTIONS.length - 1;
            return (
              <li
                key={o}
                className={cn(
                  "rounded-[20px] p-5 site-surface",
                  ours && "ring-1 ring-[hsl(222_60%_45%/0.25)] dark:ring-[hsl(214_90%_70%/0.3)]",
                )}
              >
                <h3 className="text-[17px] font-semibold text-tone-fg">{o}</h3>
                <dl className="mt-3 divide-y divide-[hsl(var(--surface-border))]">
                  {ROWS.map(([label, ...cells]) => (
                    <div key={label} className="py-2.5">
                      <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-tone-eyebrow">{label}</dt>
                      <dd className={cn("mt-1 text-[14.5px] leading-snug", ours ? "text-tone-fg" : "text-tone-muted")}>{cells[oi]}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-[13px] text-tone-muted">
          Category descriptions are general. Individual brokers, vendors and services differ. Vendor facts dated October 23, 2026.
        </p>
      </Section>

      {/* S5 · Each option, fairly */}
      <Section tone="mint" id="each-option">
        <SectionHeading title="Each option, fairly" />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {BLOCKS.map((b) => (
            <article key={b.title} className="flex min-w-0 flex-col rounded-[20px] p-6 site-surface sm:p-7">
              <h3 className="text-[20px] font-semibold tracking-[-0.015em] text-tone-fg">{b.title}</h3>
              <dl className="mt-4 space-y-3 text-[15px] leading-relaxed">
                {(
                  [
                    ["Right choice when", b.rightWhen],
                    ["Teams look elsewhere when", b.elsewhereWhen],
                    ["Where MyCargoLens fits", b.fits],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold text-tone-fg">{k}</dt>
                    <dd className="text-tone-muted">{v}</dd>
                  </div>
                ))}
              </dl>
              {b.facts && (
                <div className="mt-5 rounded-2xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--foreground)/0.03)] p-4">
                  <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-tone-eyebrow">
                    <CalendarDays aria-hidden className="size-3.5" />
                    As of October 23, 2026
                  </p>
                  <ul className="mt-2.5 space-y-2 text-[13.5px] leading-relaxed text-tone-muted">
                    {b.facts.map((f) => (
                      <li key={f.text}>
                        {f.text}{" "}
                        <span>
                          [
                          {f.sources.map((s, i) => (
                            <React.Fragment key={s.href}>
                              {i > 0 && "; "}
                              <a href={s.href} target="_blank" rel="noopener noreferrer" className={ext}>
                                {s.label}
                                <span className="sr-only"> (opens in a new tab)</span>
                              </a>
                            </React.Fragment>
                          ))}
                          ]
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {b.link && <ArrowLink href={b.link.href} className="mt-5 self-start">{b.link.label}</ArrowLink>}
            </article>
          ))}
        </div>
      </Section>

      {/* S6 · When we're not the right fit */}
      <Section tone="lilac" id="not-a-fit">
        <SectionHeading title="When we're not the right fit" />
        <DashList
          className="mt-8 max-w-2xl"
          items={[
            "You need in-bond, FTZ, drawback or AES in the same tool",
            "You want someone to file for you and give licensed advice",
            "You ship once or twice a year",
            "You run bulk e-commerce entry volumes",
          ]}
        />
        <p className="mt-6 text-[16px] font-medium text-tone-fg">If that&apos;s you, tell us on a call and we&apos;ll say so.</p>
      </Section>

      {/* S7 · How MyCargoLens charges */}
      <Section tone="peach" id="pricing">
        <SectionHeading title="The price is on the website" />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col rounded-[20px] p-6 site-surface sm:p-8">
            <h3 className="text-[17px] font-semibold text-tone-fg">Importers filing their own</h3>
            <PriceLine className="mt-3 text-[14px]">$45 ISF · $180 ISF + Entry · $280 Complete, per shipment, no monthly fee</PriceLine>
            <ArrowLink href={ROUTES.pricing.href} className="mt-auto self-start pt-5">
              See pricing
            </ArrowLink>
          </div>
          <div className="flex flex-col rounded-[20px] p-6 site-surface sm:p-8">
            <h3 className="text-[17px] font-semibold text-tone-fg">NVOCCs, forwarders and brokers filing at volume</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-tone-muted">Volume pricing on request, agreed in writing.</p>
            <ArrowLink href="/pricing#volume" className="mt-auto self-start pt-5">
              Volume pricing
            </ArrowLink>
          </div>
        </div>
        <CheckList
          className="mt-8"
          items={[
            "You're charged when CBP accepts the shipment. Rejected filings aren't charged, and resubmits are never charged twice.",
          ]}
        />
        <p className="mt-5 max-w-3xl text-[15.5px] leading-relaxed text-tone-muted">
          For an importer, $180 for ISF and entry is about what many brokers charge per shipment. We compete on a known price and on
          what you can see, and we don&apos;t claim to be cheaper.
        </p>
      </Section>

      {/* S8 · How teams start (S9 proof slot hidden until a permissioned quote exists) */}
      <Section tone="mesh" id="start">
        <SectionHeading title="Start with one lane" />
        <StepFlow
          className="mt-12"
          steps={[
            { title: "Book a 20-minute demo.", body: "We look at how you file today and show the parts that matter." },
            { title: "We set your team up.", body: "Accounts are provisioned by our team, with the right roles from day one." },
            {
              title: "Run one lane next to what you have.",
              body: "Keep your broker or current system for everything else until you decide.",
            },
          ]}
        />
        <p className="mt-12 max-w-3xl text-[15.5px] leading-relaxed text-tone-muted">
          We&apos;re early, so you can check our records before you trust them. Every CBP request and response is logged, the audit
          trail exports to CSV, and every filing exports as a PDF.
        </p>
        <ArrowLink href={ROUTES.changelog.href} className="mt-5">
          See what we&apos;ve shipped
        </ArrowLink>
      </Section>

      {/* S10 · FAQ */}
      <Section tone="cream" id="faq" width="narrow">
        <SectionHeading title="Questions about switching" />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      <CtaBand
        title="Compare it on your own filings."
        sub="In 20 minutes we'll look at how you file today and show you where MyCargoLens would and wouldn't fit."
        src="compare-close"
        links={[
          { label: "For importers", href: ROUTES.importers.href },
          { label: "For NVOCCs and forwarders", href: ROUTES.nvoccForwarders.href },
        ]}
      />
    </>
  );
}
