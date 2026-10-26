import {
  BROKER_PILOT_LINE,
  CERT_BADGE,
  COMPANY,
  CTA,
  ROUTES,
  SITE_URL,
  UI_STRINGS,
  ctaHref,
  menuItems,
  platformColumn,
  type SiteRoute,
} from "@/lib/site";
import { articleHref, publishedArticles } from "@/app/resources/_content/articles";

/**
 * /llms.txt (site-architecture §5.5; llmstxt.org format). Generated from the
 * route registry in lib/site.ts so it never drifts from the nav. Only live
 * routes and published articles are listed.
 */
export const dynamic = "force-static";

/** Bible v3 one-liner (product-marketing.md §5): the only one. */
const ONE_LINER =
  "MyCargoLens is ISF and customs entry software that shows which filing needs you now, checks it before CBP does, and puts the price per shipment on the website.";

const url = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;
const item = (r: Pick<SiteRoute, "label" | "href" | "blurb">) =>
  `- [${r.label}](${url(r.href)})${r.blurb ? `: ${r.blurb}` : ""}`;

function body(): string {
  const modules = [...platformColumn("file"), ...platformColumn("stay-ahead")];
  const articles = publishedArticles();
  const lines: string[] = [
    `# ${COMPANY.name}`,
    "",
    `> ${ONE_LINER}`,
    "",
    `${COMPANY.brandLine} ${CERT_BADGE.label}. ${CERT_BADGE.line}`,
    "",
    "Who it's for: importers of record who file their own ISF and entries, and NVOCCs and freight forwarders filing ISFs at volume.",
    `${BROKER_PILOT_LINE.label}`,
    "",
    `What it isn't: ${COMPANY.disclosure} In-bond (7512), FTZ, drawback and AES are not available.`,
    "",
    "## Platform",
    item(ROUTES.platform),
    ...modules.map(item),
    "",
    "## Solutions",
    ...menuItems("solutions").map(item),
    "",
    "## Pricing",
    `- [Pricing](${url(ROUTES.pricing.href)}): $45 ISF, $180 ISF + Entry, $280 Complete, per shipment, charged only when CBP accepts. No monthly fee. Volume pricing on request.`,
    `- [Pricing in Markdown](${url("/pricing.md")}): the same plans and billing rules as plain text.`,
    "",
    "## Trust",
    item(ROUTES.security),
    "",
    ...(ROUTES.resources.noindex
      ? []
      : [
          "## Resources",
          item(ROUTES.resources),
          ...articles.map((a) => `- [${a.shortTitle}](${url(articleHref(a.slug))}): ${a.dek}`),
          "",
        ]),
    "## Optional",
    item(ROUTES.about),
    item(ROUTES.changelog),
    item(ROUTES.contact),
    `- [${CTA.bookDemo.label}](${url(ctaHref({ src: "llms" }))}): ${UI_STRINGS.demoMicrocopy}`,
    "",
  ];
  return lines.join("\n");
}

export function GET() {
  return new Response(body(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
