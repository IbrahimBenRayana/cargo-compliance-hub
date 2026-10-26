import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CTA, ctaHref, type CtaKey, type CtaLocation, type DemoCtaKey, type Persona } from "@/lib/site";

export type DemoButtonProps = {
  /** Label from the CTA registry (global.md §7). Default "Book a demo". */
  cta?: DemoCtaKey;
  persona?: Persona;
  /** `?src=` attribution, e.g. "home-hero", "pricing-volume". */
  src?: string;
  location: CtaLocation;
  size?: "sm" | "default" | "lg";
  /** Gold (default) or outline (footer, so the band keeps the only gold). */
  variant?: "gold" | "outline";
  arrow?: boolean;
  className?: string;
  onClick?: () => void;
};

/**
 * The Book a demo button. Gold is reserved for this button (and the logo):
 * keep one per viewport. Goes to /book-a-demo?persona=…&src=….
 */
export function DemoButton({
  cta = "bookDemo",
  persona,
  src,
  location,
  size = "default",
  variant = "gold",
  arrow = false,
  className,
  onClick,
}: DemoButtonProps) {
  const c = CTA[cta];
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={cn("group", variant === "outline" && "bg-[hsl(var(--surface))]", className)}
    >
      <Link
        href={ctaHref({ persona, src })}
        data-cta-id={c.id}
        data-location={location}
        onClick={onClick}
      >
        {c.label}
        {arrow && (
          <ArrowRight
            aria-hidden
            className="transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
          />
        )}
      </Link>
    </Button>
  );
}

/** Secondary CTA (outline button or text link): "See pricing", "Read the API overview". */
export function SecondaryCta({
  cta = "seePricing",
  location,
  as = "button",
  size = "default",
  className,
}: {
  cta?: Extract<CtaKey, "seePricing" | "apiOverview" | "isfTool">;
  location: CtaLocation;
  as?: "button" | "link";
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const c = CTA[cta];
  if (as === "link") {
    return (
      <Link
        href={c.href}
        data-cta-id={c.id}
        data-location={location}
        className={cn(
          "inline-flex items-center gap-1 text-[15px] font-semibold text-tone-fg underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current",
          className,
        )}
      >
        {c.label}
      </Link>
    );
  }
  return (
    <Button asChild variant="outline" size={size} className={cn("bg-[hsl(var(--surface))]", className)}>
      <Link href={c.href} data-cta-id={c.id} data-location={location}>
        {c.label}
      </Link>
    </Button>
  );
}
