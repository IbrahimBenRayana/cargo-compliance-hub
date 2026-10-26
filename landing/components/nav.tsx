"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";
import { SiteContainer } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";
import { CertBadge } from "@/components/site/cert-badge";
import { ACCENTS, accentClass } from "@/lib/accents";
import {
  APP_LOGIN_URL,
  BROKER_PILOT_LINE,
  CERT_BADGE,
  HEADER_MENUS,
  HEADER_ORDER,
  PLATFORM_COLUMNS,
  ROUTES,
  UI_STRINGS,
  menuItems,
  platformColumn,
  type MenuKey,
  type SiteRoute,
} from "@/lib/site";

const EASE = [0.22, 1, 0.36, 1] as const;
const noopSubscribe = () => () => {};
const MENU_ORDER = HEADER_MENUS.map((m) => m.key);
const PANEL_WIDTH: Record<MenuKey, number> = {
  platform: 900,
  solutions: 400,
  resources: 380,
  company: 360,
};
/** Hover intent before the first menu opens (wireframe 01: ~120ms). */
const OPEN_DELAY = 110;
const CLOSE_DELAY = 140;

/** Pages that use the minimal header: logo + "Back to site" (book-a-demo.md §2, global.md §1). */
const MINIMAL_HEADER = [ROUTES.bookADemo.href];

/* ---------------------------------------------------------------- */
/* Nav                                                                */
/* ---------------------------------------------------------------- */

export function Nav() {
  const pathname = usePathname() ?? "/";
  const minimal = MINIMAL_HEADER.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return minimal ? <MinimalHeader /> : <FullNav />;
}

/** Conversion pages: no menus, no header demo button. */
function MinimalHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[hsl(var(--paper))]">
      <SiteContainer>
        <nav aria-label="Main" className="flex h-14 items-center justify-between gap-4 lg:h-16">
          <Link href="/" className="flex-shrink-0 rounded-md" aria-label="MyCargoLens home">
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} aria-hidden />
            {UI_STRINGS.backToSite}
          </Link>
        </nav>
      </SiteContainer>
    </header>
  );
}

