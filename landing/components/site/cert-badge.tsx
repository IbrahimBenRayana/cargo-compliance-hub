import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CERT_BADGE } from "@/lib/site";

/** "CBP ABI certified" badge (claim A21). Pass `link` to make it go to /security. */
export function CertBadge({ className, link = false }: { className?: string; link?: boolean }) {
  const cls = cn(
    "inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-[hsl(var(--card))] py-1 pl-2 pr-3 text-[12.5px] font-semibold text-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]",
    link && "transition-colors hover:border-foreground/25",
    className,
  );
  const inner = (
    <>
      <span aria-hidden className="relative grid size-3.5 place-items-center rounded-full bg-emerald-500/15">
        <span className="size-1.5 rounded-full bg-emerald-500" />
      </span>
      {CERT_BADGE.label}
    </>
  );
  return link ? (
    <Link href={CERT_BADGE.href} className={cls}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  );
}
