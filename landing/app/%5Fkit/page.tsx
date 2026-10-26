import type { Metadata } from "next";
import { Section, SectionHeading, TONES, Eyebrow } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton, SecondaryCta } from "@/components/site/cta";
import { CertBadge } from "@/components/site/cert-badge";
import { CardGrid, CheckList, FeatureSplit, StatCards, StepFlow } from "@/components/site/blocks";
import { Screenshot } from "@/components/site/screenshot";
import { Faq } from "@/components/site/faq";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { CtaBand } from "@/components/site/cta-band";
import { StickyDemoBar } from "@/components/site/sticky-demo-bar";
import { ACCENTS, MODULE_ORDER, accentClass } from "@/lib/accents";
import { ROUTES } from "@/lib/site";

/**
 * Temporary reference page for the page builders (build plan T3 /
 * Checkpoint A): every section tone and every shared block in use.
 * Lives at /_kit (folder %5Fkit), noindex. Remove after the CMO signs off.
 */
export const metadata: Metadata = {
  title: "Component kit",
  robots: { index: false, follow: false },
};

const MODULE_ROUTES = [
  ROUTES.isfFiling,
  ROUTES.customsEntry,
  ROUTES.inbox,
  ROUTES.preFilingChecks,
  ROUTES.compliance,
  ROUTES.api,
];