function FullNav() {
  const pathname = usePathname() ?? "/";

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [active, setActive] = React.useState<MenuKey | null>(null);
  const [direction, setDirection] = React.useState(0);
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const activeRef = React.useRef<MenuKey | null>(null);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = React.useRef<HTMLElement | null>(null);
  const triggerRefs = React.useRef<Partial<Record<MenuKey, HTMLButtonElement>>>({});
  const mobileBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY >= 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    // first read happens in a frame so the effect never sets state synchronously
    const id = requestAnimationFrame(onScroll);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Close everything on route change (adjusting state while rendering, per
  // React docs, instead of an effect).
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
    setActive(null);
  }

  // Lock body scroll while the mobile sheet is open.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  React.useEffect(() => clearTimers, []);

  const openMenu = React.useCallback((key: MenuKey) => {
    clearTimers();
    const nav = navRef.current;
    const trigger = triggerRefs.current[key];
    if (nav && trigger) {
      const navW = nav.offsetWidth;
      const width = Math.min(PANEL_WIDTH[key], navW);
      const navBox = nav.getBoundingClientRect();
      const trigBox = trigger.getBoundingClientRect();
      const center = trigBox.left - navBox.left + trigBox.width / 2;
      setBox({ left: Math.max(0, Math.min(center - width / 2, navW - width)), width });
    }
    const prev = activeRef.current;
    setDirection(prev && prev !== key ? (MENU_ORDER.indexOf(key) > MENU_ORDER.indexOf(prev) ? 1 : -1) : 0);
    activeRef.current = key;
    setActive(key);
  }, []);

  /** Hover: wait a beat before the first open; switch instantly once open. */
  const hoverOpen = (key: MenuKey) => {
    clearTimers();
    if (activeRef.current) openMenu(key);
    else openTimer.current = setTimeout(() => openMenu(key), OPEN_DELAY);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => {
      activeRef.current = null;
      setActive(null);
    }, CLOSE_DELAY);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const closeNow = React.useCallback((refocus = false) => {
    clearTimers();
    const key = activeRef.current;
    activeRef.current = null;
    setActive(null);
    if (refocus && key) triggerRefs.current[key]?.focus();
  }, []);

  // Escape closes whichever surface is open and returns focus to its trigger.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activeRef.current) closeNow(true);
      // the sheet only exists while open: send focus back to its toggle
      if (document.getElementById("mobile-menu")?.contains(document.activeElement)) mobileBtnRef.current?.focus();
      setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeNow]);

  // Keyboard bridge: the dropdown panel sits after the header actions in the
  // DOM and the mobile sheet is portalled to <body>, so plain Tab order would
  // skip past them. Tab from an open trigger enters its panel; leaving either
  // end hands focus back to the trigger. The mobile sheet keeps focus inside
  // itself and its toggle while open.
  React.useEffect(() => {
    const focusables = (root: Element | null) =>
      root
        ? Array.from(root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])"))
        : [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = document.activeElement;
      const key = activeRef.current;
      if (key) {
        const trigger = triggerRefs.current[key];
        const items = focusables(document.getElementById(`menu-${key}`));
        if (!trigger || !items.length) return;
        if (el === trigger && !e.shiftKey) {
          e.preventDefault();
          items[0].focus();
        } else if (el === items[0] && e.shiftKey) {
          e.preventDefault();
          trigger.focus();
        } else if (el === items[items.length - 1] && !e.shiftKey) {
          // close, then let the browser's Tab continue from the trigger
          closeNow();
          trigger.focus();
        }
        return;
      }
      const btn = mobileBtnRef.current;
      const items = focusables(document.getElementById("mobile-menu"));
      if (!btn || !items.length) return;
      if (el === btn && !e.shiftKey) {
        e.preventDefault();
        items[0].focus();
      } else if (el === btn && e.shiftKey) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if ((el === items[items.length - 1] && !e.shiftKey) || (el === items[0] && e.shiftKey)) {
        e.preventDefault();
        btn.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeNow]);

  const raised = scrolled || active !== null || mobileOpen;

  return (
    <MotionConfig reducedMotion="user">
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-[backdrop-filter,background-color,box-shadow] duration-300 ease-[var(--ease-out-quart)]",
          raised
            ? "bg-[hsl(var(--background)/0.92)] shadow-[0_4px_16px_-8px_hsl(var(--foreground)/0.08),0_12px_32px_-16px_hsl(var(--foreground)/0.1)] backdrop-blur-xl backdrop-saturate-150"
            : "bg-[hsl(var(--paper))]",
        )}
      >
        <SiteContainer>
          <nav
            ref={navRef}
            aria-label="Main"
            className="relative flex h-14 items-center justify-between gap-4 lg:h-16"
          >
            <Link href="/" className="flex-shrink-0 rounded-md" aria-label="MyCargoLens home">
              <motion.span
                whileHover={reducedMotion ? undefined : { scale: 1.03 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="inline-flex"
              >
                <Wordmark />
              </motion.span>
            </Link>

            {/* Desktop menus: one hover pill glides between items, one panel morphs between menus. */}
            <ul className="hidden items-center gap-0.5 lg:flex" onMouseLeave={() => setHovered(null)}>
              {HEADER_ORDER.map((item) =>
                item === "pricing" ? (
                  <li key="pricing" className="relative">
                    <Link
                      href={ROUTES.pricing.href}
                      aria-current={pathname === ROUTES.pricing.href ? "page" : undefined}
                      className="relative block rounded-full px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
                      onMouseEnter={() => {
                        setHovered("pricing");
                        scheduleClose();
                      }}
                    >
                      {hovered === "pricing" && <HoverPill />}
                      <span className="relative z-10">{ROUTES.pricing.label}</span>
                    </Link>
                  </li>
                ) : (
                  <NavTrigger
                    key={item}
                    menuKey={item}
                    label={HEADER_MENUS.find((m) => m.key === item)!.label}
                    open={active === item}
                    hovered={hovered === item}
                    onHover={() => {
                      setHovered(item);
                      hoverOpen(item);
                    }}
                    onLeave={scheduleClose}
                    onToggle={() => (active === item ? closeNow() : openMenu(item))}
                    registerRef={(el) => {
                      if (el) triggerRefs.current[item] = el;
                    }}
                  />
                ),
              )}
            </ul>

            <div className="hidden items-center gap-1.5 lg:flex">
              <a
                href={APP_LOGIN_URL}
                data-location="nav"
                className="rounded-full px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Log in
              </a>
              <DemoButton location="nav" src="nav" size="sm" className="h-9 px-4 text-[13.5px]" />
            </div>

            {/* Mobile: compact demo button + menu */}
            <div className="flex items-center gap-2 lg:hidden">
              {/* hidden while the sheet is open: its pinned button is the one gold button */}
              {!mobileOpen && (
                <DemoButton location="nav" src="nav" size="sm" className="h-9 px-3.5 text-[13px]" />
              )}
              <button
                ref={mobileBtnRef}
                type="button"
                className="grid size-10 place-items-center rounded-xl border border-border/70 bg-[hsl(var(--card)/0.7)] text-foreground transition-colors hover:bg-secondary"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                <motion.span
                  key={mobileOpen ? "x" : "m"}
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="inline-flex"
                >
                  {mobileOpen ? <X size={19} /> : <Menu size={19} />}
                </motion.span>
              </button>
            </div>

            <MorphPanel
              active={active}
              box={box}
              direction={direction}
              cancelClose={cancelClose}
              scheduleClose={scheduleClose}
              close={() => closeNow()}
            />
          </nav>
        </SiteContainer>

        <MobileSheet open={mobileOpen} close={() => setMobileOpen(false)} />
      </header>
    </MotionConfig>
  );
}

