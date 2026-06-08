"use client";

import * as React from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Ship,
  BarChart3,
  Sparkles,
  ListChecks,
  Bot,
  ChevronDown,
  ArrowRight,
  Command,
} from "lucide-react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/theme-toggle";

const EASE = [0.22, 1, 0.36, 1] as const;

const platformDropdownItems = [
  {
    icon: Ship,
    title: "Filings",
    description: "ISF-10, ISF-5, ABI Entry, bulk, templates",
    href: "/platform/filings",
  },
  {
    icon: BarChart3,
    title: "Compliance Center",
    description: "Action queue, UFLPA, ADD/CVD, liquidation",
    href: "/platform/compliance",
  },
  {
    icon: Bot,
    title: "AI",
    description: "Today's brief, rejection coach, HTS classifier",
    href: "/platform/ai",
  },
  {
    icon: ListChecks,
    title: "Lifecycle",
    description: "Timeline, score history, PDF export",
    href: "/platform/lifecycle",
  },
  {
    icon: Sparkles,
    title: "Automation",
    description: "CBP polling, Federal Register sync, alerts",
    href: "/platform/automation",
  },
];

const topLevelLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "Solutions", href: "/solutions" },
  { label: "About", href: "/about" },
];

// Shared layoutId for the sliding hover pill so framer-motion morphs the
// background between hovered top-level links (Linear/Vercel pattern).
const HOVER_PILL_ID = "nav-hover-pill";

