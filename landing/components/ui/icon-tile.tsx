"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants, type TargetAndTransition } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * IconTile — reusable rounded-square tile wrapping a Lucide icon with
 * framer-motion micro-interactions. Big-tech marketing-page polish
 * (Stripe / Linear / Vercel style): the *tile* moves, not the icon
 * SVG, which keeps the motion legible and avoids the "wobbly clip-art"
 * feel of fully animated icons.
 *
 * Hover modes
 *   lift   — gentle scale + rotate (default). Best for cards.
 *   spin   — quarter-rotate on hover. Good for refresh / cycle icons.
 *   pulse  — continuous breathing scale loop. Use SPARINGLY (1-2 per
 *            section) — meant for "alive" indicators like the AI bot.
 *   wiggle — tiny back-and-forth rotation on hover, like a tap.
 *
 * Entrance
 *   reveal — fades + lifts in once when scrolled into view (viewport
 *            once: true), with a per-card delay you can stagger.
 *
 * Respects prefers-reduced-motion via useReducedMotion. All animation
 * collapses to a no-op transition for users who opt out.
 */

export type IconTileHover = "lift" | "spin" | "pulse" | "wiggle";
export type IconTileTone = "gold" | "primary" | "muted" | "blue" | "emerald";
export type IconTileSize = "sm" | "md" | "lg";

const TONE_CLASS: Record<IconTileTone, string> = {
  gold: "bg-gold/15 text-gold-dark dark:text-gold",
  primary: "bg-primary/10 text-primary",
  muted: "bg-secondary text-muted-foreground",
  blue: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
};

const SIZE_CLASS: Record<IconTileSize, { tile: string; icon: number }> = {
  sm: { tile: "size-7 rounded-md", icon: 14 },
  md: { tile: "size-10 rounded-xl", icon: 18 },
  lg: { tile: "size-12 rounded-2xl", icon: 22 },
};

interface IconTileProps {
  icon: LucideIcon;
  tone?: IconTileTone;
  size?: IconTileSize;
  hover?: IconTileHover;
  /** Entrance animation when scrolled into view. */
  reveal?: boolean;
  /** Seconds of delay on reveal — pass an index * 0.06 for natural stagger. */
  revealDelay?: number;
  /** Extra Tailwind classes merged on the tile. */
  className?: string;
  /** Hide from a11y tree (decorative icons inside titled cards). Default true. */
  ariaHidden?: boolean;
  /** Accessible label when not decorative. */
  label?: string;
}

export function IconTile({
  icon: Icon,
  tone = "gold",
  size = "md",
  hover = "lift",
  reveal = false,
  revealDelay = 0,
  className,
  ariaHidden = true,
  label,
}: IconTileProps) {
  const reduce = useReducedMotion();
  const { tile, icon: iconSize } = SIZE_CLASS[size];

  // Hover variants — each mode is a single keyframe; framer-motion
  // tweens to it on enter and back to base on leave.
  const hoverAnim: Record<IconTileHover, TargetAndTransition> = {
    lift: { scale: 1.08, rotate: 4 },
    spin: { rotate: 90 },
    pulse: { scale: 1.08 },
    wiggle: { rotate: [-6, 6, -3, 0] },
  };

  // Continuous pulse loop (idle behavior) — only for hover='pulse'.
  // framer-motion v12 wants typed easing arrays; the explicit
  // easeInOut bezier + TargetAndTransition cast keeps TS happy.
  const idleAnim: TargetAndTransition | undefined =
    hover === "pulse" && !reduce
      ? {
          scale: [1, 1.04, 1],
          transition: {
            duration: 2.4,
            repeat: Infinity,
            ease: [0.42, 0, 0.58, 1] as [number, number, number, number],
          },
        }
      : undefined;

  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 8, scale: 0.92 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: revealDelay },
    },
  };

  const motionProps = reveal
    ? {
        variants: revealVariants,
        initial: "hidden" as const,
        whileInView: "visible" as const,
        viewport: { once: true, amount: 0.4 },
      }
    : {};

  return (
    <motion.div
      {...motionProps}
      animate={idleAnim}
      whileHover={reduce ? undefined : hoverAnim[hover]}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className={cn(
        "grid place-items-center shrink-0",
        tile,
        TONE_CLASS[tone],
        className,
      )}
      aria-label={label}
      aria-hidden={ariaHidden && !label ? true : undefined}
      role={label ? "img" : undefined}
    >
      <Icon size={iconSize} />
    </motion.div>
  );
}
