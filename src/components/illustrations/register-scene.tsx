import { motion, MotionConfig } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

const WHITE = 'rgba(255,255,255,0.7)';
const WHITE_DIM = 'rgba(255,255,255,0.35)';
const GOLD = 'hsl(43,96%,56%)';

// Building blocks: x, y, w, h, gold
const BLOCKS: Array<{ x: number; y: number; w: number; h: number; gold?: boolean }> = [
  { x: 110, y: 220, w: 170, h: 110 },   // large main content area (back)
  { x: 90,  y: 180, w: 80,  h: 160 },   // sidebar (back)
  { x: 200, y: 190, w: 78,  h: 40  },   // top stat card
  { x: 200, y: 240, w: 78,  h: 36,  gold: true }, // gold "first filing" card
  { x: 200, y: 286, w: 78,  h: 36  },   // lower stat card
  { x: 125, y: 230, w: 60,  h: 34  },   // sidebar inner card
  { x: 125, y: 275, w: 60,  h: 28  },   // sidebar inner card 2
];

// Sort: non-gold first (behind), gold last (front)
const SORTED_BLOCKS = [...BLOCKS].sort((a, b) => (a.gold ? 1 : 0) - (b.gold ? 1 : 0));

// Progress milestones
const MILESTONES = [
  { y: 295, filled: true },
  { y: 258, filled: true },
  { y: 221, filled: false },
];

