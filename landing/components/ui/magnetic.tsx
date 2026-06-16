"use client";

import * as React from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/**
 * Magnetic — a wrapper that pulls its child a few pixels toward the
 * cursor while the pointer is inside the wrapper's bounds.
 *
 * Pattern is the one Stripe and Apple Pay use on payment buttons: subtle
 * (≤ 8 px), critically-damped (no overshoot), restricted to mouse pointers
 * (not touch / pen), and collapsed to a passthrough under
 * `prefers-reduced-motion: reduce`.
 *
 * Constraints (brand-register: calm peer set, Stripe / Linear / Mercury):
 *   - No bouncy spring. STIFFNESS / DAMPING produce a critically-damped
 *     return-to-center. If you push past stiffness=300 or below damping=18
 *     you start to see overshoot, which reads as "wobble" — wrong register.
 *   - Default strength of 6 px. Anything past 10 starts to feel like a toy.
 *   - Pointer-type guard via PointerEvent.pointerType so touch taps don't
 *     produce a stray translate from synthesised mousemoves.
 */

interface MagneticProps {
  children: React.ReactNode;
  /** Max pixel translate at full hover (cursor at the edge). Default 6. */
  strength?: number;
  /** Forwarded to the wrapper div. */
  className?: string;
}

const STIFFNESS = 240;
const DAMPING = 22;

export function Magnetic({ children, strength = 6, className }: MagneticProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: STIFFNESS, damping: DAMPING });
  const sy = useSpring(y, { stiffness: STIFFNESS, damping: DAMPING });

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Mouse cursors only — touch and pen tap interactions skip the magnet.
      if (e.pointerType !== "mouse") return;
      if (reduce || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const offsetX = e.clientX - (rect.left + rect.width / 2);
      const offsetY = e.clientY - (rect.top + rect.height / 2);
      // Normalize offset to -1..1 against half-width / half-height, then
      // scale by strength so the maximum displacement caps at `strength`.
      x.set((offsetX / (rect.width / 2)) * strength);
      y.set((offsetY / (rect.height / 2)) * strength);
    },
    [reduce, strength, x, y],
  );

  const handlePointerLeave = React.useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  // Under reduced motion the wrapper renders as a plain pass-through with
  // no event handlers — zero work on input, zero motion on the child.
  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </motion.div>
  );
}