/* ---------------------------------------------------------------- */
/* Triggers                                                           */
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
  menuKey,
  label,
  open,
  hovered,
  onHover,
  onLeave,
  onToggle,
  registerRef,
}: {
  menuKey: MenuKey;
  label: string;
  open: boolean;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onToggle: () => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <li className="relative">
      <button
        ref={registerRef}
        type="button"
        className={cn(
          "relative flex items-center gap-1 rounded-full px-3 py-2 text-[14px] font-medium transition-colors",
          open ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`menu-${menuKey}`}
      >
        {hovered && <HoverPill />}
        <span className="relative z-10">{label}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="relative z-10 flex items-center"
        >
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden />
        </motion.span>
      </button>
    </li>
  );
}

/* ---------------------------------------------------------------- */
/* Morphing dropdown panel (FLIP layout, PR #126)                     */
/* ---------------------------------------------------------------- */

function MorphPanel({
  active,
  box,
  direction,
  cancelClose,
  scheduleClose,
  close,
}: {
  active: MenuKey | null;
  box: { left: number; width: number } | null;
  direction: number;
  cancelClose: () => void;
  scheduleClose: () => void;
  close: () => void;
}) {
  return (
    <AnimatePresence>
      {active && box && (
        <motion.div
          key="morph-panel"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16, ease: EASE } }}
          transition={{ duration: 0.24, ease: EASE }}
          style={{ transformOrigin: `${box.left + box.width / 2}px top` }}
          className="absolute left-0 right-0 top-full z-50 hidden pt-2 lg:block"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {/* width + marginLeft change between menus and height follows the content: framer interpolates all of it. */}
          <motion.div
            layout
            initial={false}
            transition={{ duration: 0.3, ease: EASE }}
            style={{ width: box.width, marginLeft: box.left, borderRadius: 18 }}
            className="relative overflow-hidden border border-border/60 bg-[hsl(var(--card)/0.98)] shadow-[0_24px_80px_-20px_hsl(var(--foreground)/0.28)] backdrop-blur-2xl backdrop-saturate-150"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={active}
                id={`menu-${active}`}
                initial={{ opacity: 0, x: direction * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -28 }}
                transition={{ duration: 0.26, ease: EASE }}
                style={{ width: box.width }}
              >
                {active === "platform" ? (
                  <PlatformPanel close={close} />
                ) : (
                  <ListPanel menu={active} close={close} />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } },
};

const columnHeading = "mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

function ModuleLink({ item, close }: { item: SiteRoute; close: () => void }) {
  const Icon = item.module ? ACCENTS[item.module].icon : ArrowRight;
  return (
    <motion.li variants={itemVariants}>
      <Link
        href={item.href}
        onClick={close}
        className={cn("group -mx-2.5 flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-secondary/60", accentClass(item.module))}
      >
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-a-soft text-a-ink shadow-[inset_0_0_0_1px_hsl(var(--a)/0.22)]">
          <Icon size={16} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[15px] font-semibold leading-tight text-foreground">
            {item.label}
            <ArrowRight
              size={12}
              aria-hidden
              className="-translate-x-1 opacity-0 transition-[transform,opacity] duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0 group-hover:opacity-60"
            />
          </span>
          <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{item.blurb}</span>
        </span>
      </Link>
    </motion.li>
  );
}

