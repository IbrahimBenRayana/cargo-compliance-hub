"use client";

import * as React from "react";
import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { Container } from "@/components/ui/container";

const EASE = [0.22, 1, 0.36, 1] as const;

interface PageHeroProps {
  label: string;
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href: string }>;
  children?: React.ReactNode;
  illustration?: React.ReactNode;
}

// Two lighter orbs for inner pages
const orbConfigs = [
  {
    className:
      "absolute -top-32 -left-32 w-[460px] h-[460px] rounded-full pointer-events-none",
    style: {
      background:
        "radial-gradient(circle, hsl(222 47% 22% / 0.32) 0%, transparent 70%)",
      filter: "blur(80px)",
    },
    animate: { scale: [1, 1.10, 1], opacity: [0.2, 0.42, 0.2] },
    transition: { duration: 14, repeat: Infinity, ease: "easeInOut" as const },
  },
  {
    className:
      "absolute -bottom-32 -right-16 w-[420px] h-[420px] rounded-full pointer-events-none",
    style: {
      background:
        "radial-gradient(circle, hsl(43 96% 56% / 0.16) 0%, transparent 70%)",
      filter: "blur(80px)",
    },
    animate: { scale: [1, 1.10, 1], opacity: [0.18, 0.36, 0.18] },
    transition: {
      duration: 16,
      repeat: Infinity,
      ease: "easeInOut" as const,
      delay: 3,
    },
  },
];

// 3 small floating squares
const squareConfigs = [
  {
    top: "14%",
    left: "7%",
    size: 28,
    rotate: 12,
    driftX: 10,
    driftY: -8,
    duration: 22,
    gold: true,
    delay: 0,
  },
  {
    top: "55%",
    left: "91%",
    size: 18,
    rotate: -18,
    driftX: -8,
    driftY: 12,
    duration: 26,
    gold: false,
    delay: 2,
  },
  {
    top: "72%",
    left: "5%",
    size: 14,
    rotate: 35,
    driftX: 6,
    driftY: -10,
    duration: 20,
    gold: false,
    delay: 5,
  },
];

export function PageHero({
  label,
  title,
  description,
  breadcrumbs,
  children,
  illustration,
}: PageHeroProps) {
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative overflow-hidden py-16 md:py-20 lg:py-24">
        {/* ── Background layer ── */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          {/* Dot grid with radial fade */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--foreground) / 0.04) 1px, transparent 1px)`,
              backgroundSize: "28px 28px",
              maskImage:
                "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)",
            }}
          />

          {/* Ambient orbs */}
          {orbConfigs.map((orb, i) => (
            <motion.div
              key={i}
              className={orb.className}
              style={orb.style}
              animate={orb.animate}
              transition={orb.transition}
            />
          ))}

          {/* Floating line-art squares */}
          {squareConfigs.map((sq, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{
                top: sq.top,
                left: sq.left,
                width: sq.size,
                height: sq.size,
                borderRadius: "4px",
                border: sq.gold
                  ? "1.5px solid hsl(43 96% 56% / 0.28)"
                  : "1.5px solid hsl(var(--foreground) / 0.07)",
                rotate: sq.rotate,
                background: sq.gold ? "hsl(43 96% 56% / 0.03)" : "transparent",
              }}
              animate={{
                x: [0, sq.driftX, 0],
                y: [0, sq.driftY, 0],
                rotate: [sq.rotate, sq.rotate + 12, sq.rotate - 4, sq.rotate],
              }}
              transition={{
                duration: sq.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: sq.delay,
              }}
            />
          ))}
        </div>

        {/* ── Content ── */}
        <Container>
          {illustration ? (
            /* Two-column layout when illustration is provided */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
              {/* Left: text content */}
              <div className="lg:col-span-7 text-center md:text-left">
                {breadcrumbs && breadcrumbs.length > 0 && (
                  <motion.nav
                    aria-label="Breadcrumb"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5 justify-center md:justify-start flex-wrap"
                  >
                    <Link href="/" className="hover:text-foreground transition-colors">
                      Home
                    </Link>
                    {breadcrumbs.map((crumb) => (
                      <React.Fragment key={crumb.href}>
                        <span aria-hidden="true" className="opacity-40">/</span>
                        <Link href={crumb.href} className="hover:text-foreground transition-colors">
                          {crumb.label}
                        </Link>
                      </React.Fragment>
                    ))}
                  </motion.nav>
                )}

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gradient-gold mb-4"
                >
                  {label}
                </motion.p>

                <motion.h1
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.07, ease: EASE }}
                  className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground"
                >
                  {title}
                </motion.h1>

                {description && (
                  <motion.p
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: 0.14, ease: EASE }}
                    className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl"
                  >
                    {description}
                  </motion.p>
                )}

                {children && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.22, ease: EASE }}
                    className="mt-7"
                  >
                    {children}
                  </motion.div>
                )}
              </div>

              {/* Right: illustration */}
              <motion.div
                className="lg:col-span-5 flex items-center justify-center"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65, delay: 0.18, ease: EASE }}
              >
                {illustration}
              </motion.div>
            </div>
          ) : (
            /* Single-column layout (original) */
            <div className="text-center md:text-left max-w-3xl">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <motion.nav
                  aria-label="Breadcrumb"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5 justify-center md:justify-start flex-wrap"
                >
                  <Link
                    href="/"
                    className="hover:text-foreground transition-colors"
                  >
                    Home
                  </Link>
                  {breadcrumbs.map((crumb) => (
                    <React.Fragment key={crumb.href}>
                      <span aria-hidden="true" className="opacity-40">
                        /
                      </span>
                      <Link
                        href={crumb.href}
                        className="hover:text-foreground transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    </React.Fragment>
                  ))}
                </motion.nav>
              )}

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gradient-gold mb-4"
              >
                {label}
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.07, ease: EASE }}
                className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground"
              >
                {title}
              </motion.h1>

              {description && (
                <motion.p
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.14, ease: EASE }}
                  className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl"
                >
                  {description}
                </motion.p>
              )}

              {children && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.22, ease: EASE }}
                  className="mt-7"
                >
                  {children}
                </motion.div>
              )}
            </div>
          )}
        </Container>
      </section>
    </MotionConfig>
  );
}
