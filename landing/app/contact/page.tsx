import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Handshake, LifeBuoy, Newspaper, ShieldAlert, TrendingUp, type LucideIcon } from "lucide-react";
import { Section } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton } from "@/components/site/cta";
import { JsonLd } from "@/components/site/json-ld";
import { COMPANY, ROUTES, ctaHref } from "@/lib/site";
import { ORG_ID, graph, webPage } from "@/lib/schema";
import { ContactForm, SUPPORT_EMAIL, TopicButton, type Topic } from "./_components/contact-form";

const TITLE = "Contact us: support, partners and press";
const DESCRIPTION =
  "Reach the MyCargoLens team for account support, partnerships, press or billing. Want to see the product on your own filings? Book a demo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ROUTES.contact.href },
  openGraph: { title: `${TITLE} | MyCargoLens`, description: DESCRIPTION, url: ROUTES.contact.href, type: "website" },
  twitter: { title: `${TITLE} | MyCargoLens`, description: DESCRIPTION },
};

type Way = {
  icon: LucideIcon;
  title: string;
  body: string;
  link?: { href: string; label: string; mail?: boolean };
  /** No public inbox yet: the card points at the form with this topic preselected. */
  topic?: Topic;
};

/**
 * Deck §3. [PARTNERS INBOX] and [PRESS INBOX] aren't confirmed, so those
 * cards send people to the form (topic preselected) instead of showing a
 * placeholder. The reply-time card uses the deck's fallback line.
 */
const WAYS: Way[] = [
  {
    icon: LifeBuoy,
    title: "Customers",
    body: "Help with filings, your account or the API.",
    link: { href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL, mail: true },
  },
  {
    icon: TrendingUp,
    title: "Sales and volume pricing",
    body: "NVOCCs, forwarders and brokers filing at volume.",
    link: { href: ctaHref({ persona: "nvocc", src: "contact" }), label: "Book a demo" },
  },
  {
    icon: Handshake,
    title: "Partnerships",
    body: "Brokers, surety agents, associations and software partners.",
    topic: "partnership",
  },
  { icon: Newspaper, title: "Press", body: "Interviews and media questions.", topic: "press" },
  {
    icon: ShieldAlert,
    title: "Security reports",
    body: "Found a vulnerability? See how to report it.",
    link: { href: `${ROUTES.security.href}#report`, label: "How to report it" },
  },
  { icon: Clock, title: "Reply time", body: "A person reads every message and replies by email." },
];

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPage({ path: ROUTES.contact.href, name: `${TITLE} | MyCargoLens`, description: DESCRIPTION, type: "ContactPage" }),
          {
            "@type": "Organization",
            "@id": ORG_ID,
            contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL }],
          },
        )}
      />

      <PageHero
        size="compact"
        scene="contact"
        breadcrumbPath={ROUTES.contact.href}
        eyebrow="Contact"
        title="Contact us"
        sub="For account help, partnerships, press or billing, use the form or write to the right inbox below. A person on our team reads every message."
      >
        {/* Sales banner (deck §2): the page's only gold button. */}
        <div className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] leading-relaxed text-tone-muted">
            <strong className="font-semibold text-tone-fg">Looking for a demo or pricing?</strong> Book a demo and
            we&apos;ll set up a call on shipments like yours.
          </p>
          <DemoButton location="inline" src="contact" className="shrink-0" />
        </div>
      </PageHero>

      <Section tone="paper" spacing="compact" aria-label="Ways to reach us">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Mobile: form first, then the cards (deck §6). */}
          <div className="min-w-0 lg:order-2 lg:col-span-7">
            <div className="site-surface rounded-2xl p-5 sm:p-8">
              <ContactForm />
            </div>
          </div>

          <div className="min-w-0 lg:order-1 lg:col-span-5">
            <h2 className="sr-only">Ways to reach us</h2>
            <ul className="divide-y divide-[hsl(var(--surface-border))] border-y border-[hsl(var(--surface-border))]">
              {WAYS.map(({ icon: Icon, title, body, link, topic }) => (
                <li key={title} className="flex items-start gap-4 py-4">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] text-tone-eyebrow"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15.5px] font-semibold text-tone-fg">{title}</h3>
                    <p className="mt-0.5 text-[14.5px] leading-relaxed text-tone-muted">{body}</p>
                    {link &&
                      (link.mail ? (
                        <a
                          href={link.href}
                          className="inline-flex min-h-11 items-center break-all text-[14.5px] font-medium text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="inline-flex min-h-11 items-center text-[14.5px] font-medium text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
                        >
                          {link.label}
                        </Link>
                      ))}
                    {topic && <TopicButton topic={topic}>Send a message</TopicButton>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[13px] text-tone-muted">
              {COMPANY.legalName}
              {COMPANY.postalAddress ? ` · ${COMPANY.postalAddress}` : null}
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
