import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/site/json-ld";
import { faqPage } from "@/lib/schema";

export type FaqItem = {
  q: string;
  /** Plain-text answer: rendered on the page and in FAQPage JSON-LD, so they always match. */
  a: string;
};

/**
 * FAQ accordion on native <details> (works without JS, keyboard and screen
 * reader friendly) + FAQPage JSON-LD built from the same items. Google
 * retired FAQ rich results (May 2026); the markup stays semantic only.
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
  return (
    <>
    <div className={cn("divide-y divide-[hsl(var(--surface-border))] border-y border-[hsl(var(--surface-border))]", className)}>
      {items.map((item, i) => (
        <details key={item.q} name="faq" open={i === defaultOpen} className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left text-[17px] font-semibold leading-snug text-tone-fg marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {item.q}
            <Plus
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-tone-muted transition-transform duration-200 ease-[var(--ease-out-quart)] group-open:rotate-45"
            />
          </summary>
          <p className="-mt-1 max-w-3xl pb-5 pr-10 text-[15.5px] leading-relaxed text-tone-muted">{item.a}</p>
        </details>
      ))}
    </div>
    {schema && <JsonLd data={faqPage(items)} />}
    </>
  );
}
