import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Section, SectionHeading, Eyebrow } from "@/components/site/section";
import { PageHero } from "@/components/site/page-hero";
import { DemoButton } from "@/components/site/cta";
import { CardGrid, FeatureSplit } from "@/components/site/blocks";
import { Faq } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { Button } from "@/components/ui/button";
import { webPage } from "@/lib/schema";
import { ROUTES } from "@/lib/site";
import { CtaBand } from "@/components/site/cta-band";
import { InlineLink } from "../pre-filing-checks/_components/module-links";
import { CodePanel } from "./_components/code-panel";
import { EndpointTable } from "./_components/endpoint-table";
import { KeyList } from "./_components/key-list";

const PATH = ROUTES.api.href;
const TITLE = "ISF API and Customs Filing Webhooks";
const DESCRIPTION =
  "Create and submit ISF and entry filings from your own system. REST with JSON or XML, scoped revocable keys, HMAC-signed status webhooks.";
const SRC = "platform-api";
const VOLUME = `${ROUTES.pricing.href}#volume`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: PATH,
    siteName: "MyCargoLens",
    title: `${TITLE} | MyCargoLens`,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: `${TITLE} | MyCargoLens`, description: DESCRIPTION },
};

const SUBMIT_SAMPLE = `curl -X POST https://app.mycargolens.com/api/public/v1/shipments/{id}/submit \\
  -H "Authorization: Bearer mcl_live_…"`;

const WEBHOOK_SAMPLE = `POST /your/webhook HTTP/1.1
X-MCL-Event: filing.accepted
X-MCL-Signature: sha256=<hex>

{ "event": "filing.accepted", "createdAt": "…", "data": { … } }`;

const EVENTS = [
  "filing.submitted",
  "filing.accepted",
  "filing.rejected",
  "entry.sent",
  "entry.accepted",
  "entry.rejected",
];

const SCOPES = ["filings:read", "filings:write", "entries:read", "entries:write"];

const FAQ = [
  {
    q: "How do we get an API key?",
    a: "Our team sets up your account after a walkthrough. Then you create keys in the app under Settings → API.",
  },
  {
    q: "Is there an SDK?",
    a: "Not yet. The API is REST over HTTPS with JSON or XML, so any HTTP client works.",
  },
  {
    q: "How do we verify a webhook?",
    a: "Recompute the HMAC-SHA256 of the raw request body with your endpoint's signing secret and compare it to X-MCL-Signature in constant time.",
  },
  {
    q: "Can the API submit filings that fail the checks?",
    a: "No. The same rule checks run on API submissions as in the app.",
  },
  {
    q: "Do we need to poll for CBP status?",
    a: "No. Register a webhook and status changes come to you. You can still read any filing with GET.",
  },
  {
    q: "Who sends filings to CBP?",
    a: "MyCargoLens does. Your system creates and submits them through the API, and each request and response is kept on the filing.",
  },
  {
    q: "What does the API cost?",
    a: "API and volume pricing is on request. You're charged when CBP accepts, as in the app.",
  },
];

/** Inline monospace token (paths, headers, scopes, events). */
function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-[hsl(var(--tone-fg)/0.07)] px-1.5 py-0.5 font-mono text-[0.86em] text-tone-fg">
      {children}
    </code>
  );
}

