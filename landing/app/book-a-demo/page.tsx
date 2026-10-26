import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, MessageSquareText, ReceiptText, type LucideIcon } from "lucide-react";
import { Section } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { CertBadge } from "@/components/site/cert-badge";
import { Faq } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { APP_LOGIN_URL, ROUTES } from "@/lib/site";
import { graph, webPage } from "@/lib/schema";
import { DemoForm } from "./_components/demo-form";
import { HERO, faqItems, parsePersona, type DemoPersona } from "./_components/demo-copy";

const TITLE = "Book a demo of ISF and entry filing software";
const DESCRIPTION =
  "See MyCargoLens on shipments like yours in 20 minutes: the ranked inbox, checks before CBP, and per-shipment pricing. We set your team up after.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ROUTES.bookADemo.href },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Book a MyCargoLens demo",
    description: DESCRIPTION,
    url: ROUTES.bookADemo.href,
    type: "website",
  },
  twitter: { title: "Book a MyCargoLens demo", description: DESCRIPTION },
};

type Item = { icon: LucideIcon; title: string; body: string };

/** Deck §3. Item 2 drops "Pick a time on the next screen" while there is no scheduler. */
function valueItems(persona: DemoPersona): Item[] {
  const volume = persona === "nvocc" || persona === "broker" || persona === "developer";
  return [
    {
      icon: CalendarClock,
      title: "Your kind of shipments.",
      body: "We walk through ISF and entry filings that look like yours, in a demo account. No slides.",
    },
    {
      icon: MessageSquareText,
      title: "A reply from a person.",
      body: "A founder reads every request and emails you to find a time.",
    },
    {
      icon: ReceiptText,
      title: "Set up after, priced per shipment.",
      body: volume
        ? "If it fits, we set up your team with volume pricing agreed in writing. Same rule: charged only when CBP accepts."
        : "If it fits, we set up your team. Public plans are charged per shipment, only when CBP accepts.",
    },
  ];
}

export default async function BookADemoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const initialPersona = parsePersona((await searchParams).persona);
  const persona = initialPersona ?? "importer";
  const hero = HERO[persona];

  return (
    <>
      <JsonLd
        data={graph(webPage({ path: ROUTES.bookADemo.href, name: `${TITLE} | MyCargoLens`, description: DESCRIPTION }))}
      />

      <PageHero eyebrow="Book a demo" title={hero.title} sub={hero.sub} scene="book-a-demo" size="compact" />

      <Section tone="paper" spacing="compact" aria-label="Request a demo">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Form first on mobile, right column on desktop (deck §7). */}
          <div className="min-w-0 lg:order-2 lg:col-span-7">
            <div className="site-surface rounded-2xl p-5 sm:p-8">
              <DemoForm initialPersona={initialPersona} />
            </div>
            <p className="mt-4 text-center text-[14px] text-tone-muted">
              Existing customer?{" "}
              <a
                href={APP_LOGIN_URL}
                className="font-medium text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
              >
                Log in
              </a>
            </p>
          </div>

          <div className="min-w-0 lg:order-1 lg:col-span-5">
            <ul className="flex flex-col gap-6">
              {valueItems(persona).map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] text-tone-eyebrow"
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-[16px] font-semibold text-tone-fg">{title}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-tone-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            {persona === "nvocc" && (
              <p className="mt-6 border-l-2 border-[hsl(222_47%_22%)] pl-4 text-[15px] leading-relaxed text-tone-fg dark:border-[hsl(205_90%_78%)]">
                We&apos;re taking a small number of NVOCC and forwarder design partners: API onboarding with the
                founder, and volume pricing agreed in writing.
              </p>
            )}

            <div className="mt-8 border-t border-[hsl(var(--surface-border))] pt-6">
              <CertBadge />
              <p className="mt-4 text-[15px] leading-relaxed text-tone-fg">
                We transmit to CBP ourselves, with no middleman.
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-tone-muted">
                Software for importers, forwarders, NVOCCs and customs brokers. We are not a customs broker.
              </p>
              <Link
                href={ROUTES.security.href}
                className="mt-4 inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
              >
                How we handle your data
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="cream" width="narrow" spacing="compact" aria-labelledby="demo-faq">
        <h2 id="demo-faq" className="mb-4 text-[22px] font-semibold tracking-[-0.02em] text-tone-fg">
          Questions
        </h2>
        <Faq items={faqItems(persona)} schema={false} defaultOpen={-1} />
      </Section>
    </>
  );
}
