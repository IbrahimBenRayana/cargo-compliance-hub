import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentClass } from "@/lib/accents";
import { UI_STRINGS } from "@/lib/site";

/** Reading typography for article bodies (no typography plugin in this app). */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 text-[17px] leading-[1.7] text-tone-muted",
        "[&>p]:mt-5 [&>p:first-child]:mt-0",
        "[&_strong]:font-semibold [&_strong]:text-tone-fg",
        "[&>h2]:mt-16 [&>h2]:scroll-mt-24 [&>h2]:text-[26px] [&>h2]:font-semibold [&>h2]:leading-[1.15] [&>h2]:tracking-[-0.025em] [&>h2]:text-tone-fg sm:[&>h2]:text-[30px] [&>h2:first-child]:mt-0",
        "[&>h2+p]:mt-4",
        "[&>ul]:mt-5 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&>ol]:mt-5 [&>ol]:list-decimal [&>ol]:space-y-3 [&>ol]:pl-6",
        "[&>ul>li]:pl-1 [&>ol>li]:pl-1",
        "[&_:is(p,li,td)_a]:font-medium [&_:is(p,li,td)_a]:text-tone-fg [&_:is(p,li,td)_a]:underline [&_:is(p,li,td)_a]:decoration-current/35 [&_:is(p,li,td)_a]:underline-offset-[3px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** External citation link: new tab, with a screen-reader hint. */
export function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> {UI_STRINGS.externalHint}</span>
    </a>
  );
}

/** Lead-in answer block under an H2 (40-60 words; article template §6.1). */
export function Answer({ children }: { children: React.ReactNode }) {
  return <p className="text-[18px] leading-[1.65] text-tone-fg">{children}</p>;
}

/** "What MyCargoLens does here" box (approved claims only; once per article, after the first answer block). */
export function ProductBox({ body, linkLabel, href }: { body: React.ReactNode; linkLabel: string; href: string }) {
  return (
    <aside
      aria-label="What MyCargoLens does here"
      className={cn("mt-8 rounded-[20px] border border-[hsl(var(--a)/0.25)] bg-a-soft p-6", accentClass("isf"))}
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-a-ink">What MyCargoLens does here</p>
      <p className="mt-2 text-[16px] leading-relaxed text-tone-fg">{body}</p>
      <Link
        href={href}
        className="group mt-3 inline-flex items-center gap-1 text-[15px] font-semibold text-a-ink"
      >
        {linkLabel}
        <ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5" />
      </Link>
    </aside>
  );
}

/** Scrollable data table for narrow screens (the page itself never scrolls sideways). */
export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="mt-8 overflow-x-auto rounded-[16px] site-surface" role="region" aria-label={caption} tabIndex={0}>
      <table className="w-full min-w-[600px] border-collapse text-left text-[15px] leading-snug">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-[hsl(var(--surface-border))]">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-tone-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[hsl(var(--surface-border))] last:border-0 align-top">
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-4 py-3.5 font-semibold text-tone-fg">
                    {c}
                  </th>
                ) : (
                  <td key={j} className={cn("px-4 py-3.5", j === r.length - 1 ? "text-[13.5px] text-tone-muted" : "text-tone-fg")}>
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * IL-02: one master bill, five house bills, each its own ISF on its own
 * clock (wireframe 10). Static figure; the arithmetic matches the article.
 */
export function HouseBillFigure() {
  const hbls = [1, 2, 3, 4, 5];
  return (
    <figure className={cn("mt-8 rounded-[20px] p-5 site-surface sm:p-6", accentClass("isf"))}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex shrink-0 flex-col justify-center rounded-2xl border border-dashed border-[hsl(var(--surface-border))] px-4 py-3 sm:w-44">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-tone-muted">Master bill</p>
          <p className="mt-1 text-[15px] font-semibold text-tone-fg">1 container</p>
          <p className="mt-1 text-[13px] leading-snug text-tone-muted">No ISF at this level</p>
        </div>
        <ul className="grid min-w-0 flex-1 grid-cols-1 gap-2">
          {hbls.map((n) => (
            <li
              key={n}
              className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--a)/0.25)] bg-a-soft px-3.5 py-2.5"
            >
              <span className="text-[14px] font-semibold text-a-ink">House bill {n}</span>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-tone-fg tabular-nums">
                <Clock aria-hidden className="size-3.5 text-a-ink" />
                own ISF, own clock
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-4 text-[14px] leading-snug text-tone-muted">
        Five house bills filed late on one container: five possible $5,000 claims, or $25,000 before mitigation.
      </figcaption>
    </figure>
  );
}
