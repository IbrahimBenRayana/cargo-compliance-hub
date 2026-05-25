"use client";

import { motion } from "framer-motion";

interface HeroSceneProps {
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";

// ─── Variants ────────────────────────────────────────────────────────────────

const sceneVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: EASE },
  },
};

const shipVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.9, delay: 0.2, ease: EASE },
  },
};

const drawVariant = (delay: number, duration = 0.3) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration, delay, ease: EASE },
  },
});

const fadeInVariant = (delay: number) => ({
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: EASE },
  },
});

const scaleInVariant = (delay: number) => ({
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, delay, ease: EASE },
  },
});

// Container data: [x, y, width, height, isGold]
type ContainerDef = [number, number, number, number, boolean];
const CONTAINERS: ContainerDef[] = [
  // Row 2 (upper) — 7 containers across
  [58, 222, 28, 18, true],  // gold accent — top left
  [90, 222, 28, 18, false],
  [122, 222, 28, 18, false],
  [154, 222, 28, 18, false],
  [186, 222, 28, 18, false],
  [218, 222, 28, 18, false],
  [250, 222, 28, 18, false],
  // Row 1 (lower, on deck) — 8 containers across
  [58, 243, 28, 18, false],
  [90, 243, 28, 18, false],
  [122, 243, 28, 18, false],
  [154, 243, 28, 18, false],
  [186, 243, 28, 18, false],
  [218, 243, 28, 18, false],
  [250, 243, 28, 18, false],
  [282, 243, 28, 18, false],
];


