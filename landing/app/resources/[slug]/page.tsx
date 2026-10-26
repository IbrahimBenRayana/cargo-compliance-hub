import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/site/section";
import { Faq } from "@/components/site/faq";
import { CtaBand } from "@/components/site/cta-band";
import { DemoButton } from "@/components/site/cta";
import { JsonLd } from "@/components/site/json-ld";
import { COMPANY } from "@/lib/site";
import { SOFTWARE_ID, article as articleNode, graph } from "@/lib/schema";
import { ARTICLES, articleHref, formatDate, getArticle, isArticleLive } from "../_content/articles";
import { TOPICS } from "../_content/topics";
import { Prose } from "../_components/prose";
import { ArticleCard, BYLINE, BylineMark } from "../_components/cards";

/** Article template (site-architecture §6.1, wireframe 10). Content lives in ../_content. */
export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/resources/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  const path = articleHref(a.slug);
  return {
    title: a.metaTitle,
    description: a.metaDescription,
    alternates: { canonical: path },
    // Held back until the broker/attorney review is done: not indexed, not listed.
    ...(!isArticleLive(a.slug) ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "article",
      title: `${a.metaTitle} | MyCargoLens`,
      description: a.metaDescription,
      url: path,
      ...(a.datePublished ? { publishedTime: a.datePublished } : {}),
      modifiedTime: a.dateReviewed,
      authors: [COMPANY.name],
    },
  };
}

export default async function ArticlePage({ params }: PageProps<"/resources/[slug]">) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  const path = articleHref(a.slug);
  const related = a.related
    .map((s) => getArticle(s))
    .filter((r): r is NonNullable<typeof r> => !!r && isArticleLive(r.slug));

  const posting = articleNode({
    path,
    headline: a.title,
    description: a.metaDescription,
    datePublished: a.datePublished ?? a.dateReviewed,
    dateModified: a.dateReviewed,
    citations: a.sources.map((s) => s.href),
  });
  // No invented publish date: drop it from the schema until the article is published.
  if (!a.datePublished) delete posting.datePublished;

  return (
    <>
      <JsonLd data={graph({ ...posting, about: { "@id": SOFTWARE_ID } })} />

      {/* 01 · Article header (banner tier) */}
      <PageHero
        size="banner"
        breadcrumbPath={path}
        breadcrumbLeaf={a.shortTitle}
        accent={TOPICS[a.topic].accent}
        eyebrow={`${TOPICS[a.topic].label} · ${a.kind}`}
        title={a.title}
        scene="resources"
      >
        <div className="flex items-center justify-center gap-3 text-left">
          <BylineMark size={44} />
          <div className="text-[14px] leading-snug text-tone-muted">
            <p>
              By <span className="font-semibold text-tone-fg">{BYLINE}</span>
            </p>
            <p className="mt-0.5">
              {a.datePublished && (
                <>
                  Published <time dateTime={a.datePublished}>{formatDate(a.datePublished)}</time>
                  <span aria-hidden> · </span>
                </>
              )}
              Last reviewed against CBP sources <time dateTime={a.dateReviewed}>{formatDate(a.dateReviewed)}</time>
              <span aria-hidden> · </span>
              {a.readingMinutes} min read
            </p>
          </div>
        </div>
      </PageHero>

      {/* 02 · Body with sticky TOC */}
      <Section tone="paper" id="article" spacing="compact" className="md:pt-20">
        <div className="mx-auto grid max-w-[1080px] gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-tone-eyebrow">On this page</p>
              <ol className="mt-4 space-y-2.5 border-l border-[hsl(var(--surface-border))] text-[14px] leading-snug">
                {a.toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="-ml-px block border-l border-transparent pl-4 text-tone-muted transition-colors hover:border-[hsl(var(--tone-fg))] hover:text-tone-fg">
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="min-w-0 max-w-[720px]">
            <details className="mb-10 rounded-[16px] p-4 site-surface lg:hidden">
              <summary className="cursor-pointer text-[14px] font-semibold text-tone-fg">On this page</summary>
              <ol className="mt-3 space-y-2 text-[14px]">
                {a.toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="text-tone-muted hover:text-tone-fg">
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
            </details>

            <Prose>
              <a.Body />
            </Prose>

            {a.faq.length > 0 && (
              <section aria-labelledby="faq" className="mt-16">
                <h2 id="faq" className="scroll-mt-24 text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-tone-fg sm:text-[30px]">
                  FAQ
                </h2>
                <Faq className="mt-6" items={a.faq} />
              </section>
            )}

            <section aria-labelledby="sources" className="mt-16">
              <h2 id="sources" className="scroll-mt-24 text-[22px] font-semibold tracking-[-0.02em] text-tone-fg">
                Sources
              </h2>
              <ol className="mt-5 list-decimal space-y-3 pl-6 text-[15px] leading-relaxed text-tone-muted">
                {a.sources.map((s) => (
                  <li key={s.href} className="pl-1">
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-words text-tone-fg underline decoration-current/35 underline-offset-[3px] hover:decoration-current"
                    >
                      {s.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-[14px] text-tone-muted">
                General information, not legal advice. MyCargoLens is software, not a customs broker.
              </p>
            </section>

            {/* 03 · End of article: outline button so the pre-footer band keeps the only gold one in view */}
            <div className="mt-16 flex flex-col items-start gap-5 rounded-[20px] p-6 site-surface sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="text-[20px] font-semibold leading-snug tracking-[-0.015em] text-tone-fg">
                  See the ISF deadline clock on your own shipments.
                </p>
                <p className="mt-1 text-[15px] text-tone-muted">Book a 20-minute demo.</p>
              </div>
              <DemoButton variant="outline" location="inline" src={`article-${a.slug}-end`} className="shrink-0" />
            </div>
          </article>
        </div>
      </Section>

      {related.length > 0 && (
        <Section tone="cream" id="related">
          <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-tone-fg">Related</h2>
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <ArticleCard article={r} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CtaBand src={`article-${a.slug}`} hidePricingLink />
    </>
  );
}
