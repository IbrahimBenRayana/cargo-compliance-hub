import type { Metadata } from "next";
import Link from "next/link";
import {
  Fingerprint,
  KeyRound,
  Lock,
  MailCheck,
  RefreshCcw,
  ShieldCheck,
  Timer,
  Webhook,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";
import { CertBadge } from "@/components/site/cert-badge";
import { CheckList, FeatureSplit } from "@/components/site/blocks";
import { Faq } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { Button } from "@/components/ui/button";
import { webPage } from "@/lib/schema";
import { ROUTES } from "@/lib/site";
import { CtaBand } from "@/components/site/cta-band";

const TITLE = "Security and data handling";
const DESCRIPTION =
  "Four roles, MFA, a CSV audit trail and a log of every CBP request and response. How MyCargoLens protects customs data and who processes it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ROUTES.security.href },
  openGraph: { title: TITLE, description: DESCRIPTION, url: ROUTES.security.href, type: "website" },
};

/**
 * security@mycargolens.com is still [CONFIRM inbox] in copy/security.md, so
 * security mail goes to the support inbox already used across the site.
 * Swap this one constant once the security inbox is confirmed monitored.
 */
const SECURITY_EMAIL = "support@mycargolens.com";
const QUESTIONNAIRE_MAILTO = `mailto:${SECURITY_EMAIL}?subject=${encodeURIComponent("Security questionnaire")}`;

const JUMP = [
  { id: "cbp-filing", label: "CBP filing" },
  { id: "signing-in", label: "Signing in" },
  { id: "roles", label: "Roles" },
  { id: "audit-trail", label: "Audit trail" },
  { id: "processors", label: "Processors" },
  { id: "data", label: "Data" },
  { id: "faq", label: "FAQ" },
  { id: "report", label: "Report an issue" },
];

type Fact = { icon: LucideIcon; title: string; body: string };

const SIGN_IN: Fact[] = [
  {
    icon: MailCheck,
    title: "Accounts by invitation only",
    body: "There's no public sign-up. Our team creates your company's account after a demo, and each person joins from an emailed invite and proves their email address.",
  },
  {
    icon: Fingerprint,
    title: "Multi-factor authentication",
    body: "Available on every account: an authenticator app, email one-time codes as a backup, and single-use recovery codes.",
  },
  { icon: KeyRound, title: "Passwords", body: "Hashed with bcrypt (cost 12). We never store them in plain text." },
  {
    icon: RefreshCcw,
    title: "Sessions",
    body: "Short-lived access tokens, and a refresh token that changes every time it's used. Resetting a password signs out every other session.",
  },
  { icon: Timer, title: "Login limits", body: "Repeated sign-in attempts are rate-limited." },
  { icon: Lock, title: "MFA secrets", body: "Stored encrypted with AES-256-GCM." },
];

const IN_TRANSIT: Fact[] = [
  { icon: Lock, title: "TLS everywhere", body: "Every connection to the app, the API and webhooks uses TLS." },
  {
    icon: KeyRound,
    title: "API keys shown once",
    body: "API keys are shown once. We store only a hash of each key, and you can revoke a key without touching anyone's login.",
  },
  {
    icon: Layers,
    title: "Scoped keys",
    body: "Each key carries scopes, so a key that only reads filings can't submit them.",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    body: "Webhooks are signed with HMAC-SHA256 so your system can check they came from us.",
  },
];

const ROLES = ["Owner", "Admin", "Operator", "Viewer"];

/** Subprocessors (copy §7). No transmission row: filings go directly to CBP. Unverified regions are not printed. */
const PROCESSORS = [
  { company: "Contabo", what: "Servers and database hosting", receives: "All application data" },
  {
    company: "OpenAI",
    what: "Pre-flight review, rejection explanations, HTS suggestions, in-app assistant",
    receives: "The filing or question being reviewed, and the CBP response where relevant.",
  },
  { company: "Stripe", what: "Billing", receives: "Billing contact email and payment events." },
  {
    company: "Microsoft Azure (Communication Services)",
    what: "Transactional email (invites, codes, alerts)",
    receives: "Recipient address and message content",
  },
  {
    company: "Terminal 49",
    what: "Container tracking (Complete plan)",
    receives: "Bill of lading, booking or container numbers you choose to track",
  },
];

const FAQ = [
  {
    q: "Do you have a SOC 2 report?",
    a: "Not yet. This page lists the controls we have today, and we'll answer your security questionnaire directly.",
  },
  {
    q: "Do you support SSO?",
    a: "Not yet. Today every account has MFA, four roles, email-verified invites and a full audit trail.",
  },
  {
    q: "Are you a customs broker?",
    a: "No. MyCargoLens is software. The importer of record stays responsible for what's filed, which is why every filing and every CBP response is visible to your team.",
  },
  {
    q: "Can we export our records?",
    a: "Yes. The audit log exports to CSV, and any filing exports as a PDF with its full history.",
  },
  { q: "Where is our data hosted?", a: "Ask us and we'll tell you exactly where, and send it in writing." },
];

