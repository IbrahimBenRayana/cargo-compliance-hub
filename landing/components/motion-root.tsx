"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps the entire app tree in a single MotionConfig so every motion
 * component on the site respects `prefers-reduced-motion: reduce` by
 * default, without each act / illustration having to call
 * `useReducedMotion()` individually.
 *
 * Before this existed, only the nav and a handful of acts guarded their
 * own animations; the home page had 5 sections animating freely for users
 * who had asked for reduced motion (WCAG 2.1 SC 2.3.3 failure).
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
