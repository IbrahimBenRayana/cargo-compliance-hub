import { motion, MotionConfig } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

const WHITE = 'rgba(255,255,255,0.7)';
const WHITE_DIM = 'rgba(255,255,255,0.4)';
const GOLD = 'hsl(43,96%,56%)';
const GOLD_DIM = 'hsl(43,96%,56%,0.18)';

export function LoginScene() {
  return (
    <MotionConfig reducedMotion="user">
      <svg
        viewBox="0 0 480 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-full h-auto"
      >
        {/* ── Gold glow behind frame ── */}
        <rect
          x="72"
          y="96"
          width="212"
          height="168"
          rx="18"
          fill="none"
          stroke={GOLD}
          strokeWidth="1"
          opacity="0.12"
          style={{ filter: 'blur(8px)' }}
        />

        {/* ── Dashboard frame ── */}
        <motion.rect
          x="80"
          y="104"
          width="196"
          height="152"
          rx="12"
          stroke={WHITE}
          strokeWidth="1.75"
          fill="rgba(255,255,255,0.03)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        />

        {/* ── Browser top bar ── */}
        <motion.line
          x1="80"
          y1="128"
          x2="276"
          y2="128"
          stroke={WHITE_DIM}
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5, ease: EASE }}
        />
        {/* 3 browser dots */}
        {[96, 108, 120].map((cx, i) => (
          <motion.circle
            key={`dot-${i}`}
            cx={cx}
            cy={119}
            r="3"
            fill={WHITE_DIM}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.54 + i * 0.04, ease: EASE }}
          />
        ))}

        {/* ── Stat cards 2×2 grid ── */}
        {/* Top-left card */}
        <motion.rect
          x="96"
          y="140"
          width="40"
          height="26"
          rx="4"
          stroke={WHITE_DIM}
          strokeWidth="1.25"
          fill="rgba(255,255,255,0.04)"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.58, ease: EASE }}
        />
        {/* Top-right card */}
        <motion.rect
          x="148"
          y="140"
          width="40"
          height="26"
          rx="4"
          stroke={WHITE_DIM}
          strokeWidth="1.25"
          fill="rgba(255,255,255,0.04)"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.62, ease: EASE }}
        />
        {/* Bottom-left card — gold (active/important) */}
        <motion.rect
          x="96"
          y="176"
          width="40"
          height="26"
          rx="4"
          stroke={GOLD}
          strokeWidth="1.5"
          fill="hsl(43,96%,56%,0.1)"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.66, ease: EASE }}
        />
        {/* Bottom-right card */}
        <motion.rect
          x="148"
          y="176"
          width="40"
          height="26"
          rx="4"
          stroke={WHITE_DIM}
          strokeWidth="1.25"
          fill="rgba(255,255,255,0.04)"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.70, ease: EASE }}
        />

        {/* ── Tiny chart line (sine-wave) ── */}
        <motion.path
          d="M96 220 Q106 212 116 220 Q126 228 136 220 Q146 212 156 220 Q166 228 176 220 Q186 212 196 220 Q206 228 216 220"
          stroke={WHITE_DIM}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.75, ease: EASE }}
        />

        {/* ── Pulsing gold card ── */}
        <motion.rect
          x="96"
          y="176"
          width="40"
          height="26"
          rx="4"
          fill={GOLD}
          opacity={0}
          animate={{ opacity: [0, 0.08, 0] }}
          transition={{ duration: 2.5, delay: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* ── Key ── */}
        {/* Key bow (head) */}
        <motion.circle
          cx="368"
          cy="148"
          r="22"
          stroke={GOLD}
          strokeWidth="2.5"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.0, ease: EASE }}
        />
        <motion.circle
          cx="368"
          cy="148"
          r="10"
          stroke={GOLD}
          strokeWidth="1.75"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.15, ease: EASE }}
        />
        {/* Key shaft */}
        <motion.line
          x1="346"
          y1="148"
          x2="290"
          y2="148"
          stroke={GOLD}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.2, ease: EASE }}
        />
        {/* Key teeth / notches */}
        <motion.path
          d="M318 148 L318 160 M308 148 L308 156 M298 148 L298 162"
          stroke={GOLD}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.35, ease: EASE }}
        />

        {/* ── Data flow lines: key → dashboard frame ── */}
        {/* Flow line 1 */}
        <motion.path
          d="M290 148 C265 148 265 168 240 168 C220 168 210 168 200 168"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeDasharray="5 8"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1, strokeDashoffset: [0, -52] }}
          transition={{
            pathLength: { duration: 0.5, delay: 1.2, ease: EASE },
            opacity: { duration: 0.3, delay: 1.2 },
            strokeDashoffset: { duration: 2.5, delay: 1.5, repeat: Infinity, ease: 'linear' },
          }}
        />
        {/* Flow line 2 */}
        <motion.path
          d="M290 148 C268 148 268 188 244 196 C228 200 215 200 200 200"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="4 10"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1, strokeDashoffset: [0, -56] }}
          transition={{
            pathLength: { duration: 0.5, delay: 1.25, ease: EASE },
            opacity: { duration: 0.3, delay: 1.25 },
            strokeDashoffset: { duration: 3, delay: 1.6, repeat: Infinity, ease: 'linear' },
          }}
        />
        {/* Flow line 3 */}
        <motion.path
          d="M290 148 C270 148 270 130 248 124 C230 120 215 120 200 124"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="3 12"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1, strokeDashoffset: [0, -45] }}
          transition={{
            pathLength: { duration: 0.5, delay: 1.3, ease: EASE },
            opacity: { duration: 0.3, delay: 1.3 },
            strokeDashoffset: { duration: 2.8, delay: 1.7, repeat: Infinity, ease: 'linear' },
          }}
        />

        {/* ── Checkmark in circle (gold, top of dashboard frame) ── */}
        <motion.circle
          cx="276"
          cy="104"
          r="12"
          stroke={GOLD}
          strokeWidth="1.75"
          fill="hsl(43,96%,56%,0.1)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.4, ease: EASE }}
          style={{ transformOrigin: '276px 104px' }}
        />
        <motion.path
          d="M270 104 L274 108 L283 99"
          stroke={GOLD}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.6, ease: EASE }}
        />

        {/* ── User avatar circle ── */}
        <motion.circle
          cx="380"
          cy="200"
          r="14"
          stroke={WHITE}
          strokeWidth="1.5"
          fill="rgba(255,255,255,0.05)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.45, ease: EASE }}
          style={{ transformOrigin: '380px 200px' }}
        />
        {/* Head */}
        <motion.circle
          cx="380"
          cy="196"
          r="4.5"
          stroke={WHITE}
          strokeWidth="1.25"
          fill="none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, delay: 1.55, ease: EASE }}
          style={{ transformOrigin: '380px 196px' }}
        />
        {/* Shoulders arc */}
        <motion.path
          d="M370 210 Q380 205 390 210"
          stroke={WHITE}
          strokeWidth="1.25"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.25, delay: 1.6, ease: EASE }}
        />

        {/* ── Ambient: key gentle bob ── */}
        <motion.g
          animate={{ y: [0, -5, 0, 5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        >
          {/* invisible anchor — key elements already above, this layer just for ambient float on key group */}
        </motion.g>

        {/* ── Label text stubs ── */}
        <motion.rect
          x="100"
          y="145"
          width="16"
          height="2"
          rx="1"
          fill={WHITE_DIM}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.62 }}
        />
        <motion.rect
          x="152"
          y="145"
          width="12"
          height="2"
          rx="1"
          fill={WHITE_DIM}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.66 }}
        />
        <motion.rect
          x="100"
          y="181"
          width="14"
          height="2"
          rx="1"
          fill={GOLD}
          opacity="0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 0.2, delay: 0.70 }}
        />
      </svg>
    </MotionConfig>
  );
}
