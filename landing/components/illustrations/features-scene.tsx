"use client";

import { motion, MotionConfig } from "framer-motion";

interface FeaturesSceneProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";

// 3x3 grid — indices 0 (ISF) and 4 (Compliance) are gold
const NODES: Array<{ x: number; y: number; gold: boolean }> = [
  { x: 120, y: 140, gold: true },  // 0 ISF — top-left
  { x: 200, y: 140, gold: false }, // 1
  { x: 280, y: 140, gold: false }, // 2
  { x: 120, y: 200, gold: false }, // 3
  { x: 200, y: 200, gold: true },  // 4 Compliance — center
  { x: 280, y: 200, gold: false }, // 5
  { x: 120, y: 260, gold: false }, // 6
  { x: 200, y: 260, gold: false }, // 7
  { x: 280, y: 260, gold: false }, // 8
];

// Horizontal connections: pairs [from, to]
const H_LINES: Array<[number, number]> = [
  [0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8],
];
// Vertical connections
const V_LINES: Array<[number, number]> = [
  [0, 3], [1, 4], [2, 5], [3, 6], [4, 7], [5, 8],
];

const drawVariant = (delay: number, duration = 0.35) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration, delay, ease: EASE },
  },
});

const nodeVariant = (delay: number) => ({
  hidden: { opacity: 0, scale: 0.7 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, delay, ease: EASE },
  },
});

const fadeVariant = (delay: number) => ({
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, delay, ease: EASE } },
});

export function FeaturesScene({ className }: FeaturesSceneProps) {
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
        {/* Platform container — large rounded rect */}
        <motion.rect
          x="72"
          y="92"
          width="256"
          height="216"
          rx="14"
          strokeOpacity="0.2"
          strokeWidth="1.5"
          variants={drawVariant(0, 0.6)}
        />

        {/* Connecting lines — horizontal */}
        {H_LINES.map(([a, b], i) => (
          <motion.line
            key={`h-${i}`}
            x1={NODES[a].x + 10}
            y1={NODES[a].y}
            x2={NODES[b].x - 10}
            y2={NODES[b].y}
            strokeWidth="1"
            strokeOpacity="0.3"
            variants={drawVariant(0.55 + i * 0.04, 0.25)}
          />
        ))}
        {/* Connecting lines — vertical */}
        {V_LINES.map(([a, b], i) => (
          <motion.line
            key={`v-${i}`}
            x1={NODES[a].x}
            y1={NODES[a].y + 10}
            x2={NODES[b].x}
            y2={NODES[b].y - 10}
            strokeWidth="1"
            strokeOpacity="0.3"
            variants={drawVariant(0.75 + i * 0.04, 0.25)}
          />
        ))}

        {/* Nodes */}
        {NODES.map((node, i) => (
          <motion.g key={`node-${i}`} variants={nodeVariant(0.1 + i * 0.04)}>
            <rect
              x={node.x - 10}
              y={node.y - 10}
              width="20"
              height="20"
              rx="4"
              stroke={node.gold ? GOLD : "currentColor"}
              strokeWidth={node.gold ? 2.5 : 1.75}
              fill={node.gold ? GOLD : "none"}
              fillOpacity={node.gold ? 0.15 : 0}
            />
          </motion.g>
        ))}

        {/* Gold fills fade in last */}
        {NODES.filter((n) => n.gold).map((node, i) => (
          <motion.rect
            key={`gold-fill-${i}`}
            x={node.x - 10}
            y={node.y - 10}
            width="20"
            height="20"
            rx="4"
            fill={GOLD}
            fillOpacity="0.18"
            stroke="none"
            variants={fadeVariant(0.9 + i * 0.1)}
          />
        ))}

        {/* ISF label on node 0 */}
        <motion.text
          x={NODES[0].x}
          y={NODES[0].y + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="6"
          fontFamily="monospace"
          stroke="none"
          fill={GOLD}
          variants={fadeVariant(1.1)}
        >
          ISF
        </motion.text>

        {/* "C" label on center node */}
        <motion.text
          x={NODES[4].x}
          y={NODES[4].y + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="6"
          fontFamily="monospace"
          stroke="none"
          fill={GOLD}
          variants={fadeVariant(1.2)}
        >
          ✓
        </motion.text>

        {/* Sparkle top-right */}
        <motion.g variants={nodeVariant(1.4)}>
          <motion.g
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <line x1="325" y1="108" x2="325" y2="116" stroke={GOLD} strokeWidth="1.5" />
            <line x1="321" y1="112" x2="329" y2="112" stroke={GOLD} strokeWidth="1.5" />
            <line x1="322" y1="109" x2="328" y2="115" stroke={GOLD} strokeWidth="1" strokeOpacity="0.6" />
            <line x1="328" y1="109" x2="322" y2="115" stroke={GOLD} strokeWidth="1" strokeOpacity="0.6" />
          </motion.g>
        </motion.g>

        {/* Ambient float on the whole grid */}
        <motion.g
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
      </motion.svg>
    </MotionConfig>
  );
}
