import { COMPANY, SITE_URL } from "@/lib/site";

/**
 * schema.org builders (site-architecture §5.5). Nodes use stable `@id`s so
 * pages can reference the site-wide ones: `/#org`, `/#website`, `/#software`.
 * No aggregateRating / Review anywhere (we have none). Render with <JsonLd>.
 */

export type JsonLdNode = { "@type": string | string[]; [key: string]: unknown };
export type JsonLdDoc = { "@context": "https://schema.org"; "@graph": JsonLdNode[] } | (JsonLdNode & { "@context": "https://schema.org" });

export const ORG_ID = `${SITE_URL}/#org`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path === "/" ? "" : path}`);

/** Wrap nodes into one `@graph` document. */
export function graph(...nodes: (JsonLdNode | null | undefined | false)[]): JsonLdDoc {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) as JsonLdNode[] };
}

export function organization(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: COMPANY.name,
    legalName: COMPANY.legalName,
    url: SITE_URL,
    logo: abs("/brand/logo-mark-square.svg"),
    description:
      "MyCargoLens is ISF and customs entry filing software for importers, forwarders, NVOCCs and customs brokers. It is not a licensed customs broker.",
    founder: COMPANY.founders.map((name) => ({ "@type": "Person", name })),
    ...(COMPANY.foundingYear ? { foundingDate: COMPANY.foundingYear } : {}),
    ...(COMPANY.postalAddress ? { address: COMPANY.postalAddress } : {}),
    ...(COMPANY.linkedInUrl ? { sameAs: [COMPANY.linkedInUrl] } : {}),
  };
}

export function website(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: COMPANY.name,
    url: SITE_URL,
    publisher: { "@id": ORG_ID },
  };
}

export type OfferInput = {
  name: string;
  /** USD amount per unit, e.g. 45. */
  price: number;
  unitText?: string;
  description?: string;
};

/** Offer with a UnitPriceSpecification ("per shipment"). */
export function offer({ name, price, unitText = "per shipment", description }: OfferInput): JsonLdNode {
  return {
    "@type": "Offer",
    name,
    ...(description ? { description } : {}),
    price: price.toFixed(2),
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: price.toFixed(2),
      priceCurrency: "USD",
      unitText,
    },
  };
}

/** The one SoftwareApplication node (`/#software`). Offers come from the pricing page data. */
export function softwareApplication({ offers = [], description }: { offers?: OfferInput[]; description?: string } = {}): JsonLdNode {
  return {
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_ID,
    name: COMPANY.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    publisher: { "@id": ORG_ID },
    ...(description ? { description } : {}),
    ...(offers.length ? { offers: offers.map(offer) } : {}),
  };
}

/** Product + Offer (for a single priced package, if a page needs one). */
export function product({ name, description, offers }: { name: string; description?: string; offers: OfferInput[] }): JsonLdNode {
  return {
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    brand: { "@id": ORG_ID },
    offers: offers.map(offer),
  };
}

/** WebPage-family node for a route. `type` e.g. "WebPage", "CollectionPage", "AboutPage", "ContactPage". */
export function webPage({
  path,
  name,
  description,
  type = "WebPage",
  aboutSoftware = false,
}: {
  path: string;
  name: string;
  description?: string;
  type?: string;
  aboutSoftware?: boolean;
}): JsonLdNode {
  return {
    "@type": type,
    "@id": `${abs(path)}#page`,
    url: abs(path),
    name,
    ...(description ? { description } : {}),
    isPartOf: { "@id": WEBSITE_ID },
    ...(aboutSoftware ? { about: { "@id": SOFTWARE_ID } } : {}),
  };
}

export type PersonInput = { slug: string; name: string; jobTitle?: string; description?: string; sameAs?: string[] };

export function person({ slug, name, jobTitle, description, sameAs }: PersonInput): JsonLdNode {
  const url = abs(`/resources/authors/${slug}`);
  return {
    "@type": "Person",
    "@id": `${url}#person`,
    name,
    url,
    ...(jobTitle ? { jobTitle } : {}),
    ...(description ? { description } : {}),
    worksFor: { "@id": ORG_ID },
    ...(sameAs?.length ? { sameAs } : {}),
  };
}

/** Article / BlogPosting for /resources/{slug}. */
export function article({
  path,
  headline,
  description,
  datePublished,
  dateModified,
  author,
  citations = [],
  image,
  type = "BlogPosting",
}: {
  path: string;
  headline: string;
  description?: string;
  datePublished: string;
  dateModified?: string;
  author: PersonInput;
  citations?: string[];
  image?: string;
  type?: "BlogPosting" | "Article" | "TechArticle";
}): JsonLdNode {
  return {
    "@type": type,
    "@id": `${abs(path)}#article`,
    mainEntityOfPage: abs(path),
    headline,
    ...(description ? { description } : {}),
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: { "@id": `${abs(`/resources/authors/${author.slug}`)}#person`, name: author.name },
    publisher: { "@id": ORG_ID },
    ...(image ? { image: abs(image) } : {}),
    ...(citations.length ? { citation: citations } : {}),
  };
}

export type Crumb = { name: string; href: string };

export function breadcrumbList(crumbs: Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.href),
    })),
  };
}

export type FaqInput = { q: string; a: string };

/** FAQPage, semantic only: must match the visible FAQ text. */
export function faqPage(items: FaqInput[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