export default function ApiPage() {
  return (
    <>
      <JsonLd data={webPage({ path: PATH, name: TITLE, description: DESCRIPTION, aboutSoftware: true })} />

      {/* S1 Hero */}
      <PageHero
        breadcrumbPath={PATH}
        accent="api"
        eyebrow="API and webhooks"
        title="An ISF API your TMS can file through"
        sub="Create and submit ISFs and entries from your own system. REST in, with JSON or XML. Signed webhooks out when CBP answers."
        actions={
          <>
            <DemoButton cta="apiWalkthrough" persona="developer" location="hero" src={SRC} size="lg" />
            <Button asChild variant="outline" size="lg" className="bg-[hsl(var(--surface))]">
              <Link href={VOLUME} data-cta-id="see_pricing" data-location="hero">
                Talk to us about volume and API pricing
              </Link>
            </Button>
          </>
        }
        scene="api"
      />

      {/* S2 What the API does */}
      <Section tone="cream" id="endpoints" accent="api">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="min-w-0">
            <SectionHeading
              eyebrow="Endpoints"
              title="ISF and entry, read and write"
              intro={
                <>
                  The public API lives at <C>/api/public/v1</C>. It runs under your organization and your plan, so it
                  can do what your account can do in the app, no more.
                </>
              }
            />
            <p className="mt-4 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
              API submissions go through the same rule checks as the app, and each CBP request and response is logged
              on the filing.
            </p>
          </div>
          <div className="min-w-0">
            <EndpointTable />
          </div>
        </div>
      </Section>

      {/* S3 Formats and webhooks (ink code band) */}
      <Section tone="ink" id="webhooks" accent="api">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <SectionHeading eyebrow="In and out" title="REST or XML in. Signed webhooks out." />
            <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">
              <p>
                JSON is the default. Send XML with <C>Content-Type: application/xml</C> and ask for XML back with{" "}
                <C>Accept: application/xml</C>. Customs identifiers stay strings, so leading zeros survive.
              </p>
              <p>
                Register a callback URL and we POST status changes to it:{" "}
                {EVENTS.map((e, i) => (
                  <span key={e}>
                    <C>{e}</C>
                    {i < EVENTS.length - 1 ? ", " : ""}
                  </span>
                ))}
                . Each delivery carries an <C>X-MCL-Signature</C> header, an HMAC-SHA256 of the raw body with your
                endpoint&apos;s signing secret. Failed deliveries are retried, and the last outcome shows on the
                endpoint.
              </p>
            </div>
          </div>
          <div className="min-w-0 space-y-5">
            <CodePanel title="Submit an ISF" lang="bash" code={SUBMIT_SAMPLE} />
            <CodePanel title="Webhook received" lang="http" code={WEBHOOK_SAMPLE} />
          </div>
        </div>
      </Section>

      {/* S4 Keys and access */}
      <Section tone="paper" id="keys" accent="api">
        <FeatureSplit
          reverse
          eyebrow="Security"
          title="Scoped keys you can revoke"
          body={
            <>
              <p>
                Keys come with your account and are created in the app under Settings → API. Give each key only the
                scopes it needs:{" "}
                {SCOPES.map((s, i) => (
                  <span key={s}>
                    <C>{s}</C>
                    {i < SCOPES.length - 1 ? ", " : ""}
                  </span>
                ))}
                . Revoke any key at any time.
              </p>
              <p>The same roles, MFA and audit trail protect the app.</p>
            </>
          }
          actions={<InlineLink href={ROUTES.security.href}>How we handle security</InlineLink>}
          media={<KeyList />}
        />
      </Section>

      {/* S5 Start without IT */}
      <Section tone="mint" id="start-in-the-app" accent="api">
        <SectionHeading
          eyebrow="No integration yet?"
          title="Start in the app, add the API when you're ready"
          intro="You don't have to wait for IT. File in the app with templates and bulk submit, then move your highest-volume lane to the API. The filings, checks and history are the same either way."
        />
        <CardGrid
          className="mt-10"
          columns={2}
          items={[
            {
              title: "ISF filing in the app",
              body: ROUTES.isfFiling.blurb,
              href: ROUTES.isfFiling.href,
              module: "isf",
              linkLabel: ROUTES.isfFiling.label,
            },
            {
              title: "Customs entry in the app",
              body: ROUTES.customsEntry.blurb,
              href: ROUTES.customsEntry.href,
              module: "entry",
              linkLabel: ROUTES.customsEntry.label,
            },
          ]}
        />
      </Section>

      {/* S6 What we'll say plainly */}
      <Section tone="lilac" id="today" accent="api">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-3">Where it stands</Eyebrow>
            <h2 className="text-[28px] font-semibold leading-[1.12] tracking-[-0.028em] text-tone-fg sm:text-[34px] md:text-[38px]">
              What you get today
            </h2>
          </div>
          <ul className="divide-y divide-[hsl(var(--surface-border))] border-y border-[hsl(var(--surface-border))] text-[16px] leading-relaxed text-tone-fg sm:text-[17px]">
            <li className="py-4">
              Version <C>1.0.0-foundation</C>.
            </li>
            <li className="py-4">No SDKs yet. It&apos;s plain HTTP, so any language works.</li>
            <li className="py-4">The full OpenAPI reference is shared after your walkthrough.</li>
            <li className="py-4">
              API pricing on request, same rule as the app: charged when CBP accepts.{" "}
              <Link
                href={VOLUME}
                className="font-semibold text-a-ink underline decoration-current/30 underline-offset-4 hover:decoration-current"
              >
                Volume and API pricing
              </Link>
            </li>
          </ul>
        </div>
      </Section>

      {/* S7 FAQ */}
      <Section tone="mesh" id="faq" width="narrow" accent="api">
        <SectionHeading title="Questions developers ask" />
        <Faq className="mt-8" items={FAQ} />
      </Section>

      {/* S8 Final CTA band */}
      <CtaBand
        title="Bring your developer and your ops lead"
        sub="Book a 20-minute API walkthrough. We'll show a filing created, submitted and answered over the API, and the webhook landing on the other side."
        cta="apiWalkthrough"
        persona="developer"
        src={SRC}
        links={[{ label: "Volume and API pricing", href: VOLUME, id: "see_pricing" }]}
      />
    </>
  );
}
