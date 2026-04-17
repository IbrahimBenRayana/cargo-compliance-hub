"use client";

import { motion } from "framer-motion";

interface CreateIllustrationProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const pageVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.8, ease: EASE },
  },
};

const lineVariants = (delay: number) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.3, delay, ease: EASE },
  },
});

const sparkleVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.1, 1],
    opacity: 1,
    transition: { duration: 0.4, delay: 1.1, ease: EASE },
  },
};

export function CreateIllustration({ className }: CreateIllustrationProps) {
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
      {/* Page group — slightly tilted -6° via SVG transform */}
      <g transform="rotate(-6, 60, 58)">
        {/* Page outline — rounded corners */}
        <motion.path
          d="M 37 22 Q 37 15 44 15 L 76 15 Q 83 15 83 22 L 83 94 Q 83 101 76 101 L 44 101 Q 37 101 37 94 Z"
          variants={pageVariants}
        />

        {/* Title stroke — bolder, shorter, top area of page */}
        <motion.line
          x1="47"
          y1="34"
          x2="68"
          y2="31"
          strokeWidth="2.25"
          variants={lineVariants(0.4)}
        />

        {/* Text row 1 — long */}
        <motion.line
          x1="47"
          y1="46"
          x2="73"
          y2="43"
          variants={lineVariants(0.5)}
        />

        {/* Text row 2 — medium-short */}
        <motion.line
          x1="47"
          y1="57"
          x2="65"
          y2="54"
          variants={lineVariants(0.6)}
        />

        {/* Text row 3 — long */}
        <motion.line
          x1="47"
          y1="68"
          x2="72"
          y2="65"
          variants={lineVariants(0.7)}
        />

        {/* Text row 4 — short (like a paragraph end) */}
        <motion.line
          x1="47"
          y1="79"
          x2="59"
          y2="77"
          variants={lineVariants(0.8)}
        />
      </g>

      {/* Gold sparkle — 4-pointed star, top-right outside page ~(85, 18) */}
      <motion.g
        stroke="hsl(43 96% 56%)"
        strokeWidth="1.75"
        variants={sparkleVariants}
        style={{ originX: "86px", originY: "17px" }}
      >
        {/* Vertical arm */}
        <motion.line x1="86" y1="11" x2="86" y2="23" />
        {/* Horizontal arm */}
        <motion.line x1="80" y1="17" x2="92" y2="17" />
        {/* Diagonal arms (shorter, for diamond-point feel) */}
        <motion.line x1="82" y1="13" x2="90" y2="21" strokeWidth="1" />
        <motion.line x1="90" y1="13" x2="82" y2="21" strokeWidth="1" />
      </motion.g>
    </motion.svg>
  );
}
