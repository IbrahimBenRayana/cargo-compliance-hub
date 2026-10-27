"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/site/json-ld";
import { faqPage } from "@/lib/schema";

export type FaqItem = {
  q: string;
  /** Plain-text answer: rendered on the page and in FAQPage JSON-LD, so they always match. */
  a: string;
};

/*
 * Motion: the panel's grid row eases 0fr -> 1fr (a height animation with no
 * measuring), the answer fades and settles 4px. Both are CSS transitions, so a
 * rapid re-toggle retargets from the current frame instead of restarting.
 * `visibility` rides the same transition: visible at once when opening, hidden
 * only after the collapse finishes, which also takes closed answers out of the
 * tab order and the accessibility tree while keeping them in the HTML.
 */
const EASE = "ease-[cubic-bezier(0.23,1,0.32,1)]";

/**
 * FAQ accordion: separated rows on the section tone, multiple answers open at
 * once, WAI-ARIA accordion semantics (heading > button[aria-expanded]) with
 * Up/Down/Home/End moving between questions. Answers are server-rendered and
 * stay in the DOM for search engines. FAQPage JSON-LD is built from the same
 * items. Google retired FAQ rich results (May 2026); the markup stays semantic.
 */
export function Faq({
  items,
  schema = true,
  defaultOpen = 0,
  className,
}: {
  items: FaqItem[];
  /** Emit FAQPage JSON-LD (one FAQ block per page). */
  schema?: boolean;
  /** Index opened on load (-1 for none). */
  defaultOpen?: number;
  className?: string;
}) {
  const baseId = React.useId();
  const [open, setOpen] = React.useState<ReadonlySet<number>>(
    () => new Set(defaultOpen >= 0 ? [defaultOpen] : []),
  );

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  // Roving focus between question buttons (Enter/Space come free with <button>).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-faq-trigger]"));
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    e.preventDefault();
    const last = buttons.length - 1;
    const to =
      e.key === "Home" ? 0 : e.key === "End" ? last : e.key === "ArrowDown" ? (at === last ? 0 : at + 1) : at === 0 ? last : at - 1;
    buttons[to]?.focus();
  };

  return (
    <>
      <div data-faq className={cn("flex flex-col gap-2.5", className)} onKeyDown={onKeyDown}>
        {items.map((item, i) => {
          const isOpen = open.has(i);
          const triggerId = `${baseId}-q${i}`;
          const panelId = `${baseId}-a${i}`;
          return (
            <div
              key={item.q}
              data-state={isOpen ? "open" : "closed"}
              className={cn(
                "group rounded-2xl border bg-[hsl(var(--surface))] transition-[border-color] duration-200 ease-out motion-reduce:transition-none",
                isOpen
                  ? "border-[hsl(var(--tone-fg)/0.16)]"
                  : "border-[hsl(var(--surface-border))] [@media(hover:hover)]:hover:border-[hsl(var(--tone-fg)/0.16)]",
              )}
            >
              <h3 className="text-pretty text-[16px] font-medium leading-snug tracking-[-0.01em] text-tone-fg sm:text-[17px]">
                <button
                  type="button"
                  id={triggerId}
                  data-faq-trigger
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(i)}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-5 rounded-2xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6 sm:py-[18px]"
                >
                  <span>{item.q}</span>
                  <PlusMinus open={isOpen} />
                </button>
              </h3>
              <div
                id={panelId}
                className={cn(
                  "grid transition-[grid-template-rows,visibility] duration-[260ms] motion-reduce:transition-none",
                  EASE,
                  isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <p
                    className={cn(
                      "max-w-[64ch] px-5 pb-5 pr-14 text-[15.5px] leading-relaxed text-tone-muted transition-[opacity,transform] motion-reduce:transition-none sm:px-6 sm:pb-6 sm:pr-16",
                      EASE,
                      isOpen
                        ? "translate-y-0 opacity-100 delay-[40ms] duration-[240ms]"
                        : "-translate-y-1 opacity-0 duration-150",
                    )}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {schema && <JsonLd data={faqPage(items)} />}
    </>
  );
}

/** Plus that morphs to minus: the vertical bar turns flat and fades into the horizontal one. */
function PlusMinus({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-8 shrink-0 place-items-center rounded-full text-tone-fg transition-[background-color] duration-200 ease-out motion-reduce:transition-none",
        open ? "bg-[hsl(var(--tone-fg)/0.10)]" : "bg-[hsl(var(--tone-fg)/0.05)] group-hover:bg-[hsl(var(--tone-fg)/0.08)]",
      )}
    >
      <span className="absolute h-[2px] w-3 rounded-full bg-current" />
      <span
        className={cn(
          "absolute h-3 w-[2px] rounded-full bg-current transition-[transform,opacity] duration-[240ms] motion-reduce:transition-none",
          EASE,
          open ? "rotate-90 opacity-0" : "rotate-0 opacity-100",
        )}
      />
    </span>
  );
}
