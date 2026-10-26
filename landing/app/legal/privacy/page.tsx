import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/site/section";
import { ROUTES } from "@/lib/site";

export const metadata: Metadata = {
  // Plain title: the root layout's title.template appends " | MyCargoLens".
  title: "Privacy Policy",
  description:
    "How MyCargoLens collects, uses, and protects your personal information.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        size="compact"
        breadcrumbPath={ROUTES.privacy.href}
        eyebrow="Legal"
        title="Privacy Policy"
        sub="Last updated: May 2026"
      />
      <Section tone="paper" width="narrow">
      <div className="text-base leading-relaxed text-tone-fg [&_h2]:text-tone-fg [&_a:hover]:text-tone-fg">

        <h2 className="text-xl font-semibold mt-10 mb-4">1. Introduction</h2>
        <p className="mb-4">
          Mycargolens (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the MyCargoLens
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
            <strong>Payment information</strong> — billing details for per-shipment charges are
            processed by Stripe; we do not store card numbers or full payment credentials on our servers.
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
            <strong>(a)</strong> CBP / U.S. Customs, over our direct CBP ABI connection, as
            required for ISF filings and regulatory compliance.
          </li>
          <li>
            <strong>(b)</strong> Stripe for payment processing, subject to{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-tone-fg transition-colors"
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
          Filing data is retained for 5 years after your account is closed, per CBP recordkeeping
          requirements (19 CFR 163). Account information is deleted upon written request except
          where retention is required by law.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">6. Security</h2>
        <p className="mb-4">
          All data is encrypted in transit with TLS. Sensitive secrets, such as MFA keys, are
          stored encrypted. We maintain role-based access controls and audit logging, and back
          up customer data regularly. While we implement
          industry-standard safeguards, no system is completely secure and we cannot guarantee
          absolute security.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">7. Your Rights</h2>
        <p className="mb-4">
          You may request access to, correction of, or deletion of your personal data by emailing{" "}
          <a
            href="mailto:support@mycargolens.com"
            className="underline underline-offset-2 hover:text-tone-fg transition-colors"
          >
            support@mycargolens.com
          </a>
          . We will respond within 30 days. California residents: see the CCPA section below.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">8. CCPA Notice (California Residents)</h2>
        <p className="mb-4">
          California residents have additional rights under the California Consumer Privacy Act
          (CCPA), including the right to know what personal information we collect, the right to
          delete personal information, and the right to opt out of the sale of personal information
          (we do not sell personal information).
        </p>
        <p className="mb-4">
          To exercise your CCPA rights, contact us at{" "}
          <a
            href="mailto:support@mycargolens.com"
            className="underline underline-offset-2 hover:text-tone-fg transition-colors"
          >
            support@mycargolens.com
          </a>
          .
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
          Mycargolens
          <br />
          Email:{" "}
          <a
            href="mailto:support@mycargolens.com"
            className="underline underline-offset-2 hover:text-tone-fg transition-colors"
          >
            support@mycargolens.com
          </a>
        </p>

      </div>
      </Section>
    </>
  );
}
