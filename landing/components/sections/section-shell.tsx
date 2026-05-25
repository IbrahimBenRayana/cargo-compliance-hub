"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

type Tone = "default" | "muted" | "dark" | "gold" | "warm" | "cool" | "deep";

type SectionShellProps = {
  /** The eyebrow chip text above the title (uppercase tracking). */
  eyebrow?: string;
  /** Section title — short, declarative. */
  title?: React.ReactNode;
  /** One-paragraph intro between title and the visual content. */
  intro?: React.ReactNode;
  /** Tone of the section background. */
  tone?: Tone;
  /** Whether to render the section as full-bleed (no Container). */
  fullBleed?: boolean;
  /** Anchor id for deep-linking. */
  id?: string;
  /** Visual layout alignment of the heading block. */
  headingAlign?: "left" | "center";
  /** Additional class for the outer section element. */
  className?: string;
  /** Class applied to the inner Container (only when fullBleed=false). */
  innerClassName?: string;
  children?: React.ReactNode;
};

const TONE_BG: Record<Tone, string> = {
  /** Light grey — the base. Adapts to system theme. */
  default: "bg-background",
  /** Dark grey — the alternating partner. We add the `.dark` class so
      every descendant CSS variable flips to its dark-mode value: cards
      become dark, text-foreground becomes light, muted-foreground
      becomes the right shade — automatically and consistently in both
      light and dark page modes. */
  muted: "dark bg-[hsl(220_22%_18%)] text-[hsl(210_40%_96%)]",
  /** Same dark-grey scheme (kept for back-compat in act-track). */
  deep: "dark bg-[hsl(220_22%_18%)] text-[hsl(210_40%_96%)]",
  /** Full dark — reserved for the chaos section only. */
  dark: "dark bg-[hsl(222_47%_6%)] text-[hsl(210_40%_94%)]",
  /** All previously-tinted tones now fold into the two-grey scheme. */
  gold: "dark bg-[hsl(220_22%_18%)] text-[hsl(210_40%_96%)]",
  warm: "bg-background",
  cool: "dark bg-[hsl(220_22%_18%)] text-[hsl(210_40%_96%)]",
};

/**
 * Standardized section wrapper used across the home story and platform
 * deep-dive pages. Provides the eyebrow → title → intro → content pattern
 * with consistent vertical rhythm and motion-on-scroll.
 */
export function SectionShell({
  eyebrow,
  title,
  intro,
  tone = "default",
  fullBleed = false,
  id,
  headingAlign = "left",
  className,
  innerClassName,
  children,
}: SectionShellProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.18 });

  const headingBlock = (eyebrow || title || intro) && (
    <motion.header
      initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, ease: EASE_OUT_QUART }}
      className={cn(
        "max-w-3xl",
        headingAlign === "center" && "mx-auto text-center",
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "inline-block text-[11px] font-semibold uppercase tracking-[0.16em] mb-3",
            // Only `default` and `warm` keep light bgs — they use the
            // theme-aware muted-foreground. Every other tone applies the
            // `.dark` scope and explicit light text, so descendants
            // inherit white-ish text automatically.
            tone === "default" || tone === "warm"
              ? "text-muted-foreground"
              : "text-inherit opacity-60",
          )}
        >
          {eyebrow}
        </span>
      )}
      {title && (
        <h2
          className={cn(
            "text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-4",
            // Default tone uses theme-aware text-foreground; dark/gold inherit
            // section-level color so the title stays legible on tinted bgs.
            // `default` and `warm` are the only light-bg tones — they use
            // theme-aware text-foreground. Every other tone has a dark bg
            // with explicit light text, so the title inherits white.
            tone === "default" || tone === "warm"
              ? "text-foreground"
              : "text-inherit",
          )}
        >
          {title}
        </h2>
      )}
      {intro && (
        <p
          className={cn(
            "text-base sm:text-lg leading-relaxed",
            tone === "default" || tone === "warm"
              ? "text-muted-foreground"
              : "text-inherit opacity-80",
          )}
        >
          {intro}
        </p>
      )}
    </motion.header>
  );

  return (
    <section
      ref={ref}
      id={id}
      className={cn(
        "relative py-16 md:py-24",
        TONE_BG[tone],
        className,
      )}
    >
      {fullBleed ? (
        <div className={cn("w-full", innerClassName)}>
          {headingBlock}
          {headingBlock && children && <div className="mt-10 md:mt-14" />}
          {children}
        </div>
      ) : (
        <Container className={innerClassName}>
          {headingBlock}
          {headingBlock && children && <div className="mt-10 md:mt-14" />}
          {children}
        </Container>
      )}
    </section>
  );
}
