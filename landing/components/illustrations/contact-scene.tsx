"use client";

import { motion, MotionConfig } from "framer-motion";

interface ContactSceneProps {
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, delay, ease: EASE } },
});

// Chat bubbles: [x, y, width, isGold]
const BUBBLES = [
  { x: 240, y: 240, w: 80, gold: false },
  { x: 252, y: 195, w: 68, gold: false },
  { x: 244, y: 152, w: 76, gold: true },
];

export function ContactScene({ className }: ContactSceneProps) {
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
        {/* ── Envelope body ── */}
        <motion.g
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          {/* Envelope rectangle */}
          <motion.rect
            x="80"
            y="200"
            width="160"
            height="110"
            rx="6"
            variants={drawVariant(0, 0.5)}
          />

          {/* Bottom V fold lines */}
          <motion.path
            d="M 80 310 L 160 260 L 240 310"
            strokeWidth="1"
            strokeOpacity="0.3"
            variants={drawVariant(0.3, 0.35)}
          />

          {/* Side fold lines */}
          <motion.path
            d="M 80 200 L 138 248"
            strokeWidth="1"
            strokeOpacity="0.25"
            variants={drawVariant(0.35, 0.3)}
          />
          <motion.path
            d="M 240 200 L 182 248"
            strokeWidth="1"
            strokeOpacity="0.25"
            variants={drawVariant(0.35, 0.3)}
          />

          {/* Open flap — V shape at top */}
          <motion.path
            d="M 80 200 L 160 245 L 240 200"
            strokeWidth="1.75"
            variants={drawVariant(0.1, 0.45)}
          />

          {/* Letter peeking out of top */}
          <motion.g variants={fadeVariant(0.65, 10)}>
            <motion.rect
              x="118"
              y="155"
              width="84"
              height="60"
              rx="3"
              strokeWidth="1.5"
              variants={drawVariant(0.65, 0.4)}
            />
            {/* Lines on the letter */}
            {[0, 1, 2].map((i) => (
              <motion.line
                key={`letter-line-${i}`}
                x1="130"
                y1={172 + i * 14}
                x2="190"
                y2={172 + i * 14}
                strokeWidth="1"
                strokeOpacity="0.3"
                variants={drawVariant(0.75 + i * 0.07, 0.2)}
              />
            ))}
          </motion.g>
        </motion.g>

        {/* ── Chat bubbles (right side, floating up) ── */}
        {BUBBLES.map((b, i) => (
          <motion.g key={`bubble-${i}`} variants={fadeVariant(0.9 + i * 0.15, 10)}>
            <motion.g
              animate={{ y: [0, -5 - i * 2, 0] }}
              transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: 1.5 + i * 0.7 }}
            >
              {/* Bubble body */}
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height="28"
                rx="8"
                stroke={b.gold ? GOLD : "currentColor"}
                strokeWidth={b.gold ? 2.5 : 1.75}
                fill={b.gold ? GOLD : "none"}
                fillOpacity={b.gold ? 0.12 : 0}
              />
              {/* Bubble tail */}
              <path
                d={`M ${b.x + 14} ${b.y + 28} L ${b.x + 10} ${b.y + 36} L ${b.x + 22} ${b.y + 28}`}
                stroke={b.gold ? GOLD : "currentColor"}
                strokeWidth={b.gold ? 2 : 1.5}
                strokeOpacity={b.gold ? 0.9 : 0.55}
              />
              {/* Lines inside bubble */}
              {[0].map((l) => (
                <line
                  key={`bline-${l}`}
                  x1={b.x + 12}
                  y1={b.y + 14 + l * 8}
                  x2={b.x + b.w - 12}
                  y2={b.y + 14 + l * 8}
                  stroke={b.gold ? GOLD : "currentColor"}
                  strokeWidth="1"
                  strokeOpacity={b.gold ? 0.5 : 0.25}
                />
              ))}
            </motion.g>
          </motion.g>
        ))}

        {/* ── "@" symbol ── */}
        <motion.g variants={fadeVariant(1.4)}>
          <motion.g
            animate={{ rotate: [0, 5, 0, -3, 0] }}
            style={{ transformOrigin: "88px 155px" }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          >
            <circle
              cx="88"
              cy="155"
              r="18"
              strokeWidth="1.5"
              strokeOpacity="0.35"
            />
            <text
              x="88"
              y="156"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="16"
              fontFamily="monospace"
              fontWeight="700"
              stroke="none"
              fill="currentColor"
              fillOpacity="0.3"
            >
              @
            </text>
          </motion.g>
        </motion.g>
      </motion.svg>
    </MotionConfig>
  );
}
