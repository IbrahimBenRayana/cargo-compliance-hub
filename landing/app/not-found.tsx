"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const EASE = [0.22, 1, 0.36, 1] as const;

const rise = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * The brand's Focus Frame, drawn around the numeral: four gold corner
 * brackets that settle inward from just outside their resting spot.
 * Rare-page tier, so a small moment of delight is allowed — but it's
 * still transform/opacity only, on the site's easing tokens.
 */
const CORNERS = [
  { pos: "left-0 top-0", edges: "border-l-2 border-t-2", dx: -5, dy: -5 },
  { pos: "right-0 top-0", edges: "border-r-2 border-t-2", dx: 5, dy: -5 },
  { pos: "right-0 bottom-0", edges: "border-r-2 border-b-2", dx: 5, dy: 5 },
  { pos: "left-0 bottom-0", edges: "border-l-2 border-b-2", dx: -5, dy: 5 },
] as const;

export default function NotFound() {
  return (
    <div className="bg-mesh flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
        className="max-w-md text-center"
      >
        {/* Numeral inside the Focus Frame — the middle 0 is the "lens". */}
        <motion.div
          variants={rise}
          aria-hidden="true"
          className="relative mx-auto mb-8 inline-block select-none px-7 py-4"
        >
          {CORNERS.map(({ pos, edges, dx, dy }, i) => (
            <motion.span
              key={pos}
              initial={{ opacity: 0, x: dx, y: dy }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 + i * 0.06, ease: EASE }}
              className={`absolute size-5 border-gold/60 ${pos} ${edges}`}
            />
          ))}
          <p className="text-8xl font-bold leading-none tracking-tight text-foreground">
            4<span className="text-gold-word">0</span>4
          </p>
        </motion.div>

        <motion.h1
          variants={rise}
          className="mb-3 text-2xl font-semibold tracking-tight"
        >
          This page didn&apos;t clear customs.
        </motion.h1>
        <motion.p
          variants={rise}
          className="mb-8 text-base leading-relaxed text-muted-foreground"
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          The rest of the site is right where you left it.
        </motion.p>
        <motion.div
          variants={rise}
          className="flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button variant="gold" size="lg" asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/book-a-demo">Book a demo</Link>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
