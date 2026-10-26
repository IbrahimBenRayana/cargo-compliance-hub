import type { MetadataRoute } from "next";
import { INDEXABLE_ROUTES, SITE_URL, authorHref } from "@/lib/site";
import { articleHref, publishedArticles } from "@/app/resources/_content/articles";
import { AUTHORS } from "@/app/resources/_content/authors";

/**
 * /sitemap.xml (site-architecture §5.5). Generated from the route registry
 * (live, indexable routes only: no /book-a-demo/thanks, no P1 pages) plus the
 * published articles and their authors from app/resources/_content. Held-back
 * articles and authors without a published article stay out (they're noindex).
 */

/** Date the rebuilt pages went up; bump a route's date when its copy changes. */
const SITE_UPDATED = "2026-10-26";

const url = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = publishedArticles();
  const authors = AUTHORS.filter((a) => articles.some((x) => x.authorSlug === a.slug));

  return [
    ...INDEXABLE_ROUTES.map((r) => ({ url: url(r.href), lastModified: SITE_UPDATED })),
    ...articles.map((a) => ({ url: url(articleHref(a.slug)), lastModified: a.dateReviewed })),
    ...authors.map((a) => ({
      url: url(authorHref(a.slug)),
      lastModified: articles.filter((x) => x.authorSlug === a.slug).map((x) => x.dateReviewed).sort().at(-1),
    })),
  ];
}
