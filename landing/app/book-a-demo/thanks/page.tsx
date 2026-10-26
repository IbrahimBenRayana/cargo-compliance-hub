import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Section, Eyebrow } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { ROUTES } from "@/lib/site";
import { parseRoute, type Route } from "../_components/demo-copy";

export const metadata: Metadata = {
  title: "Request received",
  description: "Your MyCargoLens demo request is in. Here's what happens next and how to prepare.",
  alternates: { canonical: "/book-a-demo/thanks" },
  openGraph: { url: "/book-a-demo/thanks", title: "Request received" },
  robots: { index: false, follow: false },
};

type Step = { title?: string; body: string };

/**
 * Copy: copy/book-a-demo-thanks.md. There is no scheduler yet (Cal.com isn't
 * set up), so booked routes can't say "You're booked": they get the email-
 * route headline and a "we'll email you to find a time" sub instead.
 */
const BOOKED: Partial<Record<Route, { call: string; prepare: string; after: string }>> = {
  book_demo: {
    call: "your 20-minute demo",
    prepare:
      "Have a recent shipment in mind: origin, a rough HTS chapter, how many lines. No documents needed. If you've had a recent rejection, bring the error code and we'll walk through it.",
    after: "If it fits, we set up your team. Public plans are charged per shipment, only when CBP accepts.",
  },
  book_volume: {
    call: "your volume and API call",
    prepare:
      "Bring your rough monthly ISF count and how your TMS exports today. Invite your developer if you want to cover the API.",
    after:
      "If it fits, we set up your team and send volume terms in writing. Same rule: charged only when CBP accepts.",
  },
  book_technical: {
    call: "your technical call",
    prepare: "Bring the person who runs filing day to day, or send us their name when we email you.",
    after:
      "If it fits, we set up your team and send volume terms in writing. Same rule: charged only when CBP accepts.",
  },
};

const EMAIL_SUB: Partial<Record<Route, string>> = {
  broker_review: "We'll read what you file today and tell you plainly what fits before we book a time.",
  fit_check: "We'll look at your shipments and suggest the best next step, even if that isn't us.",
  review: "We read every request ourselves.",
};

const EMAIL_STEPS: Step[] = [
  { body: "A founder reads your note." },
  { body: "You get an email with what fits today, and what doesn't." },
  { body: "If it makes sense, we book a time in your working day." },
];

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const route = parseRoute((await searchParams).route);
  const booked = route ? BOOKED[route] : undefined;

  const title = route ? "Got it. A founder will reply by email." : "Thanks. Your request is in.";
  const sub = booked
    ? `We'll email you to find a time for ${booked.call}.`
    : route
      ? EMAIL_SUB[route]
      : "A founder will reply by email.";

  const steps: Step[] = booked
    ? [
        { title: "Watch your inbox.", body: "A founder reads your request and replies with times for the call." },
        {
          title: "On the call.",
          body: "We ask how you file today, then work through a sample ISF and entry in a demo account, on shipments like yours.",
        },
        { title: "After the call.", body: booked.after },
      ]
    : EMAIL_STEPS;

  return (
    <>
      <PageHero
        size="banner"
        scene="book-a-demo-thanks"
        badge={<CheckCircle2 aria-hidden className="size-12 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />}
        title={title}
        sub={sub}
      />

      <Section tone="paper" width="narrow" spacing="compact" aria-labelledby="next-steps">
        <div className="mx-auto max-w-[640px]">
          <h2 id="next-steps" className="text-[24px] font-semibold tracking-[-0.02em] text-tone-fg sm:text-[28px]">
            What happens next
          </h2>
          <ol className="mt-6">
            {steps.map((s, i) => (
              <li key={s.body} className="relative flex gap-4 pb-7 last:pb-0">
                {i < steps.length - 1 && (
                  <span aria-hidden className="absolute left-[15px] top-9 bottom-1 w-px bg-[hsl(var(--surface-border))]" />
                )}
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] text-[14px] font-semibold text-tone-fg"
                >
                  {i + 1}
                </span>
                <div className="pt-1">
                  {s.title && <p className="text-[16px] font-semibold text-tone-fg">{s.title}</p>}
                  <p className={s.title ? "mt-1 text-[15px] leading-relaxed text-tone-muted" : "text-[16px] leading-relaxed text-tone-fg"}>
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {booked && (
            <div className="mt-10 rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold text-tone-fg">How to prepare</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-tone-muted">{booked.prepare}</p>
            </div>
          )}

          <div className="mt-10 border-t border-[hsl(var(--surface-border))] pt-6">
            <Eyebrow>Read while you wait</Eyebrow>
            <ul className="mt-3 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-8">
              {[
                {
                  href: ROUTES.isfLateFilingPenalties.href,
                  label: "ISF late filing penalties: what CBP can claim, and when",
                  live: ROUTES.isfLateFilingPenalties.live,
                },
                { href: ROUTES.security.href, label: "How we handle your data", live: true },
              ]
                .filter((l) => l.live)
                .map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
                    >
                      {l.label}
                      <ArrowRight aria-hidden className="size-4 shrink-0" />
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
