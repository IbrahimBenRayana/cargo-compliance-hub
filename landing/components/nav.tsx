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
  Compass,
  ShieldCheck,
  History,
  Mail,
  Target,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { Container } from "@/components/ui/container";
import { Magnetic } from "@/components/ui/magnetic";
import { ThemeToggle } from "@/components/theme-toggle";
import { Donut } from "@/components/ui/donut";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------------------------------------------------------------- */
/* Menu data                                                          */
/* ---------------------------------------------------------------- */

type MenuItem = {
  icon: typeof Ship;
  title: string;
  description: string;
  href: string;
};

const platformColumns: Array<{ heading: string; items: MenuItem[] }> = [
  {
    heading: "Filing & data",
    items: [
      {
        icon: Ship,
        title: "Filings",
        description: "ISF-10, ISF-5, ABI Entry, bulk, templates",
        href: "/platform/filings",
      },
      {
        icon: ListChecks,
        title: "Lifecycle",
        description: "Timeline, score history, PDF export",
        href: "/platform/lifecycle",
      },
    ],
  },
  {
    heading: "Compliance & alerts",
    items: [
      {
        icon: BarChart3,
        title: "Compliance Center",
        description: "Action queue, UFLPA, ADD/CVD, liquidation",
        href: "/platform/compliance",
      },
      {
        icon: Sparkles,
        title: "Automation",
        description: "CBP polling, Federal Register sync, alerts",
        href: "/platform/automation",
      },
    ],
  },
  {
    heading: "AI",
    items: [
      {
        icon: Bot,
        title: "AI tools",
        description: "Today's brief, rejection coach, HTS classifier",
        href: "/platform/ai",
      },
    ],
  },
];

const companyItems: MenuItem[] = [
  {
    icon: Compass,
    title: "About",
    description: "Who we are and why we build this",
    href: "/about",
  },
  {
    icon: Target,
    title: "Why MyCargoLens",
    description: "Our value vs. legacy customs software",
    href: "/why-mycargolens",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    description: "Auth, encryption, audit trail",
    href: "/security",
  },
  {
    icon: History,
    title: "Changelog",
    description: "What shipped, release by release",
    href: "/changelog",
  },
  {
    icon: Mail,
    title: "Contact",
    description: "Talk to the founders",
    href: "/contact",
  },
];

type MenuKey = "platform" | "company";
const MENU_ORDER: MenuKey[] = ["platform", "company"];

