import type * as React from "react";
import type { FaqItem } from "@/components/site/faq";
import type { ModuleKey } from "@/lib/accents";

/** Topic keys (site-architecture §6.1): one per content pillar. */
export type TopicKey = "isf" | "entry" | "tariffs" | "cost" | "api";

export type Topic = {
  key: TopicKey;
  label: string;
  /** One-line description (copy/resources.md S3). */
  description: string;
  /** Module accent used for the topic chip. */
  accent: ModuleKey;
};

export type Author = {
  /** URL slug: first-last, lowercase. */
  slug: string;
  name: string;
  firstName: string;
  /** Role line (S1). Only confirmed facts. */
  role: string;
  /** schema.org jobTitle. */
  jobTitle: string;
  /** Short bio paragraphs: verified facts only (copy/resources-author.md S2 rules). */
  bio: string[];
  /** Real headshot path, or null (no stock photos, no illustrated avatars: initials tile instead). */
  photo: string | null;
  /** LinkedIn profile URL, or null until supplied. */
  linkedInUrl: string | null;
};

export type Source = { label: string; href: string };

export type TocItem = { id: string; label: string };

export type ArticleStatus =
  /** Live: listed on the hub, author page, llms.txt and indexable. */
  | "published"
  /**
   * Route exists but the article is held back: noindex, not listed anywhere.
   * article-01 is here until a licensed customs broker or customs attorney
   * has read it (article-01 claims_to_confirm; site-architecture §6.1).
   */
  | "awaiting-review";

export type Article = {
  slug: string;
  status: ArticleStatus;
  topic: TopicKey;
  /** Small label on the card and above the H1, e.g. "Guide". */
  kind: string;
  /** H1 and schema headline. */
  title: string;
  /** Short card label / breadcrumb leaf. */
  shortTitle: string;
  /** Meta title without the brand (layout template adds "| MyCargoLens"). */
  metaTitle: string;
  metaDescription: string;
  /** Card dek (hub, author page). */
  dek: string;
  authorSlug: string;
  /** ISO date. Null until the article is actually published. */
  datePublished: string | null;
  /** ISO date of the last check against primary sources. */
  dateReviewed: string;
  readingMinutes: number;
  toc: TocItem[];
  faq: FaqItem[];
  sources: Source[];
  /** Related article slugs (only published ones render). */
  related: string[];
  Body: () => React.ReactNode;
};
