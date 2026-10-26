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

/** Published articles, newest first. */
export function publishedArticles(): Article[] {
  return ARTICLES.filter((a) => a.status === "published").sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
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
