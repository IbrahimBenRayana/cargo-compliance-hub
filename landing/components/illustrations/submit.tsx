"use client";

import { motion } from "framer-motion";

interface SubmitIllustrationProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const planeVariants = (delay: number) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.9, delay, ease: EASE },
  },
});

const trailVariants = (delay: number) => ({
  hidden: { opacity: 0, x: -4 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, delay, ease: EASE },
  },
});

export function SubmitIllustration({ className }: SubmitIllustrationProps) {
  return (
    <motion.svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: "drop-shadow(0 2px 8px hsl(var(--foreground) / 0.08))" }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {/*
        Paper airplane — angled ~25° nose-up, centered slightly right of canvas.
        Nose points up-right. Body is a geometric folded-paper shape.
        Center roughly (68, 54).

        Main body triangle: nose at (90,28), tail-bottom at (44,80), tail-top at (52,52)
        Fold crease: from midpoint along body
        Wing fold line: inner crease
      */}

      {/* Outer body — main triangle outline */}
      <motion.path
        d="M 88 26 L 40 72 L 58 78 Z"
        variants={planeVariants(0)}
      />

      {/* Wing fold — upper face of the plane */}
      <motion.path
        d="M 88 26 L 58 46 L 58 78"
        variants={planeVariants(0.08)}
      />

      {/* Inner crease — bottom fold from nose to crease point */}
      <motion.path
        d="M 58 46 L 40 72"
        variants={planeVariants(0.16)}
      />

      {/* Bottom wing flap — small triangular detail */}
      <motion.path
        d="M 58 78 L 68 64 L 88 26"
        strokeWidth="1.25"
        variants={planeVariants(0.24)}
      />

      {/* Gold trail marks — 3 gentle curves trailing down-left from tail */}
      {/* Trail 1 — closest to plane, shortest */}
      <motion.path
        d="M 36 76 Q 30 80 26 85"
        stroke="hsl(43 96% 56%)"
        strokeWidth="1.75"
        variants={trailVariants(0.7)}
      />

      {/* Trail 2 — medium */}
      <motion.path
        d="M 30 82 Q 23 87 18 93"
        stroke="hsl(43 96% 56%)"
        strokeWidth="1.75"
        variants={trailVariants(0.78)}
      />

      {/* Trail 3 — farthest, longest */}
      <motion.path
        d="M 24 88 Q 16 94 10 101"
        stroke="hsl(43 96% 56%)"
        strokeWidth="1.75"
        variants={trailVariants(0.86)}
      />

      {/* Small dot at end of trail for rhythm */}
      <motion.circle
        cx="8"
        cy="103"
        r="2"
        fill="hsl(43 96% 56%)"
        stroke="none"
        variants={trailVariants(0.94)}
      />
    </motion.svg>
  );
}
