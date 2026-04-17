"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X, Ship, BarChart3, Users, ChevronDown, ArrowRight } from "lucide-react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/theme-toggle";

const EASE = [0.22, 1, 0.36, 1] as const;

const featuresDropdownItems = [
  {
    icon: Ship,
    title: "ISF Filing",
    description: "ISF 10+2 and ISF-5 for ocean cargo",
    href: "/features/isf-filing",
  },
  {
    icon: BarChart3,
    title: "Compliance",
    description: "Filing scores and audit readiness",
    href: "/features/compliance",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Multi-user, multi-org workspaces",
    href: "/features/team",
  },
];

const topLevelLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Nav() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [featuresOpen, setFeaturesOpen] = React.useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const featuresTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      const shouldBeScrolled = window.scrollY >= 8;
      setScrolled((prev) => (prev !== shouldBeScrolled ? shouldBeScrolled : prev));
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleFeaturesMouseEnter = () => {
    if (featuresTimeout.current) clearTimeout(featuresTimeout.current);
    setFeaturesOpen(true);
  };

  const handleFeaturesMouseLeave = () => {
    featuresTimeout.current = setTimeout(() => setFeaturesOpen(false), 120);
  };

  return (
    <MotionConfig reducedMotion="user">
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300 ease-out",
          scrolled
            ? "border-b border-border/40 shadow-card bg-[hsl(var(--background)/0.92)] backdrop-blur-2xl backdrop-saturate-150"
            : "bg-transparent border-b border-transparent shadow-none"
        )}
      >
        <Container>
          <nav className="flex h-16 items-center justify-between">
            {/* Wordmark */}
            <Link href="/" className="flex-shrink-0 hover:opacity-90 transition-opacity">
              <Wordmark />
            </Link>

            {/* Desktop center links */}
            <ul className="hidden md:flex items-center gap-1">
              {/* Features with dropdown */}
              <li
                className="relative"
                onMouseEnter={handleFeaturesMouseEnter}
                onMouseLeave={handleFeaturesMouseLeave}
              >
                <button
                  className="flex items-center gap-1 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                  onClick={() => setFeaturesOpen((v) => !v)}
                  aria-expanded={featuresOpen}
                  aria-haspopup="true"
                >
                  Features
                  <motion.span
                    animate={{ rotate: featuresOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="flex items-center"
                  >
                    <ChevronDown size={14} />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {featuresOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="absolute top-full left-0 mt-2 border border-border/40 rounded-xl shadow-[0_8px_30px_-4px_hsl(var(--foreground)/0.12),0_0_0_1px_hsl(var(--border)/0.6)] min-w-[320px] overflow-hidden bg-[hsl(var(--card)/0.96)] backdrop-blur-2xl backdrop-saturate-150"
                      onMouseEnter={handleFeaturesMouseEnter}
                      onMouseLeave={handleFeaturesMouseLeave}
                    >
                      {/* All Features row */}
                      <Link
                        href="/features"
                        className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/60 transition-colors border-b border-border/40 group"
                        onClick={() => setFeaturesOpen(false)}
                      >
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-0.5">
                            All Features
                          </p>
                          <p className="text-sm text-foreground font-medium">
                            Overview of every capability
                          </p>
                        </div>
                        <ArrowRight
                          size={16}
                          className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all"
                        />
                      </Link>

                      {/* Individual feature items */}
                      <div className="py-1.5">
                        {featuresDropdownItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors"
                              onClick={() => setFeaturesOpen(false)}
                            >
                              <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center text-gold-dark dark:text-gold flex-shrink-0 mt-0.5">
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
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>

              {/* Other top-level links */}
              {topLevelLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <div className="h-5 w-px bg-border" aria-hidden="true" />
              <Button variant="outline" size="sm" asChild>
                <a href="https://app.mycargolens.com/login">Log in</a>
              </Button>
              <Button variant="gold" size="sm" asChild>
                <a href="https://app.mycargolens.com/register">Start free</a>
              </Button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </nav>

          {/* Mobile panel */}
          {mobileOpen && (
            <div className="md:hidden pb-4 border-t border-border/60 pt-3">
              <ul className="flex flex-col gap-1 mb-4">
                {/* Features expandable */}
                <li>
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                    onClick={() => setMobileFeaturesOpen((v) => !v)}
                  >
                    <span>Features</span>
                    <motion.span
                      animate={{ rotate: mobileFeaturesOpen ? 180 : 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="flex items-center"
                    >
                      <ChevronDown size={14} />
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {mobileFeaturesOpen && (
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
                            className="flex items-center gap-2 pl-8 pr-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                            onClick={() => setMobileOpen(false)}
                          >
                            <ArrowRight size={13} className="flex-shrink-0" />
                            All Features
                          </Link>
                        </li>
                        {featuresDropdownItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                className="flex items-center gap-2 pl-8 pr-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
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
                </li>

                {/* Other links */}
                {topLevelLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1 py-1">
                  <ThemeToggle />
                  <span className="text-sm text-muted-foreground">Toggle theme</span>
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a href="https://app.mycargolens.com/login">Log in</a>
                </Button>
                <Button variant="gold" size="sm" className="w-full" asChild>
                  <a href="https://app.mycargolens.com/register">Start free</a>
                </Button>
              </div>
            </div>
          )}
        </Container>
      </header>
    </MotionConfig>
  );
}
