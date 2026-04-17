"use client";

import { motion, MotionConfig } from "framer-motion";

interface PricingSceneProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";

const drawVariant = (delay: number, duration = 0.4) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration, delay, ease: EASE },
  },
});

const fadeVariant = (delay: number, y = 0) => ({
  hidden: { opacity: 0, y },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay, ease: EASE } },
});

const scaleVariant = (delay: number) => ({
  hidden: { opacity: 0, scale: 0.75 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, delay, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] },
  },
});

// Scale geometry
const POLE_X = 200;
const POLE_TOP = 100;
const POLE_BOT = 300;
const BEAM_Y = 130;
const BEAM_W = 130; // half-width from center

// Left pan (filings) — slightly lower to show imbalance
const L_PAN_X = POLE_X - BEAM_W;
const L_PAN_Y = 230; // lower side

// Right pan (coin) — slightly higher
const R_PAN_X = POLE_X + BEAM_W;
const R_PAN_Y = 195; // higher (lighter)

// Beam endpoint adjustments based on pan droop
const BEAM_L_Y = BEAM_Y + (L_PAN_Y - 195) * 0.25;
const BEAM_R_Y = BEAM_Y + (R_PAN_Y - 195) * 0.25;

export function PricingScene({ className }: PricingSceneProps) {
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
        {/* ── Pole ── */}
        <motion.line
          x1={POLE_X}
          y1={POLE_TOP}
          x2={POLE_X}
          y2={POLE_BOT}
          strokeWidth="2"
          variants={drawVariant(0, 0.4)}
        />

        {/* Fulcrum triangle at bottom */}
        <motion.path
          d={`M ${POLE_X - 18} ${POLE_BOT} L ${POLE_X} ${POLE_BOT - 22} L ${POLE_X + 18} ${POLE_BOT} Z`}
          variants={drawVariant(0.1, 0.3)}
        />

        {/* Base bar */}
        <motion.line
          x1={POLE_X - 30}
          y1={POLE_BOT}
          x2={POLE_X + 30}
          y2={POLE_BOT}
          strokeWidth="2"
          variants={drawVariant(0.15, 0.25)}
        />

        {/* ── Beam ── */}
        <motion.path
          d={`M ${POLE_X - BEAM_W} ${BEAM_L_Y} L ${POLE_X} ${BEAM_Y} L ${POLE_X + BEAM_W} ${BEAM_R_Y}`}
          strokeWidth="2"
          variants={drawVariant(0.3, 0.5)}
        />

        {/* ── Left pan strings ── */}
        <motion.line
          x1={POLE_X - BEAM_W}
          y1={BEAM_L_Y}
          x2={L_PAN_X - 22}
          y2={L_PAN_Y - 10}
          strokeWidth="1"
          strokeOpacity="0.5"
          variants={drawVariant(0.55, 0.3)}
        />
        <motion.line
          x1={POLE_X - BEAM_W}
          y1={BEAM_L_Y}
          x2={L_PAN_X + 22}
          y2={L_PAN_Y - 10}
          strokeWidth="1"
          strokeOpacity="0.5"
          variants={drawVariant(0.55, 0.3)}
        />

        {/* ── Left pan (ellipse / disc) ── */}
        <motion.ellipse
          cx={L_PAN_X}
          cy={L_PAN_Y}
          rx="28"
          ry="6"
          variants={drawVariant(0.65, 0.3)}
        />

        {/* 3 filing rectangles stacked on left pan */}
        {[0, 1, 2].map((row) => (
          <motion.rect
            key={`filing-${row}`}
            x={L_PAN_X - 20}
            y={L_PAN_Y - 16 - row * 14}
            width="40"
            height="11"
            rx="2"
            strokeWidth="1.5"
            variants={fadeVariant(0.75 + row * 0.1, 4)}
          />
        ))}

        {/* "+1" tag near filing stack */}
        <motion.g variants={fadeVariant(1.05, 6)}>
          <text
            x={L_PAN_X + 30}
            y={L_PAN_Y - 28}
            fontSize="11"
            fontFamily="monospace"
            fontWeight="700"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.4"
          >
            +1
          </text>
        </motion.g>

        {/* ── Right pan strings ── */}
        <motion.line
          x1={POLE_X + BEAM_W}
          y1={BEAM_R_Y}
          x2={R_PAN_X - 22}
          y2={R_PAN_Y - 10}
          strokeWidth="1"
          strokeOpacity="0.5"
          variants={drawVariant(0.55, 0.3)}
        />
        <motion.line
          x1={POLE_X + BEAM_W}
          y1={BEAM_R_Y}
          x2={R_PAN_X + 22}
          y2={R_PAN_Y - 10}
          strokeWidth="1"
          strokeOpacity="0.5"
          variants={drawVariant(0.55, 0.3)}
        />

        {/* ── Right pan (disc) ── */}
        <motion.ellipse
          cx={R_PAN_X}
          cy={R_PAN_Y}
          rx="28"
          ry="6"
          variants={drawVariant(0.65, 0.3)}
        />

        {/* Coin circle on right pan */}
        <motion.g variants={scaleVariant(0.9)}>
          <motion.circle
            cx={R_PAN_X}
            cy={R_PAN_Y - 22}
            r="20"
            stroke={GOLD}
            strokeWidth="2.5"
            variants={drawVariant(0.9, 0.4)}
          />
          {/* "$" inside coin */}
          <motion.text
            x={R_PAN_X}
            y={R_PAN_Y - 21}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="16"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
            stroke="none"
            fill={GOLD}
            variants={fadeVariant(1.1)}
          >
            $
          </motion.text>
          {/* Ambient pulse */}
          <motion.circle
            cx={R_PAN_X}
            cy={R_PAN_Y - 22}
            r="24"
            fill={GOLD}
            fillOpacity="0.06"
            stroke="none"
            animate={{ scale: [1, 1.12, 1], opacity: [0.06, 0.18, 0.06] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </motion.g>

        {/* Ambient gentle sway on the beam group */}
        <motion.g
          animate={{ rotate: [0, 0.8, 0, -0.5, 0] }}
          style={{ transformOrigin: `${POLE_X}px ${BEAM_Y}px` }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
      </motion.svg>
    </MotionConfig>
  );
}
