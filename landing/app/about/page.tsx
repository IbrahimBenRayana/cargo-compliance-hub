import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";
import { CertBadge } from "@/components/site/cert-badge";
import { FeatureSplit, StepFlow } from "@/components/site/blocks";
import { JsonLd } from "@/components/site/json-ld";
import { graph, webPage, ORG_ID } from "@/lib/schema";
import { ACCENTS, accentClass } from "@/lib/accents";
import { COMPANY, ROUTES } from "@/lib/site";
import { CtaBand } from "@/components/site/cta-band";

const TITLE = "About us: ISF and customs entry software";
const DESCRIPTION =
  "Who builds MyCargoLens, why we built ISF and entry filing around one inbox, and what we are not: a customs broker. CBP ABI certified.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ROUTES.about.href },
  openGraph: { title: TITLE, description: DESCRIPTION, url: ROUTES.about.href, type: "website" },
};

/** What's live today (copy/about.md §4), each linked to its product page. */
const LIVE = [
  { text: "ISF-10 and ISF-5 filing with a deadline clock on every ISF", route: ROUTES.isfFiling },
  { text: "Entry summary and cargo release, prefilled from the accepted ISF", route: ROUTES.customsEntry },
  { text: "The urgency-ranked inbox", route: ROUTES.inbox },
  { text: "Pre-filing checks and plain-English rejections", route: ROUTES.preFilingChecks },
  { text: "A public REST API with signed webhooks", route: ROUTES.api },
];

const WE_ARE = [
  "Software for importers, forwarders, NVOCCs and customs brokers who file their own ISF and entries.",
  "A tool that flags and explains. Our HTS feature suggests codes with its reasoning; your team or broker decides.",
  "Focused on ISF-10, ISF-5, 7501 and 3461.",
];

const WE_ARENT = [
  "A licensed customs broker. We don't give classification rulings or legal advice.",
  "A guarantee. The importer of record stays responsible for what's filed, which is why we show you every filing before it goes.",
  "A full broker suite. In-bond, FTZ, drawback and AES are not available today.",
];

const linkCls =
  "font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current";

