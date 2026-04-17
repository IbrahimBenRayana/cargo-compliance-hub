"use client";

import { motion, MotionConfig } from "framer-motion";

interface AboutSceneProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";

const drawVariant = (delay: number, duration = 0.45) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration, delay, ease: EASE },
  },
});

const fadeVariant = (delay: number, y = 0) => ({
  hidden: { opacity: 0, y },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, delay, ease: EASE } },
});

const scaleVariant = (delay: number) => ({
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, delay, ease: EASE },
  },
});

export function AboutScene({ className }: AboutSceneProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.svg
        viewBox="0 0 400 400"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 8px 24px hsl(var(--foreground) / 0.06))" }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        aria-hidden
      >
        {/* ── Lighthouse body (tapered rect) ── */}
        <motion.path
          d="M 152 320 L 162 140 L 218 140 L 228 320 Z"
          strokeWidth="1.75"
          variants={drawVariant(0, 0.7)}
        />

        {/* Horizontal stripes on body */}
        {[0, 1, 2].map((i) => (
          <motion.line
            key={`stripe-${i}`}
            x1={155 + i * 2}
            y1={200 + i * 40}
            x2={225 - i * 2}
            y2={200 + i * 40}
            strokeWidth="1"
            strokeOpacity="0.3"
            variants={drawVariant(0.25 + i * 0.08, 0.25)}
          />
        ))}

        {/* Door at bottom */}
        <motion.path
          d="M 181 320 L 181 295 Q 190 285 199 295 L 199 320"
          strokeWidth="1.25"
          strokeOpacity="0.45"
          variants={drawVariant(0.3, 0.3)}
        />

        {/* Window */}
        <motion.rect
          x="182"
          y="245"
          width="16"
          height="14"
          rx="2"
          strokeWidth="1.25"
          strokeOpacity="0.5"
          variants={drawVariant(0.35, 0.25)}
        />

        {/* ── Dome / lantern room ── */}
        <motion.path
          d="M 158 140 Q 158 118 190 114 Q 222 118 222 140 Z"
          variants={drawVariant(0.5, 0.4)}
        />

        {/* Dome top cap */}
        <motion.path
          d="M 182 114 Q 190 106 198 114"
          variants={drawVariant(0.6, 0.3)}
        />

        {/* Gold glow circle at light source */}
        <motion.circle
          cx="190"
          cy="127"
          r="8"
          fill={GOLD}
          fillOpacity="0.25"
          stroke={GOLD}
          strokeWidth="2"
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.15, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          variants={fadeVariant(0.85)}
        />

        {/* ── Light beam lines (diverging to the right) ── */}
        <motion.line
          x1={198}
          y1={122}
          x2={340}
          y2={88}
          strokeWidth="1.25"
          strokeOpacity="0.2"
          stroke={GOLD}
          variants={drawVariant(0.9, 0.5)}
        />
        <motion.line
          x1={198}
          y1={132}
          x2={345}
          y2={132}
          strokeWidth="1.5"
          strokeOpacity="0.25"
          stroke={GOLD}
          variants={drawVariant(0.95, 0.5)}
        />
        <motion.line
          x1={198}
          y1={140}
          x2={338}
          y2={176}
          strokeWidth="1.25"
          strokeOpacity="0.2"
          stroke={GOLD}
          variants={drawVariant(1.0, 0.5)}
        />

        {/* ── Waves at base ── */}
        {[0, 1].map((i) => (
          <motion.path
            key={`wave-${i}`}
            d={`M ${120 + i * 8} ${330 + i * 10} Q ${160 + i * 8} ${324 + i * 10} ${200 + i * 8} ${330 + i * 10} Q ${240 + i * 8} ${336 + i * 10} ${280 + i * 8} ${330 + i * 10}`}
            strokeWidth="1"
            strokeOpacity="0.25"
            animate={{ x: [0, -6, 0] }}
            transition={{ duration: 7 + i * 2, repeat: Infinity, ease: "easeInOut", delay: 1 + i * 0.8 }}
            variants={drawVariant(1.1 + i * 0.1, 0.35)}
          />
        ))}

        {/* ── Compass rose (top-right) ── */}
        <motion.g variants={scaleVariant(1.3)}>
          <motion.circle
            cx="318"
            cy="88"
            r="30"
            strokeWidth="1.25"
            strokeOpacity="0.35"
            variants={drawVariant(1.3, 0.4)}
          />
          {/* N/S axis */}
          <motion.line x1="318" y1="60" x2="318" y2="116" strokeWidth="1.25" strokeOpacity="0.45" variants={drawVariant(1.4, 0.3)} />
          {/* E/W axis */}
          <motion.line x1="290" y1="88" x2="346" y2="88" strokeWidth="1.25" strokeOpacity="0.45" variants={drawVariant(1.45, 0.3)} />
          {/* Diagonal ticks */}
          <motion.line x1="298" y1="68" x2="302" y2="72" strokeWidth="1" strokeOpacity="0.3" variants={drawVariant(1.5, 0.2)} />
          <motion.line x1="334" y1="68" x2="338" y2="72" strokeWidth="1" strokeOpacity="0.3" variants={drawVariant(1.5, 0.2)} />
          <motion.line x1="298" y1="104" x2="302" y2="108" strokeWidth="1" strokeOpacity="0.3" variants={drawVariant(1.5, 0.2)} />
          <motion.line x1="334" y1="104" x2="338" y2="108" strokeWidth="1" strokeOpacity="0.3" variants={drawVariant(1.5, 0.2)} />
          {/* N label */}
          <motion.text
            x="318"
            y="57"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="700"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.5"
            variants={fadeVariant(1.6)}
          >
            N
          </motion.text>
          {/* Center dot */}
          <circle cx="318" cy="88" r="3" fill="currentColor" fillOpacity="0.3" stroke="none" />
        </motion.g>
      </motion.svg>
    </MotionConfig>
  );
}
