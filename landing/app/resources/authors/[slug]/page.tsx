import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { CtaBand } from "@/components/site/cta-band";
import { JsonLd } from "@/components/site/json-ld";
import { authorHref } from "@/lib/site";
import { abs, graph, person } from "@/lib/schema";
import { ARTICLES, publishedArticles } from "../../_content/articles";
import { AUTHORS, getAuthor, personInput } from "../../_content/authors";
import { CORRECTIONS_EMAIL, REVIEWED_BY_BROKER } from "../../_content/editorial";
import { ArticleCard, AuthorAvatar } from "../../_components/cards";

/** copy/resources-author.md (W6): E-E-A-T author page, /resources/authors/{first-last}. */
export const dynamicParams = false;

export function generateStaticParams() {
  return AUTHORS.map((a) => ({ slug: a.slug }));
}

const KNOWS_ABOUT = [
  "Importer Security Filing",
  "ISF-10",
  "ISF-5",
  "CBP Form 7501",
  "Post-summary correction",
  "Automated Broker Interface",
];

function articlesBy(slug: string) {
  return publishedArticles().filter((a) => a.authorSlug === slug);
}

export async function generateMetadata({ params }: PageProps<"/resources/authors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthor(slug);
  if (!author) return {};
  const path = authorHref(author.slug);
  const title = `${author.name}, Customs Filing Guides`;
  const description = `${author.name} is a founder at MyCargoLens and writes our guides on ISF, customs entries and CBP filing rules. Read their articles and sources.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    // The page goes into the index once the author has a published article (deck S5).
    ...(articlesBy(author.slug).length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "profile", title: `${title} | MyCargoLens`, description, url: path },
  };
}

export default async function AuthorPage({ params }: PageProps<"/resources/authors/[slug]">) {
  const { slug } = await params;
  const author = getAuthor(slug);
  if (!author) notFound();
  const path = authorHref(author.slug);
  const articles = articlesBy(author.slug);
  const lastReviewed = ARTICLES.filter((a) => a.authorSlug === author.slug && a.status === "published")
    .map((a) => a.dateReviewed)
    .sort()
    .at(-1);

  const personNode = person({ ...personInput(author), description: author.bio.join(" ") });

  return (
    <>
      <JsonLd
        data={graph(
          {
            "@type": "ProfilePage",
            "@id": `${abs(path)}#page`,
            url: abs(path),
            name: author.name,
            ...(lastReviewed ? { dateModified: lastReviewed } : {}),
            mainEntity: { "@id": personNode["@id"] },
          },
          {
            ...personNode,
            ...(author.photo ? { image: abs(author.photo) } : {}),
            knowsAbout: KNOWS_ABOUT,
          },
        )}
      />

      {/* S1 · Header */}
      <PageHero
        size="compact"
        breadcrumbPath={path}
        breadcrumbLeaf={author.name}
        badge={<AuthorAvatar author={author} size={64} />}
        eyebrow="Author"
        title={author.name}
        sub={author.role}
        scene="resources"
      />

      {/* S2 · Short bio */}
      <Section tone="paper" id="bio" width="narrow" spacing="compact">
        <div className="space-y-4 text-[18px] leading-relaxed text-tone-fg">
          {author.bio.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Section>

      {/* S3 · Topics */}
      <Section tone="cream" id="topics" width="narrow">
        <SectionHeading
          title="Topics"
          intro="ISF-10 and ISF-5 filing, ISF deadlines and penalties, entry summaries and post-summary corrections, tariff and rule changes, and filing through an API."
        />
      </Section>

      {/* S4 · How the guides are written */}
      <Section tone="sky" id="sources-and-corrections" width="narrow">
        <SectionHeading title="Sources and corrections" />
        <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-tone-muted">
          <p>
            Every rule in these guides links to the regulation, CBP page or Federal Register notice it comes from, and
            each guide shows the date it was last checked. Found something out of date? Email{" "}
            <a
              href={`mailto:${CORRECTIONS_EMAIL}`}
              className="font-medium text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
            >
              {CORRECTIONS_EMAIL}
            </a>
            .
          </p>
          {REVIEWED_BY_BROKER && <p>ISF and entry guides are reviewed by a licensed customs broker before publishing.</p>}
          <p className="text-[14px]">General information, not legal advice. MyCargoLens is software, not a customs broker.</p>
        </div>
      </Section>

      {/* S5 · Articles (never an empty state) */}
      {articles.length > 0 && (
        <Section tone="mint" id="articles">
          <SectionHeading title={`Articles by ${author.firstName}`} />
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <ArticleCard article={a} showAuthor={false} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* S6 · Pre-footer CTA band */}
      <CtaBand src="author" hidePricingLink />
    </>
  );
}