export function RegisterScene() {
  return (
    <MotionConfig reducedMotion="user">
      <svg
        viewBox="0 0 480 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-full h-auto"
      >
        {/* ── Foundation dashed line ── */}
        <motion.line
          x1="60"
          y1="342"
          x2="360"
          y2="342"
          stroke={WHITE_DIM}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeDasharray="4 8"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0, ease: EASE }}
        />

        {/* ── Building blocks ── */}
        {SORTED_BLOCKS.map((b, i) => {
          const delay = 0.3 + i * 0.06;
          return (
            <motion.g
              key={`block-${i}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay, ease: EASE }}
            >
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx="8"
                stroke={b.gold ? GOLD : WHITE_DIM}
                strokeWidth={b.gold ? 1.75 : 1.25}
                fill={b.gold ? 'hsl(43,96%,56%,0.08)' : 'rgba(255,255,255,0.03)'}
              />
              {/* Inner shimmer line for non-gold blocks */}
              {!b.gold && (
                <line
                  x1={b.x + 10}
                  y1={b.y + 12}
                  x2={b.x + b.w * 0.55}
                  y2={b.y + 12}
                  stroke={WHITE_DIM}
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0.5"
                />
              )}
              {/* Gold card inner label */}
              {b.gold && (
                <>
                  <line
                    x1={b.x + 10}
                    y1={b.y + 10}
                    x2={b.x + b.w - 16}
                    y2={b.y + 10}
                    stroke={GOLD}
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                  <line
                    x1={b.x + 10}
                    y1={b.y + 18}
                    x2={b.x + b.w * 0.5}
                    y2={b.y + 18}
                    stroke={GOLD}
                    strokeWidth="1"
                    strokeLinecap="round"
                    opacity="0.4"
                  />
                </>
              )}
            </motion.g>
          );
        })}

        {/* ── Gold card ambient pulse ── */}
        {SORTED_BLOCKS.filter(b => b.gold).map((b, i) => (
          <motion.rect
            key={`pulse-${i}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="8"
            fill={GOLD}
            opacity={0}
            animate={{ opacity: [0, 0.07, 0] }}
            transition={{ duration: 2.5, delay: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {/* ── Magic wand ── */}
        {/* Wand shaft */}
        <motion.line
          x1="92"
          y1="144"
          x2="132"
          y2="104"
          stroke={WHITE}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.0, ease: EASE }}
        />
        {/* Wand tip star (4-pointed) */}
        <motion.path
          d="M132 98 L134 104 L140 104 L135 108 L137 114 L132 110 L127 114 L129 108 L124 104 L130 104 Z"
          stroke={GOLD}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="hsl(43,96%,56%,0.15)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.1, ease: EASE }}
          style={{ transformOrigin: '132px 104px' }}
        />
        {/* Wand handle grip */}
        <motion.rect
          x="86"
          y="140"
          width="12"
          height="6"
          rx="3"
          stroke={WHITE_DIM}
          strokeWidth="1.25"
          fill="rgba(255,255,255,0.06)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 1.05 }}
        />

        {/* ── Sparkle marks trailing from wand ── */}
        {[
          { cx: 148, cy: 92, size: 6 },
          { cx: 160, cy: 108, size: 5 },
          { cx: 144, cy: 118, size: 4 },
          { cx: 166, cy: 92, size: 5 },
        ].map((sp, i) => (
          <motion.g key={`sparkle-${i}`}>
            <motion.path
              d={`M${sp.cx} ${sp.cy - sp.size} L${sp.cx} ${sp.cy + sp.size} M${sp.cx - sp.size} ${sp.cy} L${sp.cx + sp.size} ${sp.cy} M${sp.cx - sp.size * 0.7} ${sp.cy - sp.size * 0.7} L${sp.cx + sp.size * 0.7} ${sp.cy + sp.size * 0.7} M${sp.cx + sp.size * 0.7} ${sp.cy - sp.size * 0.7} L${sp.cx - sp.size * 0.7} ${sp.cy + sp.size * 0.7}`}
              stroke={GOLD}
              strokeWidth="1.25"
              strokeLinecap="round"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: [0, 1, 0.6] }}
              transition={{
                duration: 0.3,
                delay: 1.2 + i * 0.1,
                ease: EASE,
                opacity: { duration: 0.4, delay: 1.2 + i * 0.1 },
              }}
              style={{ transformOrigin: `${sp.cx}px ${sp.cy}px` }}
            />
            {/* Ambient breathing on sparkles */}
            <motion.path
              d={`M${sp.cx} ${sp.cy - sp.size} L${sp.cx} ${sp.cy + sp.size} M${sp.cx - sp.size} ${sp.cy} L${sp.cx + sp.size} ${sp.cy}`}
              stroke={GOLD}
              strokeWidth="1"
              strokeLinecap="round"
              opacity={0}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{
                duration: 2,
                delay: 2.5 + i * 0.3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.g>
        ))}

        {/* ── Progress track (right side) ── */}
        {/* Track background */}
        <motion.line
          x1="364"
          y1="300"
          x2="364"
          y2="160"
          stroke={WHITE_DIM}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.0, ease: EASE }}
        />
        {/* Progress fill (gold) — from bottom to ~60% */}
        <motion.line
          x1="364"
          y1="300"
          x2="364"
          y2="220"
          stroke={GOLD}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.3, ease: EASE }}
        />

        {/* Milestone dots */}
        {MILESTONES.map((m, i) => (
          <motion.g key={`milestone-${i}`}>
            <motion.circle
              cx={364}
              cy={m.y}
              r="5"
              stroke={m.filled ? GOLD : WHITE_DIM}
              strokeWidth="1.75"
              fill={m.filled ? 'hsl(43,96%,56%,0.25)' : 'rgba(255,255,255,0.04)'}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2, delay: 1.5 + i * 0.2, ease: EASE }}
              style={{ transformOrigin: `364px ${m.y}px` }}
            />
            {/* Milestone label line */}
            <motion.line
              x1="372"
              y1={m.y}
              x2="388"
              y2={m.y}
              stroke={m.filled ? GOLD : WHITE_DIM}
              strokeWidth="1.25"
              strokeLinecap="round"
              opacity={m.filled ? 0.5 : 0.3}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: m.filled ? 0.5 : 0.3 }}
              transition={{ duration: 0.2, delay: 1.55 + i * 0.2, ease: EASE }}
            />
          </motion.g>
        ))}

        {/* ── "Assembling" depth shadow on back blocks ── */}
        {/* Subtle drop shadow suggestion via a blurred rect under main content */}
        <rect
          x="106"
          y="224"
          width="178"
          height="118"
          rx="10"
          fill="rgba(0,0,0,0.15)"
          style={{ filter: 'blur(6px)' }}
        />
      </svg>
    </MotionConfig>
  );
}
