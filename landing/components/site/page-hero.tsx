import * as React from "react";
import { cn } from "@/lib/utils";
import { Hero3D, type HeroSlug } from "@/components/hero3d/Hero3D";
import { Section, Eyebrow } from "@/components/site/section";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import type { ModuleKey } from "@/lib/accents";

export type PageHeroProps = {
  eyebrow?: React.ReactNode;
  /** The page's only H1. Renders static (no word-by-word reveal). */
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** CTA row: usually <DemoButton location="hero" src="…" /> + <SecondaryCta location="hero" />. */
  actions?: React.ReactNode;
  /** Microcopy under the CTAs (one line). */
  micro?: React.ReactNode;
  /** Badge slot above the H1. */
  badge?: React.ReactNode;
  /** Hero 3D scene (keys of HERO_SCENES). Omit for no visual. */
  scene?: HeroSlug;
  /**
   * Visual tier (wireframes): "full" = copy left, large scene right (home,
   * platform, ISF, NVOCC, about); "compact" = smaller scene (solutions,
   * pricing, compare, resources, security, contact); "banner" = text first,
   * short scene under it (article, book a demo, thanks, 404).
   */
  size?: "full" | "compact" | "banner";
  /** Show breadcrumbs for this path (every page except /, the form, thanks and 404). */
  breadcrumbPath?: string;
  breadcrumbLeaf?: string;
  /** Module accent (eyebrow colour on module pages). */
  accent?: ModuleKey;
  /** Subtle gold glow under the scene. Off by default (flat-colour rule). */
  glow?: boolean;
  /** Extra content under the copy (chips, a flow strip…). */
  children?: React.ReactNode;
  className?: string;
};

/**
 * First section of every page: tone "hero" (flat paper + dot grid).
 * Marks itself `data-hero` so <StickyDemoBar> knows when it's scrolled away.
 */
export function PageHero({
  eyebrow,
  title,
  sub,
  actions,
  micro,
  badge,
  scene,
  size = "full",
  breadcrumbPath,
  breadcrumbLeaf,
  accent,
  glow = false,
  children,
  className,
}: PageHeroProps) {
  const banner = size === "banner";
  const copy = (
    <div className={cn("min-w-0", banner && "mx-auto max-w-3xl text-center")}>
      {breadcrumbPath && (
        <Breadcrumbs path={breadcrumbPath} leaf={breadcrumbLeaf} className={cn("mb-6", banner && "flex justify-center")} />
      )}
      {badge && <div className={cn("mb-5", banner && "flex justify-center")}>{badge}</div>}
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <h1
        className={cn(
          "font-semibold tracking-[-0.035em] text-tone-fg",
          size === "full" ? "text-[40px] sm:text-[52px] lg:text-[60px]" : "text-[36px] sm:text-[46px] lg:text-[52px]",
          // after the size classes: tailwind-merge drops a leading-* that precedes a text-size
          "leading-[1.04]",
        )}
      >
        {title}
      </h1>
      {sub && (
        <p className={cn("mt-5 text-[17px] leading-relaxed text-tone-muted sm:text-[19px]", banner ? "mx-auto max-w-2xl" : "max-w-xl")}>
          {sub}
        </p>
      )}
      {actions && (
        <div className={cn("mt-8 flex flex-wrap items-center gap-3", banner && "justify-center")}>{actions}</div>
      )}
      {micro && <p className="mt-4 text-[13px] text-tone-muted">{micro}</p>}
      {children && <div className="mt-8">{children}</div>}
    </div>
  );

  return (
    <Section
      tone="hero"
      accent={accent}
      data-hero=""
      spacing="none"
      className={cn("pb-14 pt-8 md:pb-20 md:pt-12", className)}
    >
      {banner || !scene ? (
        <>
          {copy}
          {scene && (
            <div className="mx-auto mt-10 max-w-[560px]">
              <Hero3D scene={scene} glow={glow} />
            </div>
          )}
        </>
      ) : (
        <div
          className={cn(
            "grid items-center gap-10 lg:gap-12",
            size === "full" ? "lg:grid-cols-[1.05fr_1fr]" : "lg:grid-cols-[1.3fr_1fr]",
          )}
        >
          {copy}
          <div className={cn("mx-auto w-full", size === "full" ? "max-w-[640px]" : "max-w-[460px]")}>
            <Hero3D scene={scene} glow={glow} />
          </div>
        </div>
      )}
    </Section>
  );
}
