import { motion, MotionConfig } from 'framer-motion';

// Floating square configuration
const SQUARES = [
  { size: 32, top: '12%', left: '8%', duration: 20, gold: false, rotate: 8 },
  { size: 20, top: '65%', left: '15%', duration: 25, gold: false, rotate: -6 },
  { size: 40, top: '30%', left: '78%', duration: 18, gold: true, rotate: 12 },
  { size: 16, top: '78%', left: '72%', duration: 22, gold: false, rotate: -10 },
];

export function AuthBackground() {
  return (
    <MotionConfig reducedMotion="user">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-mesh"
      >
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, hsl(var(--foreground) / 0.03) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage:
              'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)',
          }}
        />

        {/* Navy orb — top-left */}
        <motion.div
          className="absolute"
          style={{
            top: '-10%',
            left: '-10%',
            width: 560,
            height: 560,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, hsl(222 47% 22% / 0.3) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{ opacity: [0.3, 0.45, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Gold orb — bottom-right */}
        <motion.div
          className="absolute"
          style={{
            bottom: '-8%',
            right: '-8%',
            width: 480,
            height: 480,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, hsl(43 96% 56% / 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{ opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Floating line-art squares */}
        {SQUARES.map((sq, i) => (
          <motion.div
            key={i}
            className="absolute rounded-sm"
            style={{
              width: sq.size,
              height: sq.size,
              top: sq.top,
              left: sq.left,
              border: sq.gold
                ? '1px solid hsl(43 96% 56% / 0.15)'
                : '1px solid hsl(var(--foreground) / 0.06)',
            }}
            animate={{
              y: [0, 15, 0, -15, 0],
              x: [0, 10, 0, -10, 0],
              rotate: [0, sq.rotate, 0, -sq.rotate, 0],
            }}
            transition={{
              duration: sq.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </MotionConfig>
  );
}