const plainLinks = [
  { label: "Solutions", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
];

/* ---------------------------------------------------------------- */
/* Nav                                                                */
/* ---------------------------------------------------------------- */

export function Nav() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [active, setActive] = React.useState<MenuKey | null>(null);
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const prevActive = React.useRef<MenuKey | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = React.useRef<HTMLElement | null>(null);
  const triggerRefs = React.useRef<Partial<Record<MenuKey, HTMLButtonElement>>>({});
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

  // Lock body scroll while the mobile sheet is open.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  // Escape closes whichever surface is open.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setActive(null);
      setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openMenu = (key: MenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Position is computed at open time: fixed width per menu, panel
    // centered under its trigger, clamped to the nav's box.
    const nav = navRef.current;
    const trigger = triggerRefs.current[key];
    if (nav && trigger) {
      const navW = nav.offsetWidth;
      const width = key === "platform" ? Math.min(720, navW) : Math.min(340, navW);
      const navBox = nav.getBoundingClientRect();
      const trigBox = trigger.getBoundingClientRect();
      const center = trigBox.left - navBox.left + trigBox.width / 2;
      const left = Math.max(0, Math.min(center - width / 2, navW - width));
      setBox({ left, width });
    }
    setActive((cur) => {
      prevActive.current = cur;
      return key;
    });
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActive(null), 140);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const closeNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActive(null);
  };

  // Direction of travel between the two menus drives the content slide.
  const direction =
    active && prevActive.current && active !== prevActive.current
      ? MENU_ORDER.indexOf(active) > MENU_ORDER.indexOf(prevActive.current)
        ? 1
        : -1
      : 0;

  return (
    <MotionConfig reducedMotion="user">
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-[backdrop-filter,background-color,border-color,box-shadow] duration-500 ease-out",
          scrolled || active !== null
            ? "border-b border-border/40 bg-[hsl(var(--background)/0.82)] shadow-[0_1px_0_0_hsl(var(--border)/0.4),0_8px_24px_-8px_hsl(var(--foreground)/0.08)] backdrop-blur-xl backdrop-saturate-150"
            : "border-b border-transparent bg-transparent shadow-none backdrop-blur-0",
        )}
      >
        {/* Gold hairline — fades in once the page is scrolled */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent transition-opacity duration-700",
            scrolled ? "opacity-100" : "opacity-0",
          )}
        />

        <Container>
          <nav
            ref={navRef}
            className={cn(
              "relative flex items-center justify-between transition-[height] duration-500 ease-out",
              scrolled ? "h-14" : "h-16",
            )}
          >
            <Link href="/" className="flex-shrink-0" aria-label="MyCargoLens home">
              <motion.span
                whileHover={reducedMotion ? undefined : { scale: 1.035 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="inline-flex"
              >
                <Wordmark />
              </motion.span>
            </Link>

            {/* Desktop links. One shared hover pill glides between items
                (layoutId), and one shared panel morphs between dropdowns. */}
            <ul
              className="hidden items-center gap-0.5 md:flex"
              onMouseLeave={() => setHovered(null)}
            >
              <NavTrigger
                label="Platform"
                menuKey="platform"
                active={active}
                hovered={hovered}
                setHovered={setHovered}
                openMenu={openMenu}
                scheduleClose={scheduleClose}
                registerRef={(el) => {
                  if (el) triggerRefs.current.platform = el;
                }}
              />
              {plainLinks.map((link) => (
                <li key={link.href} className="relative">
                  <Link
                    href={link.href}
                    className="relative block px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    onMouseEnter={() => {
                      setHovered(link.href);
                      scheduleClose();
                    }}
                  >
                    {hovered === link.href && <HoverPill />}
                    <span className="relative z-10">{link.label}</span>
                  </Link>
                </li>
              ))}
              <NavTrigger
                label="Company"
                menuKey="company"
                active={active}
                hovered={hovered}
                setHovered={setHovered}
                openMenu={openMenu}
                scheduleClose={scheduleClose}
                registerRef={(el) => {
                  if (el) triggerRefs.current.company = el;
                }}
              />
            </ul>

            {/* Desktop CTAs */}
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                disabled
                aria-label="Search (coming soon)"
                className="hidden h-9 cursor-not-allowed items-center gap-2 rounded-full border border-border/60 bg-secondary/40 pl-3 pr-2 text-xs text-muted-foreground/70 transition-colors hover:bg-secondary/70 hover:text-muted-foreground lg:inline-flex"
              >
                <span className="opacity-60">Search…</span>
                <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border/60 bg-background/80 px-1.5 font-mono text-[10px]">
                  <Command size={9} />K
                </kbd>
              </button>
              <ThemeToggle />
              <div className="h-5 w-px bg-border/60" aria-hidden="true" />
              <Button variant="outline" size="sm" asChild>
                <a href="https://app.mycargolens.com/login">Log in</a>
              </Button>
              <Magnetic strength={5}>
                <Button variant="gold" size="sm" asChild className="group relative overflow-hidden">
                  <Link href="/book-a-demo">
                    <span className="relative z-10 inline-flex items-center gap-1.5">
                      Request a demo
                      <motion.span
                        aria-hidden
                        className="inline-flex"
                        whileHover={reducedMotion ? undefined : { x: 2 }}
                      >
                        <ArrowRight size={13} />
                      </motion.span>
                    </span>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                    />
                  </Link>
                </Button>
              </Magnetic>
            </div>

            {/* Mobile hamburger */}
            <button
              className="-mr-2 rounded-md p-2 text-foreground/80 transition-colors hover:bg-secondary/70 hover:text-foreground md:hidden"
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

            {/* The one morphing panel */}
            <MorphPanel
              active={active}
              box={box}
              direction={direction}
              cancelClose={cancelClose}
              scheduleClose={scheduleClose}
              closeNow={closeNow}
            />
          </nav>

          <MobileSheet open={mobileOpen} close={() => setMobileOpen(false)} />
        </Container>
      </header>
    </MotionConfig>
  );
}

/* ---------------------------------------------------------------- */
/* Top-level pieces                                                   */
/* ---------------------------------------------------------------- */

function HoverPill() {
  return (
    <motion.span
      layoutId="nav-hover-pill"
      transition={{ duration: 0.25, ease: EASE }}
      className="absolute inset-0 z-0 rounded-full bg-secondary/80"
      aria-hidden
    />
  );
}

