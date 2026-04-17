"use client";

import { motion, MotionConfig, useScroll, useTransform } from "framer-motion";

// Ambient orb definitions — scaled up for more presence
const orbs = [
  {
    // Top-left — dominant navy tint
    className:
      "absolute -top-48 -left-48 w-[800px] h-[800px] rounded-full pointer-events-none",
    style: {
      background:
        "radial-gradient(circle, hsl(222 47% 22% / 0.45) 0%, transparent 70%)",
      filter: "blur(100px)",
    },
    animate: { scale: [1, 1.12, 1], opacity: [0.3, 0.55, 0.3] },
    transition: {
      duration: 12,
      repeat: Infinity,
      ease: "easeInOut" as const,
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
    },
    animate: { scale: [1, 1.12, 1], opacity: [0.25, 0.5, 0.25] },
    transition: {
      duration: 14,
      repeat: Infinity,
      ease: "easeInOut" as const,
      delay: 2,
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
    },
    animate: { scale: [1, 1.08, 1], opacity: [0.2, 0.4, 0.2] },
    transition: {
      duration: 10,
      repeat: Infinity,
      ease: "easeInOut" as const,
      delay: 4,
    },
  },
];

// Reduced to 5 shapes, 2 larger gold-tinted ones for presence
const shapes = [
  {
    top: "12%",
    left: "8%",
    size: 56,
    rotate: 15,
    driftX: 16,
    driftY: -12,
    duration: 18,
    gold: true,
    delay: 0,
  },
  {
    top: "25%",
    left: "88%",
    size: 62,
    rotate: -20,
    driftX: -14,
    driftY: 18,
    duration: 22,
    gold: true,
    delay: 1.5,
  },
  {
    top: "60%",
    left: "6%",
    size: 32,
    rotate: 8,
    driftX: 12,
    driftY: 14,
    duration: 25,
    gold: false,
    delay: 3,
  },
  {
    top: "70%",
    left: "82%",
    size: 24,
    rotate: -10,
    driftX: -18,
    driftY: -10,
    duration: 20,
    gold: false,
    delay: 0.8,
  },
  {
    top: "15%",
    left: "55%",
    size: 18,
    rotate: 45,
    driftX: -12,
    driftY: 10,
    duration: 17,
    gold: false,
    delay: 3.5,
  },
];

// Constellation: pairs of [x1%, y1%, x2%, y2%] in hero space
const constellationLines = [
  { x1: 8, y1: 12, x2: 30, y2: 28, duration: 7, delay: 0 },
  { x1: 30, y1: 28, x2: 55, y2: 15, duration: 9, delay: 1.2 },
  { x1: 55, y1: 15, x2: 88, y2: 25, duration: 8, delay: 2.4 },
  { x1: 6, y1: 60, x2: 24, y2: 48, duration: 6, delay: 3.6 },
  { x1: 82, y1: 70, x2: 88, y2: 50, duration: 10, delay: 0.8 },
];

export function HeroBackground() {
  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 600], [0, -80]);

  return (
    <MotionConfig reducedMotion="user">
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

      {/* Ambient gradient orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={orb.className}
          style={orb.style}
          animate={orb.animate}
          transition={orb.transition}
        />
      ))}

      {/* Spotlight beam — vertical gold-tinted column, slightly off-center */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 340px 100% at 42% 0%, hsl(43 96% 56% / 0.18) 0%, transparent 75%)",
        }}
        animate={{ opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Constellation SVG lines */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
      >
        {constellationLines.map((line, i) => (
          <g key={i}>
            <motion.line
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke="hsl(var(--foreground) / 0.06)"
              strokeWidth="1"
              animate={{ opacity: [0, 0.7, 0] }}
              transition={{
                duration: line.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: line.delay,
              }}
            />
            <motion.circle
              cx={`${line.x1}%`}
              cy={`${line.y1}%`}
              r="2"
              fill="hsl(var(--foreground) / 0.10)"
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{
                duration: line.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: line.delay,
              }}
            />
            <motion.circle
              cx={`${line.x2}%`}
              cy={`${line.y2}%`}
              r="2"
              fill="hsl(var(--foreground) / 0.10)"
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{
                duration: line.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: line.delay + 0.1,
              }}
            />
          </g>
        ))}
      </svg>

      {/* Floating geometric shapes with parallax */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ y: parallaxY }}
      >
        {shapes.map((shape, i) => (
          <motion.div
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
              rotate: shape.rotate,
              background: shape.gold
                ? "hsl(43 96% 56% / 0.03)"
                : "transparent",
            }}
            animate={{
              x: [0, shape.driftX, 0],
              y: [0, shape.driftY, 0],
              rotate: [shape.rotate, shape.rotate + 15, shape.rotate - 5, shape.rotate],
            }}
            transition={{
              duration: shape.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: shape.delay,
            }}
          />
        ))}
      </motion.div>

      {/* Scroll hint — faint pulsing gradient at the bottom edge */}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--foreground) / 0.04) 0%, transparent 100%)",
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </MotionConfig>
  );
}
