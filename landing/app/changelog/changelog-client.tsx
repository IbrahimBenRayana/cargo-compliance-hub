"use client";

import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { SeverityPill } from "@/components/ui/severity-pill";

import {
  CHANGELOG_ENTRIES,
  KIND_LABEL,
  KIND_TONE,
  formatChangelogDate,
} from "@/lib/changelog";


export function ChangelogClient() {
  return (
    <>
      <PageHero
        label="Changelog"
        title="What shipped, when."
        description="Hand-curated release notes, reverse chronological. We ship every weekday — these are the ones worth telling you about."
        breadcrumbs={[{ label: "Changelog", href: "/changelog" }]}
      />

      <SectionShell tone="default">
        <ol className="space-y-10">
          {CHANGELOG_ENTRIES.map((entry) => (
            <li key={entry.date + entry.title} className="grid gap-6 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-3">
                <div className="sticky top-24">
                  <time className="font-mono text-[12.5px] font-semibold tabular-nums text-muted-foreground">
                    {formatChangelogDate(entry.date)}
                  </time>
                  <div className="mt-2">
                    <SeverityPill tone={KIND_TONE[entry.kind]}>{KIND_LABEL[entry.kind]}</SeverityPill>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-9">
                <article className="rounded-2xl border border-border/60 bg-card p-6">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground mb-3">
                    {entry.title}
                  </h2>
                  <p className="text-[14.5px] text-muted-foreground leading-relaxed mb-4">
                    {entry.body}
                  </p>
                  {entry.link && (
                    <Link
                      href={entry.link.href}
                      className="text-sm font-semibold text-foreground hover:text-gold transition-colors"
                    >
                      → {entry.link.label}
                    </Link>
                  )}
                </article>
              </div>
            </li>
          ))}
        </ol>
      </SectionShell>

      <SectionShell tone="muted" headingAlign="center" title="Try it out yourself.">
        <p className="mx-auto max-w-xl text-center text-base leading-relaxed mb-8 opacity-80">
          Book a walkthrough and we&apos;ll get you provisioned. Drafts are free — you only
          pay per shipment when we file for you. See the inbox we&apos;re building from the inside.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="gold" size="lg" asChild>
            <Link href="/book-a-demo">Request a demo</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/contact">Talk to founders</Link>
          </Button>
        </div>
      </SectionShell>
    </>
  );
}