function NavTrigger({
  label,
  menuKey,
  active,
  hovered,
  setHovered,
  openMenu,
  scheduleClose,
  registerRef,
}: {
  label: string;
  menuKey: MenuKey;
  active: MenuKey | null;
  hovered: string | null;
  setHovered: (v: string | null) => void;
  openMenu: (k: MenuKey) => void;
  scheduleClose: () => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const isOpen = active === menuKey;
  return (
    <li className="relative">
      <button
        ref={registerRef}
        className={cn(
          "relative flex items-center gap-1 px-3 py-2 text-[14px] font-medium transition-colors",
          isOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onMouseEnter={() => {
          setHovered(menuKey);
          openMenu(menuKey);
        }}
        onMouseLeave={scheduleClose}
        onClick={() => (isOpen ? scheduleClose() : openMenu(menuKey))}
        onFocus={() => openMenu(menuKey)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {hovered === menuKey && <HoverPill />}
        <span className="relative z-10">{label}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="relative z-10 flex items-center"
        >
          <ChevronDown size={14} strokeWidth={2.2} />
        </motion.span>
      </button>
    </li>
  );
}

/* ---------------------------------------------------------------- */
/* Morphing dropdown panel                                            */
/* ---------------------------------------------------------------- */

/**
 * One panel serves every dropdown. When the visitor moves between
 * "Platform" and "Company" the panel itself glides and resizes — width,
 * height, and x-position all interpolate — while the content slides in
 * the direction of travel. The Stripe nav move, tuned to this brand's
 * easing.
 */
function MorphPanel({
  active,
  box,
  direction,
  cancelClose,
  scheduleClose,
  closeNow,
}: {
  active: MenuKey | null;
  box: { left: number; width: number } | null;
  direction: number;
  cancelClose: () => void;
  scheduleClose: () => void;
  closeNow: () => void;
}) {
  return (
    <AnimatePresence>
      {active && box && (
        <motion.div
          key="morph-panel"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="absolute left-0 right-0 top-full z-50 hidden pt-3 md:block"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {/* Size + position morph via FLIP layout animation: width and
              marginLeft change between menus, height follows the content
              swap — framer interpolates all of it in one gesture. */}
          <motion.div
            layout
            initial={false}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ width: box.width, marginLeft: box.left, borderRadius: 16 }}
            className="relative overflow-hidden border border-border/50 bg-card shadow-[0_24px_80px_-20px_hsl(var(--foreground)/0.25)]"
          >
            {/* Soft gold breath in the panel's top-right corner */}
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, hsl(43 96% 56% / 0.10) 0%, transparent 70%)",
              }}
            />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, x: direction * 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -32 }}
                transition={{ duration: 0.26, ease: EASE }}
                style={{ width: box.width }}
              >
                {active === "platform" ? (
                  <PlatformPanel close={closeNow} />
                ) : (
                  <CompanyPanel close={closeNow} />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } },
};

function MenuLink({ item, close }: { item: MenuItem; close: () => void }) {
  const Icon = item.icon;
  return (
    <motion.li variants={itemVariants}>
      <Link
        href={item.href}
        className="group -mx-2 block rounded-lg px-2 py-2 transition-colors hover:bg-secondary/60"
        onClick={close}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border/50 bg-background text-muted-foreground transition-colors duration-200 group-hover:border-gold/40 group-hover:bg-gold/10 group-hover:text-gold-dark dark:group-hover:text-gold">
            <Icon size={14} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[13.5px] font-semibold leading-tight text-foreground">
              {item.title}
              <ArrowRight
                size={11}
                className="-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-60"
                aria-hidden
              />
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {item.description}
            </p>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

function PlatformPanel({ close }: { close: () => void }) {
  return (
    <div className="grid grid-cols-[1fr_1fr_minmax(200px,230px)]">
      {/* Two product columns (third column folds into the first two) */}
      <motion.div
        className="px-5 py-5"
        initial="hidden"
        animate="visible"
        variants={listVariants}
      >
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {platformColumns[0].heading}
        </p>
        <ul className="space-y-1">
          {platformColumns[0].items.map((item) => (
            <MenuLink key={item.href} item={item} close={close} />
          ))}
        </ul>
        <p className="mb-3 mt-5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {platformColumns[2].heading}
        </p>
        <ul className="space-y-1">
          {platformColumns[2].items.map((item) => (
            <MenuLink key={item.href} item={item} close={close} />
          ))}
        </ul>
      </motion.div>

      <motion.div
        className="px-5 py-5"
        initial="hidden"
        animate="visible"
        variants={listVariants}
      >
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {platformColumns[1].heading}
        </p>
        <ul className="space-y-1">
          {platformColumns[1].items.map((item) => (
            <MenuLink key={item.href} item={item} close={close} />
          ))}
        </ul>
        <Link
          href="/features"
          onClick={close}
          className="group mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:text-gold-dark dark:hover:text-gold"
        >
          All features
          <ArrowRight
            size={12}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>
      </motion.div>

      {/* Featured rail — a living sliver of the product */}
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: EASE }}
        className="border-l border-border/50 bg-secondary/30 px-4 py-5"
      >
        <p className="mb-3 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="relative flex size-1.5" aria-hidden>
            <span className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          Live in the app
        </p>
        <div className="rounded-xl border border-border/60 bg-card p-3 shadow-card">
          <div className="flex items-center gap-2.5">
            <Donut value={86} tone="gold" size={38} strokeWidth={3.5} showLabel delay={0.25} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Today&apos;s brief
              </p>
              <p className="mt-0.5 truncate text-[11.5px] font-medium leading-snug text-foreground">
                3 drafts waiting on you.
              </p>
            </div>
          </div>
          <p className="mt-2.5 border-t border-border/50 pt-2 font-mono text-[10px] tabular-nums text-muted-foreground">
            Polling CBP every 5 minutes
          </p>
        </div>
        <Link
          href="/book-a-demo"
          onClick={close}
          className="group mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:text-gold-dark dark:hover:text-gold"
        >
          See it on your data
          <ArrowRight
            size={12}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>
      </motion.div>
    </div>
  );
}

