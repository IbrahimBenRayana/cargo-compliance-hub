"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/**
 * Ambient hero backdrop. Deliberately static: the hero's entrance
 * choreography, donuts, and live pings carry all the motion budget, so
 * the backdrop provides depth (layered gradients + scroll parallax on
 * the shapes) without a single looping animation. Calm is the argument.
 */

const orbs = [
  {
    // Top-left — dominant navy tint
    className:
      "absolute -top-48 -left-48 w-[800px] h-[800px] rounded-full pointer-events-none",
    style: {
      background:
        "radial-gradient(circle, hsl(222 47% 22% / 0.45) 0%, transparent 70%)",
      filter: "blur(100px)",
      opacity: 0.45,
    },
  },
  {
    // Bottom-right — gold accent
    className:
      "absolute -bottom-48 -right-24 w-[700px] h-[700px] rounded-full pointer-events-none",
    style: {
      background:
        "radial-gradient(circle, hsl(43 96% 56% / 0.22) 0%, transparent 70%)",
      filter: "blur(100px)",
      opacity: 0.4,
    },
  },
  {
    // Center — soft blue-navy
    className:
      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none",
    style: {
      background:
        "radial-gradient(circle, hsl(220 70% 40% / 0.14) 0%, transparent 70%)",
      filter: "blur(80px)",
      opacity: 0.3,
    },
  },
];

// Floating geometric shapes — static composition, depth comes from the
// scroll parallax on the containing layer.
const shapes = [
  { top: "12%", left: "8%", size: 56, rotate: 15, gold: true },
  { top: "25%", left: "88%", size: 62, rotate: -20, gold: true },
  { top: "60%", left: "6%", size: 32, rotate: 8, gold: false },
  { top: "70%", left: "82%", size: 24, rotate: -10, gold: false },
  { top: "15%", left: "55%", size: 18, rotate: 45, gold: false },
];

export function HeroBackground() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  // MotionConfig's reducedMotion setting only gates animations, not
  // scroll-linked style bindings — gate the parallax explicitly.
  const rawParallaxY = useTransform(scrollY, [0, 600], [0, -80]);
  const parallaxY = useTransform(rawParallaxY, (v) => (reduceMotion ? 0 : v));

  return (
    <>
      {/* Dot grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--foreground) / 0.04) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* Ambient gradient orbs — static fields, no oscillation */}
      {orbs.map((orb, i) => (
        <div key={i} aria-hidden="true" className={orb.className} style={orb.style} />
      ))}

      {/* Spotlight beam — vertical gold-tinted column, slightly off-center */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 340px 100% at 42% 0%, hsl(43 96% 56% / 0.18) 0%, transparent 75%)",
          opacity: 0.3,
        }}
      />

      {/* Floating geometric shapes — parallax only (user-driven depth) */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ y: parallaxY }}
      >
        {shapes.map((shape, i) => (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              top: shape.top,
              left: shape.left,
              width: shape.size,
              height: shape.size,
              borderRadius: "6px",
              border: shape.gold
                ? "1.5px solid hsl(43 96% 56% / 0.30)"
                : "1.5px solid hsl(var(--foreground) / 0.08)",
              transform: `rotate(${shape.rotate}deg)`,
              background: shape.gold ? "hsl(43 96% 56% / 0.03)" : "transparent",
            }}
          />
        ))}
      </motion.div>

      {/* Bottom edge — faint static gradient easing into the next beat */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--foreground) / 0.04) 0%, transparent 100%)",
          opacity: 0.6,
        }}
      />
    </>
  );
}