export default function KitPage() {
  return (
    <>
      {/* 1. PageHero: full tier, badge, CTAs, breadcrumb, Hero3D */}
      <PageHero
        breadcrumbPath="/platform/isf-filing"
        accent="isf"
        badge={<CertBadge />}
        eyebrow="ISF filing"
        title="Every house bill on a deadline clock."
        sub="ISF-10 and ISF-5, each with a deadline clock and alerts at 72, 48 and 24 hours."
        actions={
          <>
            <DemoButton location="hero" src="kit-hero" size="lg" />
            <SecondaryCta location="hero" size="lg" />
          </>
        }
        micro="Pay per shipment, only when CBP accepts. No monthly fee on the public plans."
        scene="isf-filing"
      />

      {/* 2. Tone swatches: every tone, adjacent tones differ */}
      {TONES.filter((t) => t !== "hero" && t !== "footer").map((tone) => (
        <Section key={tone} tone={tone} spacing="compact">
          <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
            <div>
              <Eyebrow>tone=&quot;{tone}&quot;</Eyebrow>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-tone-fg">The {tone} band.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <p className="text-[16px] leading-relaxed text-tone-muted">
                Body copy on this band uses <code>text-tone-muted</code>; headings use <code>text-tone-fg</code>;
                eyebrows use the tone (or module) eyebrow colour. All pass AA in light and dark.
              </p>
              <div className="rounded-[20px] p-5 site-surface">
                <p className="text-[15px] font-semibold text-tone-fg">site-surface card</p>
                <p className="mt-1 text-[14px] text-tone-muted">Cards and screenshot bezels sit on every tone.</p>
                <a href="#top" className="mt-2 inline-block text-[14px] font-semibold text-tone-fg underline underline-offset-4">
                  Text link
                </a>
              </div>
            </div>
          </div>
        </Section>
      ))}

      {/* 3. Module accents */}
      <Section tone="cream" id="accents">
        <SectionHeading
          eyebrow="Module accents"
          title="One accent per product module."
          intro="accentClass(module) sets --a / --a-ink / --a-soft; use text-a-ink, bg-a-soft, bg-a inside."
        />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {MODULE_ORDER.map((m) => {
            const A = ACCENTS[m];
            return (
              <div key={m} className={`rounded-2xl border border-[hsl(var(--a)/0.25)] bg-a-soft p-4 ${accentClass(m)}`}>
                <A.icon aria-hidden className="size-5 text-a-ink" />
                <p className="mt-3 text-[14px] font-semibold text-a-ink">{A.label}</p>
                <p className="mt-1 font-mono text-[11px] text-tone-muted">acc-{m}</p>
                <span aria-hidden className="mt-3 block h-1.5 rounded-full bg-a" />
              </div>
            );
          })}
        </div>
      </Section>

      {/* 4. CardGrid: module cards from the registry */}
      <Section tone="sky" id="cards">
        <SectionHeading eyebrow="CardGrid" title="Six parts, one record per shipment." />
        <CardGrid
          className="mt-10"
          items={MODULE_ROUTES.map((r) => ({ title: r.label, body: r.blurb, href: r.href, module: r.module }))}
        />
        <CardGrid
          className="mt-5"
          columns={2}
          items={[
            { title: "Plain card", body: "No module: neutral surface, no icon.", kicker: "Kicker" },
            { title: "Linked plain card", body: "Whole card is the link.", href: ROUTES.compare.href, linkLabel: "How we compare" },
          ]}
        />
      </Section>

      {/* 5. FeatureSplit + Screenshot */}
      <Section tone="paper" id="feature-split" accent="inbox">
        <FeatureSplit
          eyebrow="FeatureSplit"
          title="Open work, ranked by what needs you first."
          body={<p>Copy on one side, a real screen in a browser frame on the other. Stacks copy-first on phones.</p>}
          bullets={["ISF alerts at 72, 48 and 24 hours", "CBP status checked every 5 minutes", "Every filing on one record"]}
          actions={<SecondaryCta as="link" location="section" />}
          screenshot={{ screen: "app-compliance-inbox", caption: "The inbox, with sample data." }}
        />
        <FeatureSplit
          reverse
          className="mt-20"
          eyebrow="reverse + placeholder"
          title="A screen we haven't captured yet."
          body={<p>The placeholder variant reserves the space with a designed surface.</p>}
          screenshot={{ placeholder: "Rejection coach: the CBP error in plain English, with fix steps", url: "app.mycargolens.com/shipments" }}
        />
      </Section>

      {/* 6. Screenshot variants */}
      <Section tone="mint" id="screens">
        <SectionHeading eyebrow="Screenshot" title="Browser frame, crop and phone." />
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_1fr_260px]">
          <Screenshot screen="app-isf-timeline" caption='screen="app-isf-timeline"' />
          <Screenshot screen="app-shipments-list" aspect="16/9" caption='aspect="16/9" crops top-left' />
          <Screenshot screen="app-m-compliance" caption="phone capture" />
        </div>
      </Section>

      {/* 7. StatCards */}
      <Section tone="lilac" id="stats">
        <SectionHeading eyebrow="StatCards" title="Cited numbers, never animated." />
        <StatCards
          className="mt-10"
          items={[
            { value: "72 · 48 · 24h", label: "ISF deadline alerts before the 24-hour cutoff." },
            { value: "5 min", label: "How often we check CBP status on open filings." },
            { value: "12,345", label: "Example third-party figure: always cite the source.", source: { label: "Example source", href: "https://www.cbp.gov" } },
          ]}
        />
      </Section>

      {/* 8. StepFlow */}
      <Section tone="peach" id="steps">
        <SectionHeading eyebrow="StepFlow" title="How a shipment moves." />
        <StepFlow
          className="mt-12"
          steps={[
            { title: "File the ISF", body: "ISF-10 or ISF-5, checked before it goes.", module: "isf" },
            { title: "File the entry", body: "7501 and 3461, prefilled from the accepted ISF.", module: "entry" },
            { title: "CBP accepts", body: "Status checked every 5 minutes.", module: "inbox" },
            { title: "Liquidation clock", body: "Tracked to the day after entry.", module: "compliance" },
          ]}
        />
      </Section>

      {/* 9. Dark band (ink) with a CheckList and buttons */}
      <Section tone="ink" id="ink" accent="api">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Ink band" title="Code strips and second dark bands." intro="Section adds .dark, so every token flips." />
            <CheckList className="mt-6" items={["REST or XML in", "Signed webhooks out", "Scoped, revocable keys"]} />
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-5 font-mono text-[13px] leading-relaxed text-[hsl(216_30%_85%)]">
{`POST /api/public/v1/isf
Authorization: Bearer mcl_live_…

{ "type": "ISF-10", "mbol": "OOLU210577643" }`}
          </pre>
        </div>
      </Section>

      {/* 10. FAQ + Breadcrumbs (narrow width) */}
      <Section tone="mesh" id="faq" width="narrow">
        <Breadcrumbs path="/resources/isf-late-filing-penalties" className="mb-8" />
        <SectionHeading eyebrow="Faq" title="Questions, answered." />
        <Faq
          className="mt-8"
          items={[
            { q: "Is MyCargoLens a customs broker?", a: "No. MyCargoLens is software for importers, forwarders, NVOCCs and customs brokers. We are not a licensed customs broker." },
            { q: "How does the FAQ render?", a: "Native details/summary elements, one open at a time, with FAQPage JSON-LD built from the same text." },
            { q: "Can answers contain links?", a: "Keep answers plain text so the JSON-LD matches the page exactly; link from the copy around the FAQ instead." },
          ]}
        />
      </Section>

      {/* 11. Banner hero tier (as used on article / book a demo / thanks / 404) */}
      <PageHero
        size="banner"
        breadcrumbPath="/resources/isf-late-filing-penalties"
        eyebrow='PageHero size="banner"'
        title="ISF late filing penalties."
        sub="Banner tier: centred copy, short scene under it."
        scene="resources"
      />

      {/* 12. Pre-footer band (every page ends with one) */}
      <CtaBand variant="default" src="kit-close" />
      <StickyDemoBar src="kit-sticky" />
    </>
  );
}
