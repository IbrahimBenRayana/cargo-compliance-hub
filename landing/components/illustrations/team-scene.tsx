"use client";

import { motion, MotionConfig } from "framer-motion";

interface TeamSceneProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";

const CX = 200;
const CY = 185;
const SPOKE_DIST = 90;

// 4 members at 45°, 135°, 225°, 315°
const MEMBER_ANGLES = [45, 135, 225, 315];
const members = MEMBER_ANGLES.map((angle) => {
  const rad = (angle * Math.PI) / 180;
  return {
    x: CX + SPOKE_DIST * Math.cos(rad),
    y: CY + SPOKE_DIST * Math.sin(rad),
  };
});

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
  hidden: { opacity: 0, scale: 0.7 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, delay, ease: EASE },
  },
});

// Simple person icon: head circle + shoulders arc
function PersonIcon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const headR = r * 0.28;
  const headCY = cy - r * 0.15;
  const shoulderY = cy + r * 0.2;
  const shoulderW = r * 0.55;
  return (
    <>
      <circle cx={cx} cy={headCY} r={headR} strokeWidth="1.25" strokeOpacity="0.7" />
      <path
        d={`M ${cx - shoulderW} ${shoulderY + r * 0.15} Q ${cx} ${shoulderY - r * 0.05} ${cx + shoulderW} ${shoulderY + r * 0.15}`}
        strokeWidth="1.25"
        strokeOpacity="0.7"
      />
    </>
  );
}

export function TeamScene({ className }: TeamSceneProps) {
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
        {/* ── Connecting lines (center to each member) ── */}
        {members.map((m, i) => (
          <motion.line
            key={`spoke-${i}`}
            x1={CX}
            y1={CY}
            x2={m.x}
            y2={m.y}
            strokeWidth="1"
            strokeOpacity="0.25"
            variants={drawVariant(0.4 + i * 0.07, 0.35)}
          />
        ))}

        {/* ── Center person (team lead) ── */}
        <motion.g variants={scaleVariant(0)}>
          <motion.g
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <circle cx={CX} cy={CY} r="40" strokeWidth="1.75" />
            <PersonIcon cx={CX} cy={CY} r={40} />
          </motion.g>
        </motion.g>

        {/* ── Gold ring on center circle ── */}
        <motion.circle
          cx={CX}
          cy={CY}
          r="44"
          stroke={GOLD}
          strokeWidth="2.5"
          strokeOpacity="0.7"
          variants={drawVariant(0.5, 0.6)}
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.02, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />

        {/* ── Member circles ── */}
        {members.map((m, i) => (
          <motion.g key={`member-${i}`} variants={fadeVariant(0.65 + i * 0.1, 4)}>
            <circle cx={m.x} cy={m.y} r="20" strokeWidth="1.75" />
            <PersonIcon cx={m.x} cy={m.y} r={20} />
          </motion.g>
        ))}

        {/* ── Org chart box under bottom member ── */}
        <motion.g variants={fadeVariant(1.2, 6)}>
          {/* Connect line from bottom member down */}
          <line
            x1={members[2].x}
            y1={members[2].y + 20}
            x2={members[2].x}
            y2={members[2].y + 38}
            strokeWidth="1"
            strokeOpacity="0.3"
          />
          <rect
            x={members[2].x - 28}
            y={members[2].y + 38}
            width="56"
            height="22"
            rx="4"
            strokeWidth="1.25"
            strokeOpacity="0.4"
          />
          <text
            x={members[2].x}
            y={members[2].y + 52}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7"
            fontFamily="system-ui, sans-serif"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.4"
          >
            Multi-org
          </text>
        </motion.g>

        {/* ── "Admin" label on center circle ── */}
        <motion.text
          x={CX}
          y={CY + 28}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          stroke="none"
          fill={GOLD}
          fillOpacity="0.9"
          variants={fadeVariant(0.6)}
        >
          Admin
        </motion.text>
      </motion.svg>
    </MotionConfig>
  );
}
