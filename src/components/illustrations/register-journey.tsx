import { motion } from 'framer-motion';
import { Container, FileCheck2, Landmark, PackageCheck, Sparkles, Calculator } from 'lucide-react';

/**
 * Signup-panel scene: a shipment's journey through U.S. customs, animated as
 * a continuously looping vertical route. A gold pulse travels the line; each
 * checkpoint brightens as it passes, then the cycle breathes and restarts.
 * Two ambient mini-cards (AI classification, duty calc) drift alongside.
 *
 * Built for the always-dark AuthBrandPanel: white/gold on navy, smooth
 * long-duration easing, honors prefers-reduced-motion via MotionConfig.
 */

const CYCLE = 12; // seconds per full journey
const GOLD = 'hsl(43 96% 56%)';

const STOPS = [
  { icon: Container, title: 'Shipment created', caption: 'Bill of lading imported', at: 0.14 },
  { icon: FileCheck2, title: 'ISF 10+2 filed', caption: 'Transmitted to CBP', at: 0.38 },
  { icon: Landmark, title: 'Entry summary accepted', caption: 'Duty & fees computed', at: 0.62 },
  { icon: PackageCheck, title: 'Cargo released', caption: 'Cleared for pickup', at: 0.86 },
] as const;

/** Keyframe helper: dim → bright at `at` → hold → dim again at cycle end. */
function glowFrames(at: number, dim: number, bright: number) {
  return {
    values: [dim, dim, bright, bright, dim],
    times: [0, Math.max(at - 0.04, 0.01), at, 0.94, 1],
  };
}

export function RegisterJourneyScene() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] select-none" aria-hidden="true">
      {/* Ambient mini-card — AI classification (top right) */}
      <motion.div
        className="absolute -right-2 top-1 z-20 flex items-center gap-2 rounded-xl px-3 py-2"
        style={{
          background: 'hsl(222 40% 14% / 0.9)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
        animate={{ y: [0, -7, 0], rotate: [0, -1.2, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Sparkles size={14} style={{ color: GOLD }} />
        <div>
          <div className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
            AI classified
          </div>
          <div className="text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.45)' }}>
            HTS 8507.60.00 · 98% match
          </div>
        </div>
      </motion.div>

      {/* Ambient mini-card — duty calculator (bottom left) */}
      <motion.div
        className="absolute -left-3 bottom-8 z-20 flex items-center gap-2 rounded-xl px-3 py-2"
        style={{
          background: 'hsl(222 40% 14% / 0.9)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
        animate={{ y: [0, 8, 0], rotate: [0, 1.2, 0] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
      >
        <Calculator size={14} style={{ color: GOLD }} />
        <div>
          <div className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Duty estimated
          </div>
          <div className="text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.45)' }}>
            $341.00 · MPF $34.64
          </div>
        </div>
      </motion.div>

      {/* Journey card */}
      <div
        className="relative rounded-2xl px-6 py-7"
        style={{
          background: 'linear-gradient(160deg, hsl(222 45% 12% / 0.85), hsl(222 47% 9% / 0.9))',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.38)' }}>
          Origin → Release
        </div>

        <div className="relative">
          {/* Route spine */}
          <div
            className="absolute left-[15px] top-2 bottom-2 w-px"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          />
          {/* Gold progress that grows down the spine each cycle */}
          <motion.div
            className="absolute left-[15px] top-2 w-px origin-top"
            style={{ bottom: 8, background: `linear-gradient(${GOLD}, hsl(43 96% 56% / 0.25))` }}
            animate={{ scaleY: [0, 0, 1, 1, 0] }}
            transition={{ duration: CYCLE, times: [0, 0.06, 0.86, 0.96, 1], repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Travelling pulse */}
          <motion.div
            className="absolute left-[15px] h-2.5 w-2.5 -translate-x-1/2 rounded-full"
            style={{ background: GOLD, boxShadow: `0 0 14px 3px hsl(43 96% 56% / 0.45)` }}
            animate={{ top: ['1%', '1%', '96%', '96%'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: CYCLE, times: [0, 0.06, 0.86, 1], repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Checkpoints */}
          <div className="space-y-6">
            {STOPS.map((stop) => {
              const ring = glowFrames(stop.at, 0, 1);
              const text = glowFrames(stop.at, 0.45, 1);
              return (
                <div key={stop.title} className="relative flex items-center gap-4 pl-0">
                  {/* Node */}
                  <div className="relative z-10 flex h-8 w-8 items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ border: `1px solid ${GOLD}`, boxShadow: `0 0 12px hsl(43 96% 56% / 0.35)` }}
                      animate={{ opacity: ring.values, scale: [0.9, 0.9, 1, 1, 0.9] }}
                      transition={{ duration: CYCLE, times: ring.times, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'hsl(222 45% 11%)' }}
                    />
                    <motion.span
                      className="relative"
                      animate={{ opacity: text.values }}
                      transition={{ duration: CYCLE, times: text.times, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <stop.icon size={14} style={{ color: 'rgba(255,255,255,0.9)' }} />
                    </motion.span>
                  </div>
                  {/* Labels */}
                  <motion.div
                    animate={{ opacity: text.values, x: [0, 0, 2, 2, 0] }}
                    transition={{ duration: CYCLE, times: text.times, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <div className="text-[13px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
                      {stop.title}
                    </div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                      {stop.caption}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tagline */}
        <div className="mt-6 border-t pt-4 text-[12px] leading-relaxed" style={{ borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
          ISF 10+2 · Entry Summary · Manifest Query · AI classification · Duty calculator — one workspace for U.S. customs.
        </div>
      </div>
    </div>
  );
}
