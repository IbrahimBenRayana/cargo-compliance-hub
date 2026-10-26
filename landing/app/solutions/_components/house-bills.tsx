import * as React from "react";
import { Clock3, FileStack } from "lucide-react";

/**
 * IL-02 (wireframes): one master bill splitting into house bills, each with
 * its own ISF clock. Brand line-art, ISF blue, static (no dollar counter).
 * Decorative: the copy beside it says the same thing.
 */
export function HouseBillsIllustration() {
  const rows = ["House bill 1", "House bill 2", "House bill 3", "House bill 4"];
  return (
    <div aria-hidden className="acc-isf rounded-[22px] p-5 site-surface sm:p-6">
      <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--a)/0.3)] bg-a-soft px-4 py-3">
        <FileStack className="size-5 shrink-0 text-a-ink" strokeWidth={1.9} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-a-ink">Master bill</p>
          <p className="truncate font-mono text-[13px] text-tone-fg">OOLU210577643</p>
        </div>
      </div>
      <ul className="relative mt-3 space-y-2.5 pl-6">
        <span className="absolute bottom-5 left-2.5 top-0 w-px bg-[hsl(var(--a)/0.35)]" />
        {rows.map((label, i) => (
          <li key={label} className="relative flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--card))] px-4 py-2.5">
            <span className="absolute -left-3.5 top-1/2 h-px w-3.5 bg-[hsl(var(--a)/0.35)]" />
            <span className="min-w-0 truncate text-[14px] font-medium text-tone-fg">{label}</span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-a-soft px-2.5 py-1 font-mono text-[11.5px] tabular-nums text-a-ink">
              <Clock3 className="size-3.5" strokeWidth={2} />
              ISF {i === 0 ? "72h" : i === 1 ? "48h" : i === 2 ? "24h" : "72h"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
