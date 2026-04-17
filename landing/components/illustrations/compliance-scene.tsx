"use client";

import { motion, MotionConfig } from "framer-motion";

interface ComplianceSceneProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";

// Semi-circular gauge: center (200, 240), radius 110
// Arc spans 180° from left (-180°) to right (0°) — standard speedometer
// SVG arc: start at (90, 240), end at (310, 240), sweep upward

const R = 110; // outer radius
const r = 80;  // inner (gold fill) track
const CX = 200;
const CY = 248;

// Arc path helper: center=(cx,cy), radius=rad, from angle a1 to a2 (degrees, 0=right, ccw)
function arcPath(cx: number, cy: number, rad: number, a1: number, a2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + rad * Math.cos(toRad(a1));
  const y1 = cy + rad * Math.sin(toRad(a1));
  const x2 = cx + rad * Math.cos(toRad(a2));
  const y2 = cy + rad * Math.sin(toRad(a2));
  const largeArc = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${rad} ${rad} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// Gauge track: 180° sweep from 180° to 0° (left to right going up)
const trackPath = arcPath(CX, CY, R, 180, 0);
// Gold fill: 75% of 180° = 135°, from 180° to (180 - 135)° = 45°
const goldPath = arcPath(CX, CY, r, 180, 45);

const drawVariant = (delay: number, duration = 0.5) => ({
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
    transition: { duration: 0.45, delay, ease: EASE },
  },
});

// Tick marks at 0%, 25%, 50%, 75%, 100% → angles 180°, 157.5°, 135°, 112.5°, 90°... wait
// Speedometer: 180° = left (0), 0° = right (100%)
// 0%→180°, 45°→75%, 90°→50%, 135°→25%, 180°→0%... no
// Actually: 0% = 180° (start), 100% = 0° (end), so 75% = 180 - 0.75*180 = 45°
// Tick positions at 0%, 25%, 50%, 75%, 100%
const TICK_ANGLES = [180, 135, 90, 45, 0];
const tickMarks = TICK_ANGLES.map((angle) => {
  const rad = (angle * Math.PI) / 180;
  const outerX = CX + (R + 8) * Math.cos(rad);
  const outerY = CY + (R + 8) * Math.sin(rad);
  const innerX = CX + (R - 6) * Math.cos(rad);
  const innerY = CY + (R - 6) * Math.sin(rad);
  return { x1: innerX, y1: innerY, x2: outerX, y2: outerY };
});

// Status indicators
const STATUS = [
  { label: "Critical", color: "hsl(0 72% 51%)", x: 100, y: 320 },
  { label: "Warning", color: "hsl(38 92% 50%)", x: 200, y: 320 },
  { label: "Clean", color: "hsl(142 71% 45%)", x: 300, y: 320 },
];

export function ComplianceScene({ className }: ComplianceSceneProps) {
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
        {/* ── Gauge track (outer arc) ── */}
        <motion.path
          d={trackPath}
          strokeWidth="8"
          strokeOpacity="0.15"
          variants={drawVariant(0, 0.7)}
        />
        <motion.path
          d={trackPath}
          strokeWidth="1.75"
          strokeOpacity="0.5"
          variants={drawVariant(0, 0.7)}
        />

        {/* ── Gold fill arc (75%) ── */}
        <motion.path
          d={goldPath}
          stroke={GOLD}
          strokeWidth="8"
          strokeOpacity="0.85"
          variants={drawVariant(0.7, 0.8)}
        />

        {/* ── Tick marks ── */}
        {tickMarks.map((t, i) => (
          <motion.line
            key={`tick-${i}`}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            strokeWidth="1.5"
            strokeOpacity="0.35"
            variants={drawVariant(0.1 + i * 0.06, 0.2)}
          />
        ))}

        {/* ── Score number ── */}
        <motion.text
          x={CX}
          y={CY - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="44"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          stroke="none"
          fill="currentColor"
          variants={fadeVariant(1.4)}
        >
          75
        </motion.text>
        <motion.text
          x={CX}
          y={CY + 20}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          stroke="none"
          fill="currentColor"
          fillOpacity="0.45"
          variants={fadeVariant(1.5)}
        >
          SCORE
        </motion.text>

        {/* ── Status indicators ── */}
        {STATUS.map((s, i) => (
          <motion.g key={`status-${i}`} variants={fadeVariant(1.6 + i * 0.1, 6)}>
            <circle cx={s.x - 28} cy={s.y} r="5" stroke={s.color} strokeWidth="1.75" fill={s.color} fillOpacity="0.2" />
            <text
              x={s.x - 18}
              y={s.y + 1}
              dominantBaseline="middle"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
              stroke="none"
              fill="currentColor"
              fillOpacity="0.55"
            >
              {s.label}
            </text>
          </motion.g>
        ))}

        {/* ── Shield (top-right) ── */}
        <motion.g variants={scaleVariant(1.8)}>
          <motion.g
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
          >
            <motion.path
              d="M 318 68 L 342 78 L 342 98 Q 342 116 318 122 Q 294 116 294 98 L 294 78 Z"
              stroke={GOLD}
              strokeWidth="2.5"
              variants={drawVariant(1.8, 0.5)}
            />
            <motion.path
              d="M 306 94 l 8 9 l 16 -18"
              stroke={GOLD}
              strokeWidth="2.5"
              fill="none"
              variants={drawVariant(2.1, 0.35)}
            />
          </motion.g>
        </motion.g>

        {/* ── Needle (pointer at 75%) ── */}
        <motion.line
          x1={CX}
          y1={CY}
          x2={CX + (R - 20) * Math.cos((45 * Math.PI) / 180)}
          y2={CY + (R - 20) * Math.sin((45 * Math.PI) / 180)}
          stroke={GOLD}
          strokeWidth="2.5"
          variants={drawVariant(1.3, 0.3)}
        />
        {/* Needle center dot */}
        <motion.circle
          cx={CX}
          cy={CY}
          r="6"
          stroke="currentColor"
          strokeWidth="1.75"
          fill="none"
          variants={fadeVariant(1.35)}
        />
      </motion.svg>
    </MotionConfig>
  );
}
