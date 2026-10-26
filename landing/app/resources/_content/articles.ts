import { RESOURCES_PUBLISHED } from "@/lib/site";
import { isfLateFilingPenalties } from "./isf-late-filing-penalties";
import type { Article } from "./types";

/**
 * Every article with a route. Add new ones here (typed TSX, no MDX).
 * Only `status: "published"` articles are listed (hub, llms.txt)
 * and indexable; the rest render at their URL with noindex.
 */
export const ARTICLES: Article[] = [isfLateFilingPenalties];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

const sortKey = (a: Article) => a.datePublished ?? a.dateReviewed;

/** Published articles, newest first. Empty while the Resources hub is hidden (RESOURCES_PUBLISHED). */
export function publishedArticles(): Article[] {
  if (!RESOURCES_PUBLISHED) return [];
  return ARTICLES.filter((a) => a.status === "published").sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}

/** True when an article may be linked and indexed. Gate every in-page link on this, not on route `live`. */
export function isArticleLive(slug: string): boolean {
  return publishedArticles().some((a) => a.slug === slug);
}

export function articleHref(slug: string): string {
  return `/resources/${slug}`;
}

/** "2026-10-23" → "Oct 23, 2026" (UTC, so server and client agree). */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
