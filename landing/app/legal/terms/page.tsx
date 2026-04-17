import type { Metadata } from "next";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Terms of Service — MyCargoLens",
  description:
    "Terms and conditions governing your use of the MyCargoLens CBP compliance platform.",
};

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-amber-800 dark:text-amber-200 not-italic">
      {children}
    </mark>
  );
}

export default function TermsOfServicePage() {
  return (
    <Container className="max-w-3xl py-20 md:py-28">
      {/* Page header */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Legal
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Last updated: April 2026</span>
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-700">
            DRAFT — subject to legal review
          </span>
        </div>
      </div>

      {/* Prose content */}
      <div className="text-base leading-relaxed text-foreground/85">

        <h2 className="text-xl font-semibold mt-10 mb-4">1. Acceptance of Terms</h2>
        <p className="mb-4">
          By accessing or using MyCargoLens, you agree to be bound by these Terms of Service and
          our Privacy Policy. If you do not agree to these terms, you may not use the platform.
          These terms constitute a legally binding agreement between you and{" "}
          <Placeholder>[COMPANY_NAME]</Placeholder>.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">2. Description of Service</h2>
        <p className="mb-4">
          MyCargoLens is a customs compliance platform that enables users to create, validate, and
          submit Importer Security Filings (ISF) and other CBP filings. The platform provides
          validation tools, filing management, and status tracking for import compliance workflows.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">3. Account Registration</h2>
        <p className="mb-4">
          You must provide accurate, complete, and current information when registering an account.
          You are responsible for maintaining the confidentiality of your account credentials and
          for all activity that occurs under your account. Notify us immediately of any unauthorized
          access at <Placeholder>[SUPPORT_EMAIL]</Placeholder>.
        </p>
        <p className="mb-4">
          You may not share your account credentials or allow others to access the platform using
          your account, except as permitted by your subscription plan.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">4. Subscription &amp; Billing</h2>
        <p className="mb-4">
          Subscription plans are billed monthly or annually via Stripe. Current pricing is
          available at{" "}
          <a
            href="/pricing"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            mycargolens.com/pricing
          </a>
          . You may cancel your subscription at any time; access to the platform continues until
          the end of the current billing period. Refunds are not provided for partial billing
          periods unless required by applicable law.
        </p>
        <p className="mb-4">
          We reserve the right to update pricing with 30 days&apos; notice. Continued use after a
          price change constitutes acceptance of the new pricing.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">5. Filing Accuracy</h2>
        <p className="mb-4">
          You are solely responsible for the accuracy, completeness, and timeliness of all data
          submitted in your customs filings. MyCargoLens provides validation tools to assist with
          compliance, but does not guarantee CBP acceptance of any filing. Penalties, fines, or
          delays resulting from inaccurate or late filings remain your sole responsibility.
        </p>
        <p className="mb-4">
          We are not a licensed customs broker and do not provide legal or regulatory advice. You
          should consult a licensed customs broker or attorney for compliance guidance.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">6. Acceptable Use</h2>
        <p className="mb-4">You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1.5 mb-4">
          <li>Use the platform for any illegal activity or in violation of applicable law.</li>
          <li>Submit false, misleading, or fraudulent filing data.</li>
          <li>Reverse engineer, decompile, or attempt to extract the source code of the platform.</li>
          <li>Conduct automated scraping, crawling, or bulk data extraction without written permission.</li>
          <li>Interfere with or disrupt the integrity or performance of the platform.</li>
          <li>Attempt to gain unauthorized access to any portion of the platform or its systems.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-4">7. Intellectual Property</h2>
        <p className="mb-4">
          All platform software, design, trademarks, and content are the intellectual property of{" "}
          <Placeholder>[COMPANY_NAME]</Placeholder> and are protected by applicable intellectual
          property laws. No license to our intellectual property is granted except as necessary to
          use the platform as described in these terms.
        </p>
        <p className="mb-4">
          Your filing data belongs to you. We claim no ownership over the customs data you submit
          through the platform.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">8. Limitation of Liability</h2>
        <p className="mb-4">
          The platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
          express or implied, including but not limited to warranties of merchantability, fitness
          for a particular purpose, or non-infringement.
        </p>
        <p className="mb-4">
          To the maximum extent permitted by law, <Placeholder>[COMPANY_NAME]</Placeholder>{" "}
          shall not be liable for any indirect, incidental, special, consequential, or punitive
          damages. Our total liability to you for any claim arising from use of the platform shall
          not exceed the fees paid by you to us in the twelve (12) months preceding the claim.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">9. Indemnification</h2>
        <p className="mb-4">
          You agree to indemnify, defend, and hold harmless{" "}
          <Placeholder>[COMPANY_NAME]</Placeholder> and its officers, directors, employees, and
          agents from and against any claims, liabilities, damages, losses, and expenses (including
          reasonable attorneys&apos; fees) arising out of or related to your use of the platform, your
          filings, or your violation of these terms.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">10. Termination</h2>
        <p className="mb-4">
          Either party may terminate these terms at any time. Upon termination, your access to the
          platform will cease at the end of your current billing period. You may export your filing
          data within 30 days of termination, after which it may be deleted in accordance with our
          data retention policy.
        </p>
        <p className="mb-4">
          We reserve the right to suspend or terminate accounts that violate these terms immediately
          and without notice.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">11. Governing Law</h2>
        <p className="mb-4">
          These terms are governed by the laws of <Placeholder>[JURISDICTION]</Placeholder>,
          without regard to conflict of law principles. Any disputes arising from these terms shall
          be resolved exclusively in the courts of{" "}
          <Placeholder>[JURISDICTION]</Placeholder>.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">12. Changes to Terms</h2>
        <p className="mb-4">
          We may modify these Terms of Service with 30 days&apos; notice via email to your registered
          address. Continued use of the platform after the notice period constitutes acceptance of
          the updated terms. If you do not agree, you may cancel your account before the changes
          take effect.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-4">13. Contact Us</h2>
        <p className="mb-4">
          For questions about these Terms of Service, please contact:
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
