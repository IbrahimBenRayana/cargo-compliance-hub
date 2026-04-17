"use client";

import { motion } from "framer-motion";

interface ValidateIllustrationProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const shieldVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.9, ease: EASE },
  },
};

const dashVariants = (delay: number) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 0.5,
    transition: { duration: 0.3, delay, ease: EASE },
  },
});

const checkVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.5, delay: 1.1, ease: EASE },
  },
};

export function ValidateIllustration({ className }: ValidateIllustrationProps) {
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
        Shield outline — classic shape.
        Rounded top ~64px wide, pinches to point at bottom center.
        Center: 60, 60. Top ~24, bottom ~98.
      */}
      <motion.path
        d="M 60 20 L 28 32 L 28 62 C 28 80 42 92 60 100 C 78 92 92 80 92 62 L 92 32 Z"
        variants={shieldVariants}
      />

      {/* Sparkle dash marks around shield — top-left, top-right, top-center above */}
      {/* Top-left dash */}
      <motion.line
        x1="30"
        y1="18"
        x2="24"
        y2="13"
        variants={dashVariants(0.5)}
      />
      {/* Top-right dash */}
      <motion.line
        x1="90"
        y1="18"
        x2="96"
        y2="13"
        variants={dashVariants(0.58)}
      />
      {/* Top-center dash — slightly above shield */}
      <motion.line
        x1="60"
        y1="15"
        x2="60"
        y2="9"
        variants={dashVariants(0.66)}
      />

      {/* Checkmark in gold — triumphant, slightly thick */}
      <motion.path
        d="M 44 60 L 55 72 L 76 46"
        stroke="hsl(43 96% 56%)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={checkVariants}
      />
    </motion.svg>
  );
}