export function HeroScene({ className }: HeroSceneProps) {
  return (
    <motion.svg
      viewBox="0 0 560 480"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        filter: "drop-shadow(0 8px 24px hsl(var(--foreground) / 0.06))",
      }}
      variants={sceneVariants}
      initial="hidden"
      animate="visible"
      aria-hidden
    >
      {/* ── LAYER 1: Background — horizon + water ─────────────────────── */}

      {/* Horizon line */}
      <line
        x1="20"
        y1="310"
        x2="540"
        y2="310"
        strokeOpacity="0.15"
        strokeDasharray="4 6"
      />

      {/* Water waves — animated horizontal drift */}
      {[
        { y: 328, amplitude: 6, phase: 0, duration: 9 },
        { y: 346, amplitude: 5, phase: 30, duration: 11 },
        { y: 364, amplitude: 4, phase: 60, duration: 8 },
      ].map((wave, i) => {
        const pts = Array.from({ length: 17 }, (_, j) => {
          const x = j * 36;
          const yOff =
            wave.amplitude *
            Math.sin(((x + wave.phase) * Math.PI) / 72);
          return `${j === 0 ? "M" : "L"} ${x} ${wave.y + yOff}`;
        }).join(" ");
        return (
          <motion.path
            key={`wave-${i}`}
            d={pts}
            strokeWidth="1"
            strokeOpacity="0.25"
            animate={{ x: [0, -8, 0] }}
            transition={{
              duration: wave.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 1.5 + 2,
            }}
          />
        );
      })}

      {/* ── LAYER 2: Ship ─────────────────────────────────────────────── */}

      <motion.g variants={shipVariants}>
        {/* Bob animation wraps the whole ship */}
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        >
          {/* Hull — trapezoidal outline */}
          {/* Main hull body */}
          <motion.path
            d="M 40 294 L 60 262 L 310 262 L 340 294 Z"
            variants={drawVariant(0.25, 0.7)}
          />

          {/* Gold waterline stripe */}
          <motion.path
            d="M 42 294 L 60 285 L 310 285 L 338 294"
            stroke={GOLD}
            strokeWidth="4"
            strokeOpacity="0.9"
            fill="none"
            variants={drawVariant(0.35, 0.6)}
          />

          {/* Bow detail — triangular curve at right */}
          <motion.path
            d="M 310 262 Q 332 268 340 294"
            variants={drawVariant(0.4, 0.4)}
          />

          {/* Stern at left */}
          <motion.path
            d="M 60 262 Q 46 272 40 294"
            variants={drawVariant(0.4, 0.4)}
          />

          {/* Bridge / superstructure — front-right of hull */}
          <motion.rect
            x="262"
            y="224"
            width="44"
            height="38"
            rx="2"
            variants={drawVariant(0.5, 0.4)}
          />

          {/* Bridge windows (3 small port-holes) */}
          {[272, 284, 296].map((wx, i) => (
            <motion.rect
              key={`win-${i}`}
              x={wx}
              y="230"
              width="7"
              height="6"
              rx="1"
              strokeWidth="1"
              variants={drawVariant(0.55 + i * 0.05, 0.25)}
            />
          ))}

          {/* Funnel / smokestack on bridge */}
          <motion.rect
            x="276"
            y="212"
            width="10"
            height="14"
            rx="2"
            variants={drawVariant(0.6, 0.3)}
          />
          {/* Gold cap on funnel */}
          <motion.path
            d="M 274 212 Q 281 208 288 212"
            stroke={GOLD}
            strokeWidth="2.5"
            variants={drawVariant(0.65, 0.25)}
          />

          {/* Deck line on top of hull */}
          <motion.line
            x1="60"
            y1="262"
            x2="310"
            y2="262"
            strokeWidth="1"
            strokeOpacity="0.5"
            variants={drawVariant(0.3, 0.5)}
          />

          {/* ── LAYER 3: Containers ───────────────────────────────────── */}
          {CONTAINERS.map(([cx, cy, cw, ch, isGold], idx) => {
            const delay = 0.7 + idx * 0.04;
            return (
              <motion.g key={`cont-${idx}`} variants={drawVariant(delay, 0.3)}>
                <rect
                  x={cx}
                  y={cy}
                  width={cw}
                  height={ch}
                  rx="1.5"
                  fill={isGold ? GOLD : "none"}
                  fillOpacity={isGold ? 0.18 : 0}
                  stroke={isGold ? GOLD : "currentColor"}
                  strokeWidth="1.75"
                />
                {/* Vertical divider line on each container */}
                <line
                  x1={cx + cw / 2}
                  y1={cy + 3}
                  x2={cx + cw / 2}
                  y2={cy + ch - 3}
                  strokeWidth="0.75"
                  strokeOpacity="0.4"
                  stroke={isGold ? GOLD : "currentColor"}
                />
              </motion.g>
            );
          })}

          {/* Ground container on dock (left side, slightly off-ship) */}
          <motion.g variants={drawVariant(1.3, 0.3)}>
            <rect
              x="14"
              y="300"
              width="28"
              height="18"
              rx="1.5"
              strokeWidth="1.5"
            />
            <line
              x1="28"
              y1="303"
              x2="28"
              y2="315"
              strokeWidth="0.75"
              strokeOpacity="0.4"
            />
          </motion.g>
        </motion.g>
      </motion.g>

      {/* ── LAYER 4a: Clipboard / document ───────────────────────────── */}

      <motion.g variants={fadeInVariant(1.2)}>
        {/* Gentle float loop */}
        <motion.g
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2.2,
          }}
        >
          {/* Clipboard outer rect, rotated -8° */}
          <g transform="rotate(-8, 395, 130)">
            {/* Clip at top */}
            <motion.path
              d="M 378 68 Q 378 62 384 62 L 406 62 Q 412 62 412 68"
              strokeWidth="2"
              variants={drawVariant(1.2, 0.3)}
            />
            {/* Clip center rect */}
            <motion.rect
              x="383"
              y="62"
              width="24"
              height="10"
              rx="3"
              variants={drawVariant(1.25, 0.2)}
            />

            {/* Main body */}
            <motion.rect
              x="360"
              y="70"
              width="80"
              height="115"
              rx="4"
              variants={drawVariant(1.2, 0.5)}
            />

            {/* "ISF" label at top */}
            <motion.text
              x="395"
              y="91"
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              letterSpacing="1"
              stroke="none"
              fill="currentColor"
              fillOpacity="0.5"
              variants={fadeInVariant(1.4)}
            >
              ISF 10+2
            </motion.text>

            {/* 5 field lines */}
            {[0, 1, 2, 3, 4].map((row) => (
              <motion.line
                key={`fline-${row}`}
                x1="375"
                y1={108 + row * 18}
                x2="428"
                y2={108 + row * 18}
                strokeWidth="1"
                strokeOpacity="0.3"
                variants={drawVariant(1.3 + row * 0.05, 0.25)}
              />
            ))}

            {/* 3 gold checkmarks on first 3 field lines */}
            {[0, 1, 2].map((row) => (
              <motion.path
                key={`check-${row}`}
                d={`M ${363} ${104 + row * 18} l 4 4 l 6 -7`}
                stroke={GOLD}
                strokeWidth="2.5"
                fill="none"
                variants={drawVariant(1.6 + row * 0.1, 0.3)}
              />
            ))}
          </g>
        </motion.g>
      </motion.g>

      {/* ── LAYER 4b: Shield badge ────────────────────────────────────── */}

      <motion.g variants={scaleInVariant(1.4)}>
        {/* Subtle gold glow behind shield */}
        <motion.circle
          cx="82"
          cy="112"
          r="34"
          fill={GOLD}
          fillOpacity="0.06"
          stroke="none"
          animate={{ opacity: [0.06, 0.14, 0.06] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2.5,
          }}
        />

        {/* Shield body */}
        <motion.g
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2.5,
          }}
        >
          <motion.path
            d="M 82 86 L 106 96 L 106 116 Q 106 134 82 140 Q 58 134 58 116 L 58 96 Z"
            strokeWidth="1.75"
            variants={drawVariant(1.4, 0.5)}
          />
          {/* Gold checkmark inside shield */}
          <motion.path
            d="M 70 112 l 8 9 l 16 -18"
            stroke={GOLD}
            strokeWidth="2.5"
            fill="none"
            variants={drawVariant(1.65, 0.35)}
          />
        </motion.g>
      </motion.g>

      {/* ── Trace / data-flow lines ──────────────────────────────────── */}

      {/* Dotted connector from shield toward clipboard area */}
      <motion.path
        d="M 106 105 Q 200 80 355 90"
        strokeWidth="1"
        strokeOpacity="0.15"
        strokeDasharray="3 5"
        fill="none"
        variants={drawVariant(1.8, 0.8)}
        animate={{ strokeDashoffset: [0, -24] }}
        transition={{
          strokeDashoffset: {
            duration: 4,
            repeat: Infinity,
            ease: "linear",
            delay: 2.8,
          },
        }}
      />

      {/* ── Optional: small clouds top-left ─────────────────────────── */}
      <motion.g
        strokeOpacity="0.18"
        strokeWidth="1"
        variants={fadeInVariant(0.6)}
      >
        {/* Cloud 1 */}
        <path d="M 158 54 Q 158 44 168 44 Q 170 38 178 38 Q 188 38 188 46 Q 196 46 196 54 Z" />
        {/* Cloud 2 — smaller */}
        <path d="M 220 38 Q 220 31 228 31 Q 230 26 236 26 Q 244 26 244 32 Q 250 32 250 38 Z" />
      </motion.g>

      {/* ── LAYER 5: Feature callouts — small badges floating around the
              ship that show every product surface, not just ISF.

           Each is a small rounded rect with a 1-2 word label + tiny visual.
           Positions chosen so they don't overlap the ship or clipboard. */}

      {/* AI Coach chip — middle-left of the canvas */}
      <motion.g variants={fadeInVariant(1.8)}>
        <motion.g
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 2.6 }}
        >
          <rect
            x="50"
            y="140"
            width="92"
            height="30"
            rx="8"
            fill="currentColor"
            fillOpacity="0.04"
            strokeWidth="1.5"
          />
          {/* Bot dot */}
          <circle cx="64" cy="155" r="3.5" fill={GOLD} stroke="none" />
          <text
            x="74"
            y="159"
            fontSize="9"
            fontFamily="ui-sans-serif, sans-serif"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.78"
          >
            AI Coach
          </text>
          {/* Tiny streaming dots */}
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={118 + i * 6}
              cy="158"
              r="1.4"
              fill={GOLD}
              stroke="none"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2.6 + i * 0.18,
              }}
            />
          ))}
        </motion.g>
      </motion.g>

      {/* Compliance score donut — top-right corner */}
      <motion.g variants={scaleInVariant(2.0)}>
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 2.8 }}
        >
          {/* Background card */}
          <rect
            x="468"
            y="50"
            width="78"
            height="44"
            rx="8"
            fill="currentColor"
            fillOpacity="0.04"
            strokeWidth="1.5"
          />
          {/* Tiny donut track */}
          <circle
            cx="486"
            cy="72"
            r="11"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="3"
          />
          {/* Animated arc */}
          <motion.circle
            cx="486"
            cy="72"
            r="11"
            fill="none"
            stroke={GOLD}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="69.1"
            strokeDashoffset="69.1"
            transform="rotate(-90 486 72)"
            animate={{ strokeDashoffset: 9.7 }}
            transition={{ duration: 1.3, delay: 2.4, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Label "Compliance" + number */}
          <text
            x="504"
            y="65"
            fontSize="7"
            fontFamily="ui-sans-serif, sans-serif"
            fontWeight="700"
            letterSpacing="0.8"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.6"
          >
            COMPLIANCE
          </text>
          <text
            x="504"
            y="82"
            fontSize="12"
            fontFamily="ui-sans-serif, sans-serif"
            fontWeight="700"
            stroke="none"
            fill="currentColor"
          >
            86
          </text>
        </motion.g>
      </motion.g>

      {/* ADD/CVD sync badge — right side, mid-height */}
      <motion.g variants={fadeInVariant(2.2)}>
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut", delay: 3.0 }}
        >
          <rect
            x="450"
            y="200"
            width="92"
            height="26"
            rx="6"
            fill="currentColor"
            fillOpacity="0.04"
            strokeWidth="1.5"
          />
          {/* Pulsing green dot */}
          <circle cx="462" cy="213" r="2.5" fill="hsl(160 84% 39%)" stroke="none">
            <animate
              attributeName="opacity"
              values="0.4;1;0.4"
              dur="1.8s"
              repeatCount="indefinite"
              begin="3s"
            />
          </circle>
          <text
            x="472"
            y="217"
            fontSize="8"
            fontFamily="ui-monospace, monospace"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.78"
          >
            ADD/CVD synced
          </text>
        </motion.g>
      </motion.g>

      {/* UFLPA flag — left side, mid-height */}
      <motion.g variants={fadeInVariant(2.0)}>
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut", delay: 3.1 }}
        >
          <rect
            x="20"
            y="200"
            width="86"
            height="26"
            rx="6"
            fill="currentColor"
            fillOpacity="0.04"
            strokeWidth="1.5"
          />
          {/* Rose dot to denote risk inbox */}
          <circle cx="32" cy="213" r="2.5" fill="hsl(0 72% 56%)" stroke="none" />
          <text
            x="42"
            y="217"
            fontSize="8"
            fontFamily="ui-sans-serif, sans-serif"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.78"
          >
            UFLPA risk
          </text>
        </motion.g>
      </motion.g>

      {/* HTS classifier hint — bottom-left, below ship's bow */}
      <motion.g variants={fadeInVariant(2.4)}>
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut", delay: 3.3 }}
        >
          <rect
            x="48"
            y="400"
            width="100"
            height="26"
            rx="6"
            fill="currentColor"
            fillOpacity="0.04"
            strokeWidth="1.5"
          />
          {/* Tiny "hash" mark */}
          <text
            x="60"
            y="417"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            fontWeight="700"
            stroke="none"
            fill={GOLD}
          >
            HTS
          </text>
          <text
            x="80"
            y="417"
            fontSize="8"
            fontFamily="ui-monospace, monospace"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.7"
          >
            6115.96.60
          </text>
        </motion.g>
      </motion.g>

      {/* Liquidation clock badge — right of HTS */}
      <motion.g variants={fadeInVariant(2.6)}>
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut", delay: 3.5 }}
        >
          <rect
            x="408"
            y="400"
            width="120"
            height="26"
            rx="6"
            fill="currentColor"
            fillOpacity="0.04"
            strokeWidth="1.5"
          />
          {/* Mini clock face */}
          <circle cx="422" cy="413" r="5" fill="none" strokeWidth="1.4" />
          {/* Clock hand pointing to ~3 o'clock */}
          <motion.line
            x1="422"
            y1="413"
            x2="426"
            y2="413"
            strokeWidth="1.4"
            strokeLinecap="round"
            animate={{ rotate: 360 }}
            style={{ transformOrigin: "422px 413px" }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear", delay: 3.2 }}
          />
          <text
            x="434"
            y="417"
            fontSize="8"
            fontFamily="ui-monospace, monospace"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
            fillOpacity="0.78"
          >
            314-day clock
          </text>
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}