export function Nav() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [platformOpen, setPlatformOpen] = React.useState(false);
  const [mobilePlatformOpen, setMobilePlatformOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const platformTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    const handleScroll = () => {
      const shouldBeScrolled = window.scrollY >= 8;
      setScrolled((prev) => (prev !== shouldBeScrolled ? shouldBeScrolled : prev));
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll while the mobile sheet is open so the page behind
  // doesn't scroll under the user's thumb.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const handlePlatformMouseEnter = () => {
    if (platformTimeout.current) clearTimeout(platformTimeout.current);
    setPlatformOpen(true);
    setHoveredKey("platform");
  };

  const handlePlatformMouseLeave = () => {
    platformTimeout.current = setTimeout(() => setPlatformOpen(false), 120);
  };

  return (
    <MotionConfig reducedMotion="user">
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-[backdrop-filter,background-color,border-color,box-shadow] duration-500 ease-out",
          scrolled
            ? "border-b border-border/40 shadow-[0_1px_0_0_hsl(var(--border)/0.4),0_8px_24px_-8px_hsl(var(--foreground)/0.08)] bg-[hsl(var(--background)/0.78)] backdrop-blur-xl backdrop-saturate-150"
            : "bg-transparent border-b border-transparent shadow-none backdrop-blur-0"
        )}
      >
        <Container>
          <nav
            className="flex h-16 items-center justify-between"
            onMouseLeave={() => setHoveredKey(null)}
          >
            {/* Logo — subtle magnetic hover: gentle scale on the whole
                wordmark, no rotation on the SVG itself (that would
                require touching Wordmark internals). */}
            <Link href="/" className="flex-shrink-0" aria-label="MyCargoLens home">
              <motion.span
                whileHover={reducedMotion ? undefined : { scale: 1.035 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="inline-flex"
              >
                <Wordmark />
              </motion.span>
            </Link>

            {/* Desktop center links — the sliding pill uses `layoutId` to
                morph between hovered items. */}
            <ul className="hidden md:flex items-center gap-0.5">
              {/* Platform with dropdown */}
              <li
                className="relative"
                onMouseEnter={handlePlatformMouseEnter}
                onMouseLeave={handlePlatformMouseLeave}
              >
                <button
                  className="relative flex items-center gap-1 px-3.5 py-2 text-[13.5px] font-medium text-muted-foreground hover:text-foreground rounded-full transition-colors"
                  onClick={() => setPlatformOpen((v) => !v)}
                  aria-expanded={platformOpen}
                  aria-haspopup="true"
                >
                  {hoveredKey === "platform" && (
                    <motion.span
                      layoutId={HOVER_PILL_ID}
                      className="absolute inset-0 rounded-full bg-secondary/80"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">Platform</span>
                  <motion.span
                    animate={{ rotate: platformOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="relative flex items-center"
                  >
                    <ChevronDown size={14} />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {platformOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: EASE }}
                      style={{ transformOrigin: "top left" }}
                      className="absolute top-full left-0 mt-2 border border-border/40 rounded-2xl shadow-[0_20px_60px_-12px_hsl(var(--foreground)/0.18),0_0_0_1px_hsl(var(--border)/0.6)] min-w-[360px] overflow-hidden bg-[hsl(var(--card)/0.96)] backdrop-blur-2xl backdrop-saturate-150"
                      onMouseEnter={handlePlatformMouseEnter}
                      onMouseLeave={handlePlatformMouseLeave}
                    >
                      {/* Gold gradient hairline at the very top. */}
                      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

                      {/* All Features overview row */}
                      <Link
                        href="/features"
                        className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/60 transition-colors border-b border-border/40 group"
                        onClick={() => setPlatformOpen(false)}
                      >
                        <div>
                          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-0.5">
                            All features
                          </p>
                          <p className="text-sm text-foreground font-medium">
                            Overview of every capability
                          </p>
                        </div>
                        <motion.span
                          initial={false}
                          whileHover={reducedMotion ? undefined : { x: 3 }}
                          className="text-muted-foreground group-hover:text-foreground"
                        >
                          <ArrowRight size={16} />
                        </motion.span>
                      </Link>

                      {/* Individual platform items — staggered entrance. */}
                      <motion.div
                        className="py-1.5"
                        initial="hidden"
                        animate="visible"
                        variants={{
                          hidden: {},
                          visible: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
                        }}
                      >
                        {platformDropdownItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <motion.div
                              key={item.href}
                              variants={{
                                hidden: { opacity: 0, x: -6 },
                                visible: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE } },
                              }}
                            >
                              <Link
                                href={item.href}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors group"
                                onClick={() => setPlatformOpen(false)}
                              >
                                <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center text-gold-dark dark:text-gold flex-shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                                  <Icon size={16} />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground leading-tight">
                                    {item.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                    {item.description}
                                  </p>
                                </div>
                              </Link>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>

              {/* Other top-level links — same morphing pill. */}
              {topLevelLinks.map((link) => (
                <li
                  key={link.href}
                  className="relative"
                  onMouseEnter={() => setHoveredKey(link.href)}
                >
                  <Link
                    href={link.href}
                    className="relative px-3.5 py-2 text-[13.5px] font-medium text-muted-foreground hover:text-foreground rounded-full transition-colors inline-flex"
                  >
                    {hoveredKey === link.href && (
                      <motion.span
                        layoutId={HOVER_PILL_ID}
                        className="absolute inset-0 rounded-full bg-secondary/80"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-2">
              {/* ⌘K search trigger — visual only for v1. Matches the
                  Stripe/Linear/Vercel pattern of a pill-shaped search
                  affordance flanked by the keyboard shortcut. Wire to a
                  real command palette when search infra exists. */}
              <button
                type="button"
                disabled
                aria-label="Search (coming soon)"
                className="hidden lg:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground/70 hover:text-muted-foreground hover:bg-secondary/70 transition-colors cursor-not-allowed"
              >
                <span className="opacity-60">Search…</span>
                <kbd className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded border border-border/60 bg-background/80 text-[10px] font-mono">
                  <Command size={9} />K
                </kbd>
              </button>
              <ThemeToggle />
              <div className="h-5 w-px bg-border/60" aria-hidden="true" />
              <Button variant="outline" size="sm" asChild>
                <a href="https://app.mycargolens.com/login">Log in</a>
              </Button>
              <Button variant="gold" size="sm" asChild className="group relative overflow-hidden">
                <a href="https://app.mycargolens.com/register">
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    Start free
                    <motion.span
                      aria-hidden
                      className="inline-flex"
                      whileHover={reducedMotion ? undefined : { x: 2 }}
                    >
                      <ArrowRight size={13} />
                    </motion.span>
                  </span>
                  {/* Sheen overlay on hover — subtle, big-tech feel. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  />
                </a>
              </Button>
            </div>

            {/* Mobile hamburger — animated icon swap */}
            <button
              className="md:hidden p-2 -mr-2 rounded-md text-foreground/80 hover:text-foreground hover:bg-secondary/70 transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              <motion.span
                key={mobileOpen ? "x" : "m"}
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="inline-flex"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </motion.span>
            </button>
          </nav>

          {/* Mobile sheet — slides down, body scroll locked, staggered links */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                key="mobile-sheet"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="md:hidden overflow-hidden border-t border-border/60"
              >
                <motion.ul
                  className="flex flex-col gap-0.5 mb-3 pt-3"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
                  }}
                >
                  <motion.li
                    variants={{
                      hidden: { opacity: 0, y: -6 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
                    }}
                  >
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 text-[14px] font-medium text-foreground/85 hover:text-foreground rounded-md hover:bg-secondary/60 transition-colors"
                      onClick={() => setMobilePlatformOpen((v) => !v)}
                    >
                      <span>Platform</span>
                      <motion.span
                        animate={{ rotate: mobilePlatformOpen ? 180 : 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="flex items-center text-muted-foreground"
                      >
                        <ChevronDown size={14} />
                      </motion.span>
                    </button>
                    <AnimatePresence>
                      {mobilePlatformOpen && (
                        <motion.ul
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <li>
                            <Link
                              href="/features"
                              className="flex items-center gap-2 pl-8 pr-3 py-2 text-[13.5px] text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/60 transition-colors"
                              onClick={() => setMobileOpen(false)}
                            >
                              <ArrowRight size={13} className="flex-shrink-0" />
                              All features
                            </Link>
                          </li>
                          {platformDropdownItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  className="flex items-center gap-2 pl-8 pr-3 py-2 text-[13.5px] text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/60 transition-colors"
                                  onClick={() => setMobileOpen(false)}
                                >
                                  <Icon size={14} className="flex-shrink-0" />
                                  {item.title}
                                </Link>
                              </li>
                            );
                          })}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </motion.li>

                  {topLevelLinks.map((link) => (
                    <motion.li
                      key={link.href}
                      variants={{
                        hidden: { opacity: 0, y: -6 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
                      }}
                    >
                      <Link
                        href={link.href}
                        className="block px-3 py-2.5 text-[14px] font-medium text-foreground/85 hover:text-foreground rounded-md hover:bg-secondary/60 transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </motion.li>
                  ))}
                </motion.ul>

                <motion.div
                  className="flex flex-col gap-2 pb-4"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: EASE, delay: 0.18 }}
                >
                  <div className="flex items-center justify-between px-1 py-1">
                    <span className="text-xs text-muted-foreground">Appearance</span>
                    <ThemeToggle />
                  </div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href="https://app.mycargolens.com/login">Log in</a>
                  </Button>
                  <Button variant="gold" size="sm" className="w-full" asChild>
                    <a href="https://app.mycargolens.com/register">Start free</a>
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </Container>
      </header>
    </MotionConfig>
  );
}