export default function AboutPage() {
  return (
    <>
      {/* The Organization node is site-wide, in the root layout. */}
      <JsonLd
        data={graph({
          ...webPage({ path: ROUTES.about.href, name: TITLE, description: DESCRIPTION, type: "AboutPage" }),
          about: { "@id": ORG_ID },
        })}
      />

      {/* 2. Hero */}
      <PageHero
        breadcrumbPath={ROUTES.about.href}
        eyebrow="About"
        title="We build ISF and entry filing software. That's all we build."
        sub="MyCargoLens is a small company making one product: software that shows customs filers which ISF or entry needs them now, checks it before CBP does, and puts the price per shipment on the website."
        actions={<DemoButton location="hero" src="about-hero" size="lg" />}
        scene="about"
      >
        <CertBadge link />
      </PageHero>

      {/* 3. Why we built it */}
      <Section tone="cream" id="why">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <SectionHeading title="Customs filing turned into rework." />
          <div className="space-y-5 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
            <p>
              Rules change every few months. The ISF deadline doesn&apos;t move: 24 hours before the cargo is laden. Most
              filing tools still show forty rows and leave you to work out which one matters, and most are priced by quote.
            </p>
            <p>
              We started MyCargoLens to make the first screen answer one question: what needs me now? Open work across ISF,
              entry and liquidation sits in one inbox, ranked by urgency. Every draft goes through rule checks before
              it&apos;s sent, and when CBP rejects something you get the reason in plain English with numbered steps to fix it.
            </p>
            <p>
              We put the price on the website because the invoice is the part filers say they can&apos;t predict. You&apos;re
              charged per shipment, only when CBP accepts.
            </p>
          </div>
        </div>
      </Section>

      {/* 4. What we've built so far */}
      <Section tone="sky" id="built">
        <FeatureSplit
          title="Filed with CBP, and on the record."
          body={
            <>
              <p>
                MyCargoLens files ISF-10, ISF-5, entry summaries (7501) and cargo release (3461) with CBP, and logs every
                request and response so you can prove what was sent.
              </p>
              <p>CBP ABI certified. Direct connection to CBP.</p>
              <p>
                <Link href={ROUTES.changelog.href} className={linkCls}>
                  See what shipped, release by release
                </Link>
              </p>
            </>
          }
          screenshot={{
            screen: "app-isf-timeline",
            caption: "A filing record: every transmission to CBP and every response, with sample data.",
          }}
        />

        <div className="mt-14">
          <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-tone-fg">What&apos;s live today</h3>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LIVE.map(({ text, route }) => {
              const A = route.module ? ACCENTS[route.module] : null;
              return (
                <li key={route.href} className={`flex ${accentClass(route.module)}`}>
                  <Link
                    href={route.href}
                    className="group flex w-full items-start gap-3 rounded-2xl p-4 site-surface transition-[transform] duration-200 ease-[var(--ease-out-quart)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-px"
                  >
                    {A && (
                      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-a-soft text-a-ink">
                        <A.icon className="size-4" strokeWidth={1.9} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-[15px] leading-snug text-tone-fg">{text}</span>
                    <ArrowRight
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-tone-muted transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* 5. What we are, and what we aren't */}
      <Section tone="paper" id="what-we-are">
        <SectionHeading title="Software. Not a customs broker." />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-[20px] p-6 site-surface sm:p-8">
            <h3 className="text-[18px] font-semibold text-tone-fg">We are</h3>
            <ul className="mt-5 space-y-4">
              {WE_ARE.map((t) => (
                <li key={t} className="flex gap-3 text-[15.5px] leading-relaxed text-tone-fg">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[20px] p-6 site-surface sm:p-8">
            <h3 className="text-[18px] font-semibold text-tone-muted">We aren&apos;t</h3>
            <ul className="mt-5 space-y-4">
              {WE_ARENT.map((t) => (
                <li key={t} className="flex gap-3 text-[15.5px] leading-relaxed text-tone-muted">
                  <Minus aria-hidden className="mt-1 size-4 shrink-0" strokeWidth={2.5} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 6. How we work */}
      <Section tone="mint" id="principles">
        <SectionHeading title="Three rules we use to decide what to build." />
        <StepFlow
          className="mt-12"
          steps={[
            {
              title: "The first screen answers “what now?”",
              body: "If a filer has to hunt for the urgent item, we got it wrong.",
            },
            {
              title: "Say the price, say the limits.",
              body: "The price per shipment is public, and so is the list of things we don't do.",
            },
            {
              title: "Every transmission on the record.",
              body: "Who sent what to CBP, and when, should be one click away for your team and your auditor.",
            },
          ]}
        />
      </Section>

      {/* 7. The team: hidden until real roles, backgrounds and photos exist (copy §7, wireframe 13). */}

      {/* 8. Where to find us */}
      <Section tone="peach" id="where" spacing="compact">
        <SectionHeading title="Where to find us" />
        <dl className="mt-8 grid gap-x-10 gap-y-6 text-[15.5px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.14em] text-tone-muted">Company</dt>
            <dd className="mt-1.5 text-tone-fg">{COMPANY.legalName}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.14em] text-tone-muted">General</dt>
            <dd className="mt-1.5">
              <Link href={ROUTES.contact.href} className={linkCls}>
                Contact us
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.14em] text-tone-muted">Security</dt>
            <dd className="mt-1.5">
              <Link href={ROUTES.security.href} className={linkCls}>
                How we handle your data
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.14em] text-tone-muted">Guides</dt>
            <dd className="mt-1.5">
              <Link href={ROUTES.resources.href} className={linkCls}>
                {ROUTES.resources.label}
              </Link>
            </dd>
          </div>
        </dl>
      </Section>

      {/* 9. Close */}
      <CtaBand
        title="Meet us on a 20-minute demo."
        sub="We'll look at how you file today, show you the inbox on shipments like yours, and tell you what it would cost. If it fits, we set up your team."
        src="about-close"
        micro="Pay per shipment, only when CBP accepts. No monthly fee on the public plans."
      />
    </>
  );
}