function PlatformPanel({ close }: { close: () => void }) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_1fr_220px] gap-6 p-6 pb-5">
        {PLATFORM_COLUMNS.map((col) => (
          <motion.div key={col.key} initial="hidden" animate="visible" variants={listVariants}>
            <p className={columnHeading}>{col.heading}</p>
            <ul className="space-y-0.5">
              {platformColumn(col.key).map((item) => (
                <ModuleLink key={item.href} item={item} close={close} />
              ))}
            </ul>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE, delay: 0.1 }}
          className="flex flex-col rounded-2xl bg-secondary/50 p-4"
        >
          <CertBadge />
          <p className="mt-3 text-[13px] leading-snug text-muted-foreground">{CERT_BADGE.line}</p>
          <Link
            href={CERT_BADGE.href}
            onClick={close}
            className="group mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-foreground"
          >
            {ROUTES.security.label}
            <ArrowRight size={12} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
      <Link
        href={ROUTES.platform.href}
        onClick={close}
        className="group flex items-center justify-between border-t border-border/60 px-6 py-3.5 text-[13.5px] transition-colors hover:bg-secondary/40"
      >
        <span>
          <span className="font-semibold text-foreground">{ROUTES.platform.label}</span>
          <span className="text-muted-foreground"> · {ROUTES.platform.blurb}</span>
        </span>
        <ArrowRight size={14} aria-hidden className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function ListPanel({ menu, close }: { menu: Exclude<MenuKey, "platform">; close: () => void }) {
  return (
    <div>
      <motion.ul className="space-y-0.5 p-5" initial="hidden" animate="visible" variants={listVariants}>
        {menuItems(menu).map((item) => (
          <motion.li key={item.href} variants={itemVariants}>
            <Link
              href={item.href}
              onClick={close}
              className="group -mx-1 block rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60"
            >
              <span className="flex items-center gap-1 text-[15px] font-semibold leading-tight text-foreground">
                {item.label}
                <ArrowRight
                  size={12}
                  aria-hidden
                  className="-translate-x-1 opacity-0 transition-[transform,opacity] duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0 group-hover:opacity-60"
                />
              </span>
              {item.blurb && <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{item.blurb}</span>}
            </Link>
          </motion.li>
        ))}
      </motion.ul>
      {menu === "solutions" && (
        <Link
          href={BROKER_PILOT_LINE.href}
          onClick={close}
          data-cta-id="book_demo"
          data-location="nav"
          className="group flex items-center justify-between border-t border-border/60 px-6 py-3.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
        >
          {BROKER_PILOT_LINE.label}
          <ArrowRight size={14} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Mobile sheet                                                       */
/* ---------------------------------------------------------------- */

function MobileSheet({ open, close }: { open: boolean; close: () => void }) {
  const [group, setGroup] = React.useState<MenuKey | null>("platform");
  const toggle = (k: MenuKey) => setGroup((g) => (g === k ? null : k));

  const groupItems = (k: MenuKey): SiteRoute[] =>
    k === "platform" ? [ROUTES.platform, ...menuItems("platform").filter((x) => x.href !== ROUTES.platform.href)] : menuItems(k);

  // Portalled to <body>: the header's backdrop-filter would otherwise become
  // the containing block of this fixed sheet and collapse it to the bar.
  const mounted = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-sheet"
          id="mobile-menu"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE } }}
          transition={{ duration: 0.24, ease: EASE }}
          className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col border-t border-border/60 bg-background lg:hidden"
        >
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
            {HEADER_ORDER.map((k) =>
              k === "pricing" ? (
                <Link
                  key="pricing"
                  href={ROUTES.pricing.href}
                  onClick={close}
                  className="flex min-h-12 items-center border-b border-border/60 text-[16px] font-semibold text-foreground"
                >
                  {ROUTES.pricing.label}
                </Link>
              ) : (
                <div key={k} className="border-b border-border/60">
                  <button
                    type="button"
                    onClick={() => toggle(k)}
                    aria-expanded={group === k}
                    className="flex min-h-12 w-full items-center justify-between text-left text-[16px] font-semibold text-foreground"
                  >
                    {HEADER_MENUS.find((m) => m.key === k)!.label}
                    <motion.span animate={{ rotate: group === k ? 180 : 0 }} transition={{ duration: 0.2, ease: EASE }}>
                      <ChevronDown size={16} className="text-muted-foreground" aria-hidden />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {group === k && (
                      <motion.ul
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <div className="pb-3">
                          {groupItems(k).map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={close}
                                className={cn(
                                  "flex min-h-11 items-center gap-3 rounded-lg px-2 text-[15px] text-foreground/85 transition-colors hover:bg-secondary/60",
                                  accentClass(item.module),
                                )}
                              >
                                {item.module ? (
                                  <span aria-hidden className="size-2 rounded-[3px] bg-a" />
                                ) : (
                                  <span aria-hidden className="size-2" />
                                )}
                                {item.label}
                              </Link>
                            </li>
                          ))}
                          {k === "solutions" && (
                            <li>
                              <Link
                                href={BROKER_PILOT_LINE.href}
                                onClick={close}
                                className="flex min-h-11 items-center gap-3 px-2 text-[14px] text-muted-foreground"
                              >
                                <span aria-hidden className="size-2" />
                                {BROKER_PILOT_LINE.label}
                              </Link>
                            </li>
                          )}
                        </div>
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              ),
            )}
            <a href={APP_LOGIN_URL} className="flex min-h-12 items-center text-[16px] text-muted-foreground">
              Log in
            </a>
          </nav>
          <div className="border-t border-border/60 bg-[hsl(var(--card))] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DemoButton location="nav" src="nav" size="lg" className="w-full" onClick={close} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