function CompanyPanel({ close }: { close: () => void }) {
  return (
    <motion.div
      className="px-5 py-5"
      initial="hidden"
      animate="visible"
      variants={listVariants}
    >
      <ul className="space-y-1">
        {companyItems.map((item) => (
          <MenuLink key={item.href} item={item} close={close} />
        ))}
      </ul>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */
/* Mobile sheet                                                       */
/* ---------------------------------------------------------------- */

function MobileSheet({ open, close }: { open: boolean; close: () => void }) {
  const [openGroup, setOpenGroup] = React.useState<MenuKey | null>("platform");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-sheet"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="overflow-hidden border-t border-border/60 md:hidden"
        >
          <motion.div
            className="flex max-h-[calc(100dvh-4rem)] flex-col gap-0.5 overflow-y-auto pb-4 pt-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
            }}
          >
            <MobileGroup
              label="Platform"
              expanded={openGroup === "platform"}
              toggle={() =>
                setOpenGroup((g) => (g === "platform" ? null : "platform"))
              }
            >
              <MobileChild href="/features" close={close} icon={ArrowRight} title="All features" />
              {platformColumns.flatMap((c) => c.items).map((item) => (
                <MobileChild
                  key={item.href}
                  href={item.href}
                  close={close}
                  icon={item.icon}
                  title={item.title}
                />
              ))}
            </MobileGroup>

            {plainLinks.map((link) => (
              <motion.div key={link.href} variants={itemVariants}>
                <Link
                  href={link.href}
                  className="block rounded-md px-3 py-2.5 text-[14px] font-medium text-foreground/85 transition-colors hover:bg-secondary/60 hover:text-foreground"
                  onClick={close}
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}

            <MobileGroup
              label="Company"
              expanded={openGroup === "company"}
              toggle={() =>
                setOpenGroup((g) => (g === "company" ? null : "company"))
              }
            >
              {companyItems.map((item) => (
                <MobileChild
                  key={item.href}
                  href={item.href}
                  close={close}
                  icon={item.icon}
                  title={item.title}
                />
              ))}
            </MobileGroup>

            <motion.div
              className="mt-2 flex flex-col gap-2"
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
                <Link href="/book-a-demo" onClick={close}>
                  Request a demo
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MobileGroup({
  label,
  expanded,
  toggle,
  children,
}: {
  label: string;
  expanded: boolean;
  toggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div variants={itemVariants}>
      <button
        className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-[14px] font-medium text-foreground/85 transition-colors hover:bg-secondary/60 hover:text-foreground"
        onClick={toggle}
        aria-expanded={expanded}
      >
        <span>{label}</span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="flex items-center text-muted-foreground"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            {children}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MobileChild({
  href,
  close,
  icon: Icon,
  title,
}: {
  href: string;
  close: () => void;
  icon: typeof Ship;
  title: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 rounded-md py-2 pl-8 pr-3 text-[13.5px] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        onClick={close}
      >
        <Icon size={14} className="flex-shrink-0" />
        {title}
      </Link>
    </li>
  );
}
