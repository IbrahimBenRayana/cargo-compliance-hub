import type { MetadataRoute } from "next";
import { INDEXABLE_ROUTES, SITE_URL } from "@/lib/site";
import { articleHref, publishedArticles } from "@/app/resources/_content/articles";

/**
 * /sitemap.xml (site-architecture §5.5). Generated from the route registry
 * (live, indexable routes only: no /book-a-demo/thanks, no P1 pages) plus the
 * published articles from app/resources/_content. Held-back articles stay out
 * (they're noindex).
 */

/** Date the rebuilt pages went up; bump a route's date when its copy changes. */
const SITE_UPDATED = "2026-10-26";

const url = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = publishedArticles();

  return [
    ...INDEXABLE_ROUTES.map((r) => ({ url: url(r.href), lastModified: SITE_UPDATED })),
    ...articles.map((a) => ({ url: url(articleHref(a.slug)), lastModified: a.dateReviewed })),
  ];
}
