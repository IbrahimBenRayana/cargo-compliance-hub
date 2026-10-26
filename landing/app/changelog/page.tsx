import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/site/section";
import { JsonLd } from "@/components/site/json-ld";
import { cn } from "@/lib/utils";
import { webPage } from "@/lib/schema";
import { ROUTES } from "@/lib/site";
import { CHANGELOG_ENTRIES, KIND_LABEL, entryAnchor, formatChangelogDate, type Entry, type EntryKind } from "@/lib/changelog";
import { CtaBand } from "@/components/site/cta-band";

const TITLE = "Changelog: what shipped, and when";
const DESCRIPTION =
  "Release notes for MyCargoLens, newest first: ISF and entry filing, the compliance inbox, the public API and security updates.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ROUTES.changelog.href },
  openGraph: { title: TITLE, description: DESCRIPTION, url: ROUTES.changelog.href, type: "website" },
};

/** Entries shown before "Show older" (copy §7). Older ones stay in the HTML, so every entry is crawlable. */
const VISIBLE = 15;

/** Tag pills. Retired is neutral, never red. */
const PILL: Record<EntryKind, string> = {
  feature: "bg-sky-500/12 text-sky-800 ring-sky-600/25 dark:text-sky-200 dark:ring-sky-300/30",
  improvement: "bg-emerald-500/12 text-emerald-800 ring-emerald-600/25 dark:text-emerald-200 dark:ring-emerald-300/30",
  fix: "bg-violet-500/12 text-violet-800 ring-violet-600/25 dark:text-violet-200 dark:ring-violet-300/30",
  retired: "bg-[hsl(var(--surface))] text-tone-muted ring-[hsl(var(--surface-border))]",
};

function EntryRow({ entry }: { entry: Entry }) {
  const id = entryAnchor(entry);
  return (
    <li id={id} className="grid scroll-mt-24 grid-cols-1 gap-3 md:grid-cols-12 md:gap-8">
      <div className="md:col-span-3 md:pt-6">
        <time dateTime={entry.date} className="font-mono text-[13px] tabular-nums text-tone-muted">
          {formatChangelogDate(entry.date)}
        </time>
      </div>
      <article className="rounded-[20px] p-6 site-surface md:col-span-9">
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold ring-1",
            PILL[entry.kind],
          )}
        >
          {KIND_LABEL[entry.kind]}
        </span>
        <h2 className="mt-3 text-[19px] font-semibold leading-snug tracking-[-0.015em] text-tone-fg sm:text-[21px]">
          <a href={`#${id}`} className="group/anchor hover:underline hover:decoration-current/35 hover:underline-offset-4">
            {entry.title}
            <span aria-hidden className="ml-2 font-normal text-tone-muted opacity-0 transition-opacity group-hover/anchor:opacity-100">
              #
            </span>
          </a>
        </h2>
        <p className="mt-2 text-[15.5px] leading-relaxed text-tone-muted">{entry.body}</p>
        <Link
          href={entry.href}
          className="group mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 hover:decoration-current"
        >
          See it
          <ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5" />
        </Link>
      </article>
    </li>
  );
}

export default function ChangelogPage() {
  const recent = CHANGELOG_ENTRIES.slice(0, VISIBLE);
  const older = CHANGELOG_ENTRIES.slice(VISIBLE);
  return (
    <>
      <JsonLd data={webPage({ path: ROUTES.changelog.href, name: TITLE, description: DESCRIPTION, type: "CollectionPage" })} />

      <PageHero
        size="compact"
        breadcrumbPath={ROUTES.changelog.href}
        eyebrow="Changelog"
        title="What shipped, and when."
        sub="Release notes for MyCargoLens, newest first. We write up the changes you'd notice in your work: new filing types, new checks, the inbox, the API and security. Smaller fixes don't get an entry."
        scene="resources"
      />

      <Section tone="paper" id="releases">
        <ol className="space-y-6 md:space-y-8">
          {recent.map((e) => (
            <EntryRow key={entryAnchor(e)} entry={e} />
          ))}
        </ol>
        {older.length > 0 && (
          <details className="group mt-8">
            <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] px-4 py-2 text-[14px] font-semibold text-tone-fg [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show older ({older.length})</span>
              <span className="hidden group-open:inline">Show fewer</span>
              <ChevronDown aria-hidden className="size-4 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <ol className="mt-8 space-y-6 md:space-y-8">
              {older.map((e) => (
                <EntryRow key={entryAnchor(e)} entry={e} />
              ))}
            </ol>
          </details>
        )}
      </Section>

      <CtaBand
        title="See the latest version on your own filings."
        sub="Book a 20-minute demo. We'll show you what's new on shipments like yours and set up your team after."
        src="changelog-close"
      />
    </>
  );
}
