import * as React from "react";
import { cn } from "@/lib/utils";
import { accentClass, type ModuleKey } from "@/lib/accents";

/**
 * Section tones from the wireframe colour system (README "Round 3").
 * `hero` is the light mesh every page opens on; `navy` and `ink` are the dark
 * bands (pre-footer CTA, API strips). Rule: no two adjacent sections share a
 * tone. Gold is never a band colour.
 */
export type Tone =
  | "hero"
  | "mesh"
  | "paper"
  | "cream"
  | "sky"
  | "mint"
  | "lilac"
  | "peach"
  | "navy"
  | "ink"
  | "footer";

export const TONES: Tone[] = [
  "hero",
  "cream",
  "sky",
  "paper",
  "mint",
  "lilac",
  "peach",
  "mesh",
  "navy",
  "ink",
  "footer",
];

/** Dark bands carry `.dark` so every token and `dark:` utility inside flips. */
export const DARK_TONES: ReadonlySet<Tone> = new Set<Tone>(["navy", "ink"]);

type Width = "default" | "narrow" | "wide";

const WIDTH: Record<Width, string> = {
  /** 1120px content + 40px gutters (20px on phones). */
  default: "max-w-[1200px]",
  /** Reading width for FAQ, legal, articles. */
  narrow: "max-w-[860px]",
  wide: "max-w-[1360px]",
};

const SPACE = {
  /** README rhythm: 88-96px desktop, 56-76px mobile. */
  default: "py-16 md:py-24",
  compact: "py-12 md:py-16",
  none: "",
} as const;

export type SectionProps = {
  tone: Tone;
  /** Anchor id (also used for aria-labelledby on the heading if you pass one). */
  id?: string;
  /** Module accent for eyebrows, checkmarks, card tints inside this band. */
  accent?: ModuleKey;
  width?: Width;
  spacing?: keyof typeof SPACE;
  /** Render children edge to edge (no inner container). */
  bleed?: boolean;
  as?: "section" | "div" | "footer" | "header";
  className?: string;
  innerClassName?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">;

/** Shared container: same width and gutters as <Section>. */
export function SiteContainer({
  width = "default",
  className,
  children,
}: {
  width?: Width;
  className?: string;
  children?: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full px-5 sm:px-10", WIDTH[width], className)}>{children}</div>;
}

/**
 * The only way to set a band background. Server component.
 *
 * ```tsx
 * <Section tone="cream" id="how-it-works" accent="isf">
 *   <SectionHeading eyebrow="ISF filing" title="Every house bill on a clock." />
 *   …
 * </Section>
 * ```
 */
export function Section({
  tone,
  id,
  accent,
  width = "default",
  spacing = "default",
  bleed = false,
  as: Tag = "section",
  className,
  innerClassName,
  children,
  ...rest
}: SectionProps) {
  return (
    <Tag
      id={id}
      data-tone={tone}
      className={cn(
        "relative isolate scroll-mt-20",
        `tone-${tone}`,
        DARK_TONES.has(tone) && "dark",
        accentClass(accent),
        SPACE[spacing],
        className,
      )}
      {...rest}
    >
      {bleed ? children : <SiteContainer width={width} className={innerClassName}>{children}</SiteContainer>}
    </Tag>
  );
}

/** Eyebrow label in the tone's eyebrow colour (accent ink on module pages). */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[12px] font-semibold uppercase tracking-[0.16em] text-tone-eyebrow",
        className,
      )}
    >
      {children}
    </p>
  );
}

export type SectionHeadingProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: "left" | "center";
  /** Heading level. Pages own their single h1 (PageHero); sections use h2. */
  as?: "h2" | "h3";
  id?: string;
  className?: string;
};

/** Eyebrow → H2 → intro, with the type scale from the wireframes. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  as: H = "h2",
  id,
  className,
}: SectionHeadingProps) {
  return (
    <header className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <H
        id={id}
        className="text-[28px] font-semibold leading-[1.12] tracking-[-0.028em] text-tone-fg sm:text-[34px] md:text-[38px]"
      >
        {title}
      </H>
      {intro && (
        <p className="mt-4 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">{intro}</p>
      )}
    </header>
  );
}