/** Demo data only: action names are real audit actions (server auditLog callers). */
const LOG_SAMPLE = `2026-05-23T14:21:08Z · operator@example.com · 192.0.2.14
→ filing.created · ISF-10 · INV-4421
2026-05-23T14:22:31Z · operator@example.com · 192.0.2.14
→ filing.submitted · ISF-10 · INV-4421`;

const linkCls =
  "font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current";

function FactGrid({ items }: { items: Fact[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map(({ icon: Icon, title, body }) => (
        <li key={title} className="rounded-[20px] p-5 site-surface">
          <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-[hsl(var(--surface))] text-tone-fg ring-1 ring-[hsl(var(--surface-border))]">
            <Icon className="size-[18px]" strokeWidth={1.9} />
          </span>
          <h3 className="mt-4 text-[16.5px] font-semibold leading-snug text-tone-fg">{title}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-tone-muted">{body}</p>
        </li>
      ))}
    </ul>
  );
}

export default function SecurityPage() {
  return (
    <>
      <JsonLd data={webPage({ path: ROUTES.security.href, name: TITLE, description: DESCRIPTION, aboutSoftware: true })} />

      {/* 2. Hero */}
      <PageHero
        size="compact"
        breadcrumbPath={ROUTES.security.href}
        badge={<CertBadge />}
        eyebrow="Security"
        title="Security at MyCargoLens"
        sub="Customs filings carry your IOR number, your parties and your bond. This page lists who can see that data, how sign-in works, which companies process it, and what gets logged. If something here doesn't answer your question, ask us."
        actions={
          <>
            <DemoButton location="hero" src="security-hero" size="lg" />
            <Button asChild variant="outline" size="lg" className="bg-[hsl(var(--surface))]">
              <a href={QUESTIONNAIRE_MAILTO} data-location="hero">
                Ask for our security answers
              </a>
            </Button>
          </>
        }
        scene="security"
      >
        <nav aria-label="On this page">
          <ul className="flex flex-wrap gap-2">
            {JUMP.map((j) => (
              <li key={j.id}>
                <a
                  href={`#${j.id}`}
                  className="inline-flex h-8 items-center rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] px-3 text-[13px] font-medium text-tone-muted transition-colors hover:text-tone-fg"
                >
                  {j.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHero>

      {/* 3. CBP filing */}
      <Section tone="cream" id="cbp-filing">
        <FeatureSplit
          title="What happens when you file with CBP."
          body={
            <CheckList
              className="mt-2"
              items={[
                "CBP ABI certified, with a direct connection to CBP.",
                "MyCargoLens files ISF-10, ISF-5, entry summaries (7501) and cargo release (3461) with CBP.",
                "Every request we send to CBP and every response we get back is logged against the filing, with its status and timing, and visible to your team.",
                "CBP responses are picked up every minute, and any transmission CBP hasn't answered gets flagged.",
              ]}
            />
          }
          screenshot={{
            screen: "app-isf-timeline",
            caption: "A filing record: each transmission to CBP and its response, with sample data.",
          }}
        />
      </Section>

      {/* 4. Signing in */}
      <Section tone="sky" id="signing-in">
        <SectionHeading title="How we know it's you." />
        <div className="mt-10">
          <FactGrid items={SIGN_IN} />
        </div>
      </Section>

      {/* 5. Roles */}
      <Section tone="paper" id="roles">
        <FeatureSplit
          title="Four roles. Each person sees what their job needs."
          body={
            <>
              <p>You pick a role when you invite someone, and Owners and Admins can change it later.</p>
              <ul className="!mt-6 flex flex-wrap gap-2" aria-label="Roles">
                {ROLES.map((r) => (
                  <li
                    key={r}
                    className={
                      "inline-flex h-8 items-center rounded-full px-3.5 text-[13.5px] font-semibold ring-1 " +
                      (r === "Viewer"
                        ? "bg-[hsl(var(--surface))] text-tone-muted ring-[hsl(var(--surface-border))]"
                        : "bg-[hsl(var(--card))] text-tone-fg ring-[hsl(var(--surface-border))]")
                    }
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </>
          }
          screenshot={{ screen: "app-team-roles", caption: "The team page, with sample data." }}
        />
      </Section>

      {/* 6. The audit trail */}
      <Section tone="mint" id="audit-trail">
        <FeatureSplit
          reverse
          title="Every change has a name and a time on it."
          body={
            <>
              <p>
                The audit log records who did what, to which filing, when, and from which IP address. Edits keep the
                before and after values.
              </p>
              <p>Owners and Admins can filter it and export it to CSV for an auditor or your compliance team.</p>
              <p>Alongside it, the CBP submission log keeps every request and response.</p>
            </>
          }
          media={
            <figure className="m-0">
              <pre tabIndex={0} className="overflow-x-auto rounded-2xl border border-[hsl(var(--surface-border))] bg-[hsl(222_40%_12%)] p-5 font-mono text-[12.5px] leading-relaxed text-[hsl(216_30%_85%)] sm:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(205_90%_78%)]">
                {LOG_SAMPLE}
              </pre>
              <figcaption className="mt-3 text-[13px] text-tone-muted">Audit log entries, with sample data.</figcaption>
            </figure>
          }
        />
      </Section>

      {/* 7. Who processes your data */}
      <Section tone="lilac" id="processors">
        <SectionHeading
          title="The companies we use, and what they see."
          intro="We keep this list short and up to date. If it changes, we update this page."
        />
        <p className="mt-6 font-mono text-[12.5px] text-tone-muted">Last updated Oct 26, 2026</p>
        {/* desktop: real table */}
        <div className="mt-4 hidden overflow-hidden rounded-[20px] site-surface md:block">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-[hsl(var(--surface-border))] text-[12px] uppercase tracking-[0.12em] text-tone-muted">
                <th scope="col" className="px-5 py-3.5 font-semibold">Company</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">What for</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">What they receive</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.company} className="border-b border-[hsl(var(--surface-border))] last:border-0 align-top">
                  <th scope="row" className="px-5 py-4 font-semibold text-tone-fg">{p.company}</th>
                  <td className="px-5 py-4 leading-relaxed text-tone-muted">{p.what}</td>
                  <td className="px-5 py-4 leading-relaxed text-tone-muted">{p.receives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* mobile: stacked cards */}
        <ul className="mt-4 space-y-3 md:hidden">
          {PROCESSORS.map((p) => (
            <li key={p.company} className="rounded-[18px] p-5 site-surface">
              <p className="text-[16px] font-semibold text-tone-fg">{p.company}</p>
              <dl className="mt-2 space-y-2 text-[14.5px] leading-relaxed">
                <div>
                  <dt className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-tone-muted">What for</dt>
                  <dd className="text-tone-fg">{p.what}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-tone-muted">What they receive</dt>
                  <dd className="text-tone-fg">{p.receives}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[14.5px] text-tone-muted">
          Filings themselves go to U.S. Customs and Border Protection, which is the recipient, not a processor. See also our{" "}
          <Link href={ROUTES.privacy.href} className={linkCls}>
            privacy policy
          </Link>
          .
        </p>
      </Section>

      {/* 8. Data in transit */}
      <Section tone="peach" id="data">
        <SectionHeading title="How your data moves." />
        <div className="mt-10">
          <FactGrid items={IN_TRANSIT} />
        </div>
        <p className="mt-6 text-[14.5px] text-tone-muted">
          Keys and webhooks are covered in the{" "}
          <Link href={ROUTES.api.href} className={linkCls}>
            API overview
          </Link>
          , and the audit trail shows up in{" "}
          <Link href={ROUTES.inbox.href} className={linkCls}>
            the inbox
          </Link>
          .
        </p>
      </Section>

      {/* 9. FAQ */}
      <Section tone="mesh" id="faq" width="narrow">
        <SectionHeading title="Straight answers." />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      {/* 10. Report a vulnerability */}
      <Section tone="cream" id="report" spacing="compact" width="narrow">
        <div className="flex gap-4">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl site-surface text-tone-fg">
            <ShieldCheck className="size-5" strokeWidth={1.9} />
          </span>
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-tone-fg sm:text-[26px]">
              Found a security issue? Tell us.
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-tone-muted">
              Email{" "}
              <a href={`mailto:${SECURITY_EMAIL}`} className={linkCls}>
                {SECURITY_EMAIL}
              </a>{" "}
              with what you found and how to reproduce it. Please give us time to fix it before you publish.
            </p>
            <p className="mt-3 text-[14.5px] text-tone-muted">
              More about who we are on the{" "}
              <Link href={ROUTES.about.href} className={linkCls}>
                about page
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>

      {/* 11. Close */}
      <CtaBand
        title="Have a security review to run? Start with a demo."
        sub="We'll show you roles, MFA and the CBP submission log in the product, and answer your questionnaire after."
        src="security-close"
        links={[{ label: "Email our security answers request", href: QUESTIONNAIRE_MAILTO }]}
      />
    </>
  );
}
