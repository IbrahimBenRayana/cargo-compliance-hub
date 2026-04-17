"use client";

import { motion, MotionConfig } from "framer-motion";

interface IsfSceneProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";

const drawVariant = (delay: number, duration = 0.35) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration, delay, ease: EASE },
  },
});

const fadeVariant = (delay: number, y = 0) => ({
  hidden: { opacity: 0, y },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: EASE } },
});

const scaleVariant = (delay: number) => ({
  hidden: { opacity: 0, scale: 0.7 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, delay, ease: EASE },
  },
});

export function IsfScene({ className }: IsfSceneProps) {
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
        {/* ── Document / Form (center-left, tilted -4°) ── */}
        <motion.g
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <g transform="rotate(-4, 165, 200)">
            {/* Document body */}
            <motion.rect
              x="90"
              y="100"
              width="150"
              height="200"
              rx="6"
              variants={drawVariant(0, 0.6)}
            />
            {/* Corner fold */}
            <motion.path
              d="M 220 100 L 240 120 L 220 120 Z"
              strokeWidth="1"
              strokeOpacity="0.4"
              variants={drawVariant(0.1, 0.3)}
            />

            {/* "ISF" header */}
            <motion.text
              x="165"
              y="130"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="14"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="2"
              stroke="none"
              fill="currentColor"
              fillOpacity="0.7"
              variants={fadeVariant(0.5)}
            >
              ISF
            </motion.text>

            {/* Divider line under header */}
            <motion.line
              x1="110"
              y1="145"
              x2="220"
              y2="145"
              strokeWidth="1"
              strokeOpacity="0.25"
              variants={drawVariant(0.55, 0.3)}
            />

            {/* 5 field lines */}
            {[0, 1, 2, 3, 4].map((row) => (
              <motion.line
                key={`field-${row}`}
                x1="110"
                y1={165 + row * 26}
                x2="220"
                y2={165 + row * 26}
                strokeWidth="1"
                strokeOpacity="0.3"
                variants={drawVariant(0.6 + row * 0.07, 0.25)}
              />
            ))}

            {/* 3 gold checkmarks (completed fields) */}
            {[0, 1, 2].map((row) => (
              <motion.path
                key={`check-${row}`}
                d={`M ${110} ${158 + row * 26} l 5 5 l 8 -9`}
                stroke={GOLD}
                strokeWidth="2.5"
                fill="none"
                variants={drawVariant(0.85 + row * 0.1, 0.3)}
              />
            ))}

            {/* 2 "in progress" dots on remaining fields */}
            {[3, 4].map((row) => (
              <motion.circle
                key={`dot-${row}`}
                cx="116"
                cy={162 + row * 26}
                r="3"
                strokeWidth="1"
                strokeOpacity="0.35"
                variants={fadeVariant(1.05 + (row - 3) * 0.1)}
              />
            ))}
          </g>
        </motion.g>

        {/* ── Small container ship (bottom-right) ── */}
        <motion.g variants={fadeVariant(1.1, 8)}>
          <motion.g
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
          >
            {/* Hull */}
            <motion.path
              d="M 260 310 L 270 290 L 370 290 L 380 310 Z"
              variants={drawVariant(1.1, 0.5)}
            />
            {/* 3 stacked containers on deck */}
            {[0, 1, 2].map((col) => (
              <motion.rect
                key={`ship-cont-${col}`}
                x={278 + col * 28}
                y={272}
                width="24"
                height="18"
                rx="2"
                strokeWidth="1.5"
                variants={drawVariant(1.25 + col * 0.07, 0.25)}
              />
            ))}
            {/* Deck line */}
            <motion.line
              x1="270"
              y1="290"
              x2="370"
              y2="290"
              strokeWidth="1"
              strokeOpacity="0.4"
              variants={drawVariant(1.2, 0.3)}
            />
          </motion.g>
        </motion.g>

        {/* ── Wave lines under ship ── */}
        {[0, 1].map((i) => (
          <motion.path
            key={`wave-${i}`}
            d={`M ${255 + i * 5} ${320 + i * 10} Q ${295 + i * 5} ${315 + i * 10} ${330 + i * 5} ${320 + i * 10} Q ${365 + i * 5} ${325 + i * 10} ${390 + i * 5} ${320 + i * 10}`}
            strokeWidth="1"
            strokeOpacity="0.2"
            animate={{ x: [0, -5, 0] }}
            transition={{ duration: 7 + i * 2, repeat: Infinity, ease: "easeInOut", delay: 1 + i }}
            variants={drawVariant(1.4 + i * 0.1, 0.4)}
          />
        ))}

        {/* ── APPROVED stamp (top-right) ── */}
        <motion.g variants={scaleVariant(1.3)}>
          <motion.g
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          >
            {/* Outer circle */}
            <motion.circle
              cx="320"
              cy="140"
              r="38"
              stroke={GOLD}
              strokeWidth="2.5"
              variants={drawVariant(1.3, 0.5)}
            />
            {/* Inner circle */}
            <motion.circle
              cx="320"
              cy="140"
              r="30"
              stroke={GOLD}
              strokeWidth="1"
              strokeOpacity="0.4"
              variants={drawVariant(1.4, 0.4)}
            />
            {/* Gold check inside */}
            <motion.path
              d="M 306 140 l 9 10 l 18 -20"
              stroke={GOLD}
              strokeWidth="2.5"
              fill="none"
              variants={drawVariant(1.6, 0.4)}
            />
            {/* "APPROVED" text */}
            <motion.text
              x="320"
              y="168"
              textAnchor="middle"
              fontSize="7"
              fontFamily="monospace"
              letterSpacing="1.5"
              stroke="none"
              fill={GOLD}
              fillOpacity="0.8"
              variants={fadeVariant(1.7)}
            >
              APPROVED
            </motion.text>
          </motion.g>
        </motion.g>
      </motion.svg>
    </MotionConfig>
  );
}
