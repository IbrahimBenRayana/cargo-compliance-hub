import type { MetadataRoute } from "next";
import { INDEXABLE_ROUTES, ROUTES, SITE_URL, type RouteKey } from "@/lib/site";
import { CHANGELOG_ENTRIES } from "@/lib/changelog";
import { articleHref, publishedArticles } from "@/app/resources/_content/articles";

/**
 * /sitemap.xml (site-architecture §5.5). Generated from the route registry
 * (live, indexable routes only: no /book-a-demo/thanks, no P1 pages) plus the
 * published articles from app/resources/_content. Held-back articles stay out
 * (they're noindex).
 */

/** Day the rebuilt site went up. Used for a route with no line in ROUTE_UPDATED. */
const SITE_REBUILT = "2026-10-26";

/**
 * Day each page's copy last changed on production. When a PR changes a page's
 * copy, set that page's line to the PR's date. A visual-only change (hero,
 * spacing) doesn't count. /changelog is not listed: its date is the newest
 * entry in lib/changelog.ts.
 */
const ROUTE_UPDATED: Partial<Record<RouteKey, string>> = {
  home: "2026-11-18",
  platform: "2026-11-25",
  isfFiling: "2026-11-18",
  customsEntry: "2026-11-25",
  api: "2026-10-26",
  inbox: "2026-11-25",
  preFilingChecks: "2026-10-26",
  compliance: "2026-10-28",
  solutions: "2026-10-28",
  nvoccForwarders: "2026-10-28",
  importers: "2026-11-25",
  compare: "2026-10-28",
  pricing: "2026-11-25",
  about: "2026-10-28",
  security: "2026-11-25",
  contact: "2026-10-26",
  bookADemo: "2026-10-28",
  privacy: "2026-10-26",
  terms: "2026-10-26",
};

const updatedByHref = new Map<string, string>([
  ...(Object.entries(ROUTE_UPDATED) as [RouteKey, string][]).map(
    ([key, date]): [string, string] => [ROUTES[key].href, date],
  ),
  // CHANGELOG_ENTRIES is sorted newest first.
  [ROUTES.changelog.href, CHANGELOG_ENTRIES[0]?.date ?? SITE_REBUILT],
]);

const url = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = publishedArticles();

  return [
    ...INDEXABLE_ROUTES.map((r) => ({
      url: url(r.href),
      lastModified: updatedByHref.get(r.href) ?? SITE_REBUILT,
    })),
    ...articles.map((a) => ({ url: url(articleHref(a.slug)), lastModified: a.dateReviewed })),
  ];
}
