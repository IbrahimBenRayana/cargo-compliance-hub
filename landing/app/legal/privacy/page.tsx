import type { Metadata } from "next";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Privacy Policy — MyCargoLens",
  description:
    "How MyCargoLens collects, uses, and protects your personal information.",
};

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-amber-800 dark:text-amber-200 not-italic">
      {children}
    </mark>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <Container className="max-w-3xl py-20 md:py-28">
      {/* Page header */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Legal
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Last updated: April 2026</span>
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-700">
            DRAFT — subject to legal review
          </span>
        </div>
      </div>

      {/* Prose content */}
      <div className="text-base leading-relaxed text-foreground/85">

        <h2 className="text-xl font-semibold mt-10 mb-4">1. Introduction</h2>
        <p className="mb-4">
          <Placeholder>[COMPANY_NAME]</Placeholder> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the MyCargoLens
          platform at mycargolens.com. This policy describes how we collect, use, and protect your
          personal information.
        </p>
        <p className="mb-4">
          By using MyCargoLens, you agree to the collection and use of information in accordance with
          this policy. If you do not agree, please discontinue use of the platform.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">2. Information We Collect</h2>
        <p className="mb-4">We collect the following categories of information:</p>
        <ul className="list-disc pl-5 space-y-1.5 mb-4">
          <li>
            <strong>Account information</strong> — your name, email address, and company name
            provided at registration.
          </li>
          <li>
            <strong>Filing data</strong> — ISF data, Bill of Lading (BOL) numbers, and other
            customs information submitted voluntarily for CBP compliance purposes.
          </li>
          <li>
            <strong>Usage data</strong> — analytics, device information, browser type, IP address,
            and pages visited, collected automatically to improve the platform.
          </li>
          <li>
            <strong>Payment information</strong> — billing details are processed by Stripe; we do
            not store card numbers or full payment credentials on our servers.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-4">3. How We Use Your Information</h2>
        <p className="mb-4">We use collected information to:</p>
        <ul className="list-disc pl-5 space-y-1.5 mb-4">
          <li>Provide, operate, and maintain the MyCargoLens platform.</li>
          <li>Process and transmit ISF and other filings to CBP on your behalf.</li>
          <li>Send transactional and account-related emails.</li>
          <li>Improve platform features and user experience.</li>
          <li>Comply with applicable legal obligations, including CBP recordkeeping requirements.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-4">4. Data Sharing</h2>
        <p className="mb-4">
          We share data only with:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mb-4">
          <li>
            <strong>(a)</strong> CBP / U.S. Customs via our certified API partner CustomsCity, as
            required for ISF filings and regulatory compliance.
          </li>
          <li>
            <strong>(b)</strong> Stripe for payment processing, subject to{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Stripe&apos;s Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>(c)</strong> Third parties as required by law, legal process, or government
            request.
          </li>
        </ul>
        <p className="mb-4">
          We do not sell or rent your personal information to third parties.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">5. Data Retention</h2>
        <p className="mb-4">
          Filing data is retained for{" "}
          <Placeholder>[RETENTION_PERIOD]</Placeholder> after your account is closed, per CBP
          recordkeeping requirements (19 CFR 163). Account information is deleted upon written
          request except where retention is required by law.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">6. Security</h2>
        <p className="mb-4">
          All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We maintain access
          controls, audit logging, and conduct regular security reviews. While we implement
          industry-standard safeguards, no system is completely secure and we cannot guarantee
          absolute security.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">7. Your Rights</h2>
        <p className="mb-4">
          You may request access to, correction of, or deletion of your personal data by emailing{" "}
          <Placeholder>[SUPPORT_EMAIL]</Placeholder>. We will respond within 30 days. California
          residents: see the CCPA section below.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">8. CCPA Notice (California Residents)</h2>
        <p className="mb-4">
          California residents have additional rights under the California Consumer Privacy Act
          (CCPA), including the right to know what personal information we collect, the right to
          delete personal information, and the right to opt out of the sale of personal information
          (we do not sell personal information).
        </p>
        <p className="mb-4">
          <Placeholder>[ADDITIONAL_CCPA_DETAILS — add categories of PI collected, sources, business purposes, and third-party disclosures per CCPA 1798.100 et seq.]</Placeholder>
        </p>
        <p className="mb-4">
          To exercise your CCPA rights, contact us at{" "}
          <Placeholder>[SUPPORT_EMAIL]</Placeholder>.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">9. Cookies</h2>
        <p className="mb-4">
          We use essential cookies only — for session management and user preferences. We do not use
          third-party tracking cookies or advertising cookies. You may disable cookies in your
          browser settings, though some platform features may not function correctly.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">10. Changes to This Policy</h2>
        <p className="mb-4">
          We may update this Privacy Policy from time to time. Material changes will be communicated
          via email to registered users at least 30 days before taking effect. Continued use of the
          platform after that date constitutes acceptance of the updated policy.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">11. Contact Us</h2>
        <p className="mb-4">
          If you have questions about this Privacy Policy, please contact:
        </p>
        <p className="mb-4">
          <Placeholder>[COMPANY_NAME]</Placeholder>
          <br />
          <Placeholder>[ADDRESS]</Placeholder>
          <br />
          Email: <Placeholder>[SUPPORT_EMAIL]</Placeholder>
        </p>

      </div>
    </Container>
  );
}
