import { motion, MotionConfig } from 'framer-motion';
import { Shield, Lock, Zap } from 'lucide-react';
import { LoginScene } from './illustrations/login-scene';
import { RegisterScene } from './illustrations/register-scene';

const EASE = [0.22, 1, 0.36, 1] as const;

// Floating geometric squares — always-dark panel so white/gold borders are visible
const SQUARES = [
  { size: 20, top: '10%', left: '6%', duration: 18, gold: false, rotate: 8 },
  { size: 40, top: '22%', left: '72%', duration: 23, gold: false, rotate: -12 },
  { size: 48, top: '60%', left: '10%', duration: 20, gold: true, rotate: 15 },
  { size: 28, top: '75%', left: '68%', duration: 16, gold: false, rotate: -8 },
  { size: 16, top: '45%', left: '85%', duration: 25, gold: true, rotate: 20 },
];

export interface AuthBrandPanelProps {
  variant?: 'login' | 'register';
}

export function AuthBrandPanel({ variant = 'login' }: AuthBrandPanelProps) {
  return (
    <MotionConfig reducedMotion="user">
      {/* Always-dark navy panel regardless of theme */}
      <div
        className="hidden lg:flex relative flex-col justify-between h-screen overflow-hidden"
        style={{ background: 'hsl(222, 47%, 8%)' }}
        aria-hidden="true"
      >
        {/* ── Ambient gradient orbs ── */}
        {/* Gold orb — top-right */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '-60px',
            right: '-60px',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, hsl(43 96% 56% / 0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Navy-blue orb — bottom-left */}
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: '-80px',
            left: '-80px',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, hsl(222 60% 30% / 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* ── Dot grid ── */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage:
              'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
          }}
        />

        {/* ── Floating line-art squares ── */}
        {SQUARES.map((sq, i) => (
          <motion.div
            key={i}
            className="pointer-events-none absolute rounded-sm"
            style={{
              width: sq.size,
              height: sq.size,
              top: sq.top,
              left: sq.left,
              border: sq.gold
                ? '1px solid hsl(43 96% 56% / 0.15)'
                : '1px solid rgba(255,255,255,0.08)',
            }}
            animate={{
              y: [0, 18, 0, -18, 0],
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

        {/* ── Wordmark — top left ── */}
        <div className="absolute top-8 left-8 flex items-center gap-2.5 z-10">
          {/* Gold chevron mark */}
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
              d="M12 16 L24 26 L36 16"
              stroke="hsl(43, 96%, 56%)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 24 L24 34 L36 24"
              stroke="hsl(43, 96%, 56%)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
          </svg>
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: 'rgba(255,255,255,0.92)' }}
          >
            MyCargoLens
          </span>
        </div>

        {/* ── Scene illustration — center ── */}
        <motion.div
          className="relative z-10 flex-1 flex flex-col justify-center px-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
        >
          <div className="w-full max-w-sm mx-auto h-auto">
            {variant === 'login' ? <LoginScene /> : <RegisterScene />}
          </div>
        </motion.div>

        {/* ── Trust badges — bottom left ── */}
        <div className="absolute bottom-8 left-8 flex items-center gap-6 z-10">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Shield size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            SOC 2
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Lock size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            256-bit TLS
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Zap size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            Direct CBP
          </span>
        </div>
      </div>
    </MotionConfig>
  );
}
