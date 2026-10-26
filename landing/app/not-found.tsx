import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { CardGrid } from "@/components/site/blocks";
import { DemoButton } from "@/components/site/cta";
import { APP_LOGIN_URL, ROUTES } from "@/lib/site";

// Next adds <meta name="robots" content="noindex"> to 404 responses itself.
export const metadata: Metadata = {
  title: "Page not found",
  description:
    "This page doesn't exist or has moved. Find ISF and entry filing software, pricing and guides from MyCargoLens.",
  robots: { index: false, follow: true },
};

const CARDS = [
  { title: "The product", body: "ISF and entry filing, the inbox and pre-filing checks.", href: ROUTES.platform.href, linkLabel: "See the platform" },
  {
    title: "Pricing",
    body: "$45, $180 or $280 per shipment, charged when CBP accepts. Volume pricing on request.",
    href: ROUTES.pricing.href,
    linkLabel: "See pricing",
  },
  { title: "Guides", body: "ISF deadlines, penalties and entry how-tos.", href: ROUTES.resources.href, linkLabel: "Read the guides" },
  { title: "Log in", body: "Already a customer? Go to the app.", href: APP_LOGIN_URL, linkLabel: "Log in" },
];

/** 404 (copy/not-found.md, wireframe 16): banner hero, no breadcrumbs, no pre-footer band. */
export default function NotFound() {
  return (
    <PageHero
      size="banner"
      eyebrow={<span className="font-mono text-[15px] tracking-[0.3em] text-tone-muted">404</span>}
      title="We couldn't find that page."
      sub="It may have moved when we rebuilt the site. These are the pages most people are looking for."
      scene="not-found"
    >
      <div className="mx-auto max-w-[720px] text-left">
        <CardGrid columns={2} items={CARDS} />
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <DemoButton location="section" src="404" size="lg" />
          <p className="text-[14px] text-tone-muted">
            Followed a broken link from our site? Tell us at{" "}
            <a
              href="mailto:support@mycargolens.com"
              className="font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
            >
              support@mycargolens.com
            </a>{" "}
            and we&apos;ll fix it.
          </p>
        </div>
      </div>
    </PageHero>
  );
}
