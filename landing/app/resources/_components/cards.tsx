import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentClass } from "@/lib/accents";
import { articleHref, formatDate } from "../_content/articles";
import { TOPICS } from "../_content/topics";
import type { Article } from "../_content/types";

/** Byline. Articles are written by the company, never a named person. */
export const BYLINE = "The MyCargoLens team";

/** Brand mark tile next to the byline (decorative). */
export function BylineMark({ size = 40 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo-mark-square.svg" alt="" aria-hidden width={size} height={size} className="shrink-0 rounded-[10px]" />
  );
}

/** "The MyCargoLens team · Oct 23, 2026 · 8 min read" */
export function MetaLine({ article, className }: { article: Article; className?: string }) {
  const date = article.datePublished ?? article.dateReviewed;
  return (
    <p className={cn("text-[14px] text-tone-muted", className)}>
      <span className="font-medium text-tone-fg">{BYLINE}</span>
      <span aria-hidden> · </span>
      <time dateTime={date}>{formatDate(date)}</time>
      <span aria-hidden> · </span>
      {article.readingMinutes} min read
    </p>
  );
}

export function TopicChip({ article, className }: { article: Article; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-a-soft px-2.5 py-0.5 text-[12px] font-semibold text-a-ink ring-1 ring-[hsl(var(--a)/0.25)]",
        accentClass(TOPICS[article.topic].accent),
        className,
      )}
    >
      {TOPICS[article.topic].label}
    </span>
  );
}

/** Large "Latest" card (hub S2). */
export function FeaturedCard({ article }: { article: Article }) {
  return (
    <article className="group relative grid overflow-hidden rounded-[24px] site-surface md:grid-cols-[1fr_1.4fr]">
      {/* Typographic cover (IL-03): text only, no stock photo */}
      <div
        aria-hidden
        className={cn("flex min-h-[160px] flex-col justify-between bg-a-soft p-6 md:min-h-[260px] md:p-8", accentClass(TOPICS[article.topic].accent))}
      >
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-a-ink">
          {TOPICS[article.topic].label} · {article.kind}
        </span>
        <span className="text-[34px] font-semibold leading-[1.02] tracking-[-0.035em] text-a-ink sm:text-[44px]">
          {article.shortTitle}
        </span>
      </div>
      <div className="flex flex-col p-6 md:p-8">
        <TopicChip article={article} className="self-start" />
        <h3 className="mt-4 text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-tone-fg sm:text-[26px]">
          <Link href={articleHref(article.slug)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {article.title}
          </Link>
        </h3>
        <p className="mt-3 text-[16px] leading-relaxed text-tone-muted">{article.dek}</p>
        <MetaLine article={article} className="mt-5" />
        <span className="mt-auto inline-flex items-center gap-1 pt-6 text-[15px] font-semibold text-tone-fg">
          Read the guide
          <ArrowRight aria-hidden className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5" />
        </span>
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[24px] ring-2 ring-transparent transition-[box-shadow] group-has-[:focus-visible]:ring-ring" />
    </article>
  );
}

/** List card (hub S3): title, dek, topic chip, byline/date. */
export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="group relative flex h-full flex-col rounded-[20px] p-6 site-surface transition-transform duration-200 ease-[var(--ease-out-quart)] [@media(hover:hover)]:hover:-translate-y-px">
      <TopicChip article={article} className="self-start" />
      <h3 className="mt-3 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-tone-fg">
        <Link href={articleHref(article.slug)} className="after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">
          {article.title}
        </Link>
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-tone-muted">{article.dek}</p>
      <MetaLine article={article} className="mt-auto pt-5" />
    </article>
  );
}
