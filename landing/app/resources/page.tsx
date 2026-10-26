import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading, Eyebrow } from "@/components/site/section";
import { CardGrid } from "@/components/site/blocks";
import { CtaBand } from "@/components/site/cta-band";
import { JsonLd } from "@/components/site/json-ld";
import { CTA, ROUTES, authorHref } from "@/lib/site";
import { abs, graph, webPage } from "@/lib/schema";
import { articleHref, publishedArticles } from "./_content/articles";
import { AUTHORS } from "./_content/authors";
import { TOPICS, TOPIC_ORDER } from "./_content/topics";
import { ArticleCard, FeaturedCard } from "./_components/cards";
import { CORRECTIONS_EMAIL, REVIEWED_BY_BROKER } from "./_content/editorial";

/** copy/resources.md (W6), wireframe 09. */
const TITLE = "ISF and Customs Entry Filing Guides";
const DESCRIPTION =
  "Plain-English guides to ISF-10, ISF-5, entry summaries, liquidation and tariffs, written from CBP's own rules and linked to the source.";
const PATH = ROUTES.resources.href;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: `${TITLE} | MyCargoLens`, description: DESCRIPTION, url: PATH, type: "website" },
};

export default function ResourcesPage() {
  const articles = publishedArticles();
  const [featured, ...rest] = articles;
  const topicsWithArticles = TOPIC_ORDER.filter((t) => articles.some((a) => a.topic === t));
  // A chip jumps to its topic list, or to the featured card when that's the topic's only article.
  const chipTarget = (t: (typeof TOPIC_ORDER)[number]) => (rest.some((a) => a.topic === t) ? `#topic-${t}` : "#latest");
  const author = AUTHORS[0];

  // S4: each tool card appears only once its page is live (P1). No "coming soon".
  const tools = [
    ROUTES.isfDeadlineCalculator.live && {
      title: "ISF deadline calculator",
      body: "Enter the lading date and see when the ISF is due: 24 hours before the cargo is laden at the foreign port.",
      href: ROUTES.isfDeadlineCalculator.href,
      linkLabel: CTA.isfTool.label,
      module: "isf" as const,
    },
    ROUTES.glossary.live && {
      title: "Glossary",
      body: "Short definitions of ISF, ABI, PSC, LD and the other terms filers use",
      href: ROUTES.glossary.href,
      linkLabel: "Glossary",
    },
  ].filter((x): x is Exclude<typeof x, false> => Boolean(x));

  return (
    <>
      <JsonLd
        data={graph({
          ...webPage({ path: PATH, name: "ISF and customs filing guides", description: DESCRIPTION, type: "CollectionPage" }),
          publisher: { "@id": abs("/#org") },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: articles.map((a, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: abs(articleHref(a.slug)),
            })),
          },
        })}
      />

      {/* S1 · Header */}
      <PageHero
        size="compact"
        breadcrumbPath={PATH}
        eyebrow="Resources"
        title="ISF and customs filing guides"
        sub="Short, sourced answers to the questions that come up when you file your own ISF and entries: deadlines, penalties, who files what, and what happens after CBP accepts. Every regulatory statement links to CBP or the regulation it comes from."
        scene="resources"
      >
        {topicsWithArticles.length > 0 && (
          <ul aria-label="Topics" className="flex flex-wrap gap-2">
            {topicsWithArticles.map((t) => (
              <li key={t}>
                <a
                  href={chipTarget(t)}
                  className="inline-flex h-9 items-center rounded-full px-4 text-[14px] font-semibold text-tone-fg site-surface transition-colors hover:bg-[hsl(var(--surface-border)/0.4)]"
                >
                  {TOPICS[t].label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </PageHero>

      {/* S2 · Featured (latest) */}
      {featured && (
        <Section tone="paper" id="latest" aria-labelledby="latest-title">
          <Eyebrow className="mb-5">
            <span id="latest-title">Latest</span>
          </Eyebrow>
          <FeaturedCard article={featured} />
        </Section>
      )}

      {/* S3 · Browse by topic (only topics with articles; launch fallback = chips + featured only) */}
      {rest.length > 0 && (
        <Section tone="cream" id="topics">
          <SectionHeading title="Browse by topic" />
          <div className="mt-10 space-y-14">
            {topicsWithArticles.map((t) => {
              const list = rest.filter((a) => a.topic === t);
              if (!list.length) return null;
              return (
                <div key={t} id={`topic-${t}`} className="scroll-mt-24">
                  <h3 className="text-[20px] font-semibold tracking-[-0.015em] text-tone-fg">{TOPICS[t].label}</h3>
                  <p className="mt-1 text-[15px] text-tone-muted">{TOPICS[t].description}</p>
                  <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((a) => (
                      <li key={a.slug}>
                        <ArticleCard article={a} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* S4 · Tools (hidden until live) */}
      {tools.length > 0 && (
        <Section tone="lilac" id="tools">
          <SectionHeading title="Tools" />
          <CardGrid className="mt-10" items={tools} />
        </Section>
      )}

      {/* S5 · How we write these */}
      <Section tone="sky" id="how-we-write" width="narrow">
        <SectionHeading title="How we write these" />
        <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-tone-muted">
          <p>
            Each guide answers one question and links to the regulation or CBP page behind every rule it states. Each one
            shows the date we last checked it. When a rule changes, we update the guide and the date.
          </p>
          {REVIEWED_BY_BROKER ? (
            <p>ISF and entry guides are reviewed by a licensed customs broker before they&apos;re published.</p>
          ) : (
            <p>
              If you spot something out of date, tell us at{" "}
              <a
                href={`mailto:${CORRECTIONS_EMAIL}`}
                className="font-medium text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
              >
                {CORRECTIONS_EMAIL}
              </a>{" "}
              and we&apos;ll fix it.
            </p>
          )}
          <p className="text-[14px]">General information, not legal advice. MyCargoLens is software, not a customs broker.</p>
        </div>
        {author && (
          <Link
            href={authorHref(author.slug)}
            className="group mt-6 inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg"
          >
            About the author
            <ArrowRight aria-hidden className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5" />
          </Link>
        )}
      </Section>

      {/* S6 · Product bridge */}
      <Section tone="mint" id="where-we-fit" width="narrow">
        <SectionHeading
          title="Where MyCargoLens fits"
          intro="The guides explain the rules. MyCargoLens helps you apply them to your own filings: every ISF on a deadline clock, every draft checked before CBP sees it."
        />
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          {[ROUTES.isfFiling, ROUTES.inbox, ROUTES.preFilingChecks].map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="group inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg">
                {r.label}
                <ArrowRight aria-hidden className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* S7 · Pre-footer CTA band */}
      <CtaBand src="resources" hidePricingLink />
    </>
  );
}
