import type { PersonInput } from "@/lib/schema";
import type { Author } from "./types";

/**
 * Authors (copy/resources-author.md). Neither the deck nor article-01 names
 * an author, so the byline is the founder, Ibrahim Rayana (CMO brief, T11).
 * Only confirmed facts: no years of experience, licences, prior employers,
 * photo or LinkedIn until he supplies them. MyCargoLens is not a customs
 * broker and nothing here implies he is licensed.
 */
export const AUTHORS: Author[] = [
  {
    slug: "ibrahim-rayana",
    name: "Ibrahim Rayana",
    firstName: "Ibrahim",
    role: "Founder, MyCargoLens",
    jobTitle: "Founder",
    bio: [
      "Ibrahim Rayana is a founder of MyCargoLens. Ibrahim writes our guides on ISF deadlines, entry summaries and the rules that change what importers and forwarders file.",
    ],
    photo: null,
    linkedInUrl: null,
  },
];

export function getAuthor(slug: string): Author | undefined {
  return AUTHORS.find((a) => a.slug === slug);
}

export function personInput(a: Author): PersonInput {
  return {
    slug: a.slug,
    name: a.name,
    jobTitle: a.jobTitle,
    ...(a.linkedInUrl ? { sameAs: [a.linkedInUrl] } : {}),
  };
}

/** "Ibrahim Rayana" → "IR" (initials tile; no photo on file). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
