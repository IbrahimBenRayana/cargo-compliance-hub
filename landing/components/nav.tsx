"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, Menu, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";
import { SiteContainer } from "@/components/site/section";
import { DemoButton } from "@/components/site/cta";
import { ThemeSwitch } from "@/components/site/theme-switch";
import { NAV_EASE, NavPanel, PANEL_WIDTH } from "@/components/site/nav-panels";
import { MobileSheet } from "@/components/site/nav-mobile";
import { APP_LOGIN_URL, HEADER_MENUS, HEADER_ORDER, ROUTES, UI_STRINGS, menuItems, type MenuKey } from "@/lib/site";

const MENU_ORDER = HEADER_MENUS.map((m) => m.key);
/** Hover intent before the first menu opens (wireframe 01: ~120ms). */
const OPEN_DELAY = 110;
const CLOSE_DELAY = 140;

/** Pages that use the minimal header: logo + "Back to site" (book-a-demo.md §2, global.md §1). */
const MINIMAL_HEADER = [ROUTES.bookADemo.href];

/*
 * Header: a calm inset bar. At the top of the page it sits flat on the paper
 * background; once the page scrolls (or a menu opens) it becomes a floating
 * card surface with a hairline border and a soft shadow. One dropdown panel
 * glides between menus. Gold stays on Book a demo only.
 */

/** Shared bar shell so the full and minimal headers line up exactly. */
function Bar({
  raised,
  scrolled,
  children,
  barRef,
}: {
  raised: boolean;
  /** The outer band stays paper until the page moves, so no body colour shows behind the bar. */
  scrolled: boolean;
  children: React.ReactNode;
  barRef?: React.Ref<HTMLElement>;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full py-2 transition-[background-color] duration-200",
        scrolled ? "bg-transparent" : "bg-[hsl(var(--paper))]",
      )}
    >
      <SiteContainer>
        <nav
          ref={barRef}
          aria-label="Main"
          className={cn(
            "relative -mx-3 flex h-12 items-center justify-between gap-3 rounded-2xl border pl-3 pr-1.5",
            "transition-[background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-quart)]",
            raised
              ? "border-[hsl(var(--surface-border))] bg-[hsl(var(--card)/0.88)] shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_8px_24px_-12px_hsl(var(--foreground)/0.16)] backdrop-blur-xl backdrop-saturate-150 [@media(prefers-reduced-transparency:reduce)]:bg-[hsl(var(--card))]"
              : "border-transparent",
          )}
        >
          {children}
        </nav>
      </SiteContainer>
    </header>
  );
}

function useScrolled() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = React.useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y >= 8));
  return scrolled;
}

export function Nav() {
  const pathname = usePathname() ?? "/";
  const minimal = MINIMAL_HEADER.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return minimal ? <MinimalHeader /> : <FullNav />;
}

function HomeLink() {
  return (
    <Link href="/" className="flex-shrink-0 rounded-lg" aria-label="MyCargoLens home">
      <Wordmark />
    </Link>
  );
}

/** Conversion pages: logo, Back to site and the theme switch. No menus, no demo button. */
function MinimalHeader() {
  const scrolled = useScrolled();
  return (
    <Bar raised={scrolled} scrolled={scrolled}>
      <HomeLink />
      <div className="flex items-center gap-1.5">
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden />
          {UI_STRINGS.backToSite}
        </Link>
        <ThemeSwitch compact />
      </div>
    </Bar>
  );
}

function FullNav() {
  const pathname = usePathname() ?? "/";
  const scrolled = useScrolled();

  const [mobileOpen, setMobileOpen] = React.useState(false);
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
        ? Array.from(
            root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea, [tabindex]"),
          ).filter((el) => el.tabIndex >= 0)
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

  // The sheet supplies its own surface, so the bar stays flat on top of it.
  const raised = (scrolled || active !== null) && !mobileOpen;
  const inSection = (k: MenuKey) => menuItems(k).some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <MotionConfig reducedMotion="user">
      <Bar raised={raised} scrolled={scrolled} barRef={navRef}>
        <HomeLink />

        {/* Desktop menus: one hover pill glides between items, one panel glides between menus. */}
        <ul
          className="hidden items-center gap-0.5 lg:flex xl:absolute xl:left-1/2 xl:-translate-x-1/2"
          onMouseLeave={() => setHovered(null)}
        >
          {HEADER_ORDER.map((item) =>
            item === "pricing" ? (
              <li key="pricing" className="relative">
                <Link
                  href={ROUTES.pricing.href}
                  aria-current={pathname === ROUTES.pricing.href ? "page" : undefined}
                  className="relative flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground aria-[current=page]:text-foreground"
                  onMouseEnter={() => {
                    setHovered("pricing");
                    scheduleClose();
                  }}
                >
                  {hovered === "pricing" && <HoverPill />}
                  <span className="relative">{ROUTES.pricing.label}</span>
                </Link>
              </li>
            ) : (
              <NavTrigger
                key={item}
                menuKey={item}
                label={HEADER_MENUS.find((m) => m.key === item)!.label}
                open={active === item}
                current={inSection(item)}
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

        <div className="hidden items-center gap-1 lg:flex">
          <ThemeSwitch compact className="mr-1.5" />
          <a
            href={APP_LOGIN_URL}
            data-location="nav"
            className="flex h-9 items-center rounded-full px-3 text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Log in
          </a>
          <DemoButton location="nav" src="nav" size="sm" className="h-9 rounded-xl px-4 text-[13.5px]" />
        </div>

        {/* Mobile: compact demo button + menu toggle */}
        <div className="flex items-center gap-1.5 lg:hidden">
          {/* hidden while the sheet is open: its pinned button is the one gold button */}
          {!mobileOpen && <DemoButton location="nav" src="nav" size="sm" className="h-9 rounded-xl px-3.5 text-[13px]" />}
          <button
            ref={mobileBtnRef}
            type="button"
            className="relative grid size-10 place-items-center rounded-xl text-foreground transition-colors duration-150 hover:bg-secondary/70 active:bg-secondary"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={mobileOpen ? "x" : "m"}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, ease: NAV_EASE }}
                className="inline-flex"
              >
                {mobileOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <NavPanel
          active={active}
          box={box}
          direction={direction}
          cancelClose={cancelClose}
          scheduleClose={scheduleClose}
          close={() => closeNow()}
        />
      </Bar>

      <MobileSheet open={mobileOpen} close={() => setMobileOpen(false)} />
    </MotionConfig>
  );
}

function HoverPill() {
  return (
    <motion.span
      layoutId="nav-hover-pill"
      transition={{ duration: 0.18, ease: NAV_EASE }}
      className="absolute inset-0 rounded-full bg-secondary/70"
      aria-hidden
    />
  );
}

function NavTrigger({
  menuKey,
  label,
  open,
  current,
  hovered,
  onHover,
  onLeave,
  onToggle,
  registerRef,
}: {
  menuKey: MenuKey;
  label: string;
  open: boolean;
  current: boolean;
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
          "relative flex h-9 items-center gap-1 rounded-full pl-3.5 pr-2.5 text-[14px] font-medium transition-colors duration-150",
          open || current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`menu-${menuKey}`}
      >
        {(hovered || open) && <HoverPill />}
        <span className="relative">{label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          aria-hidden
          className={cn(
            "relative opacity-60 transition-transform duration-200 ease-[var(--ease-out-quart)]",
            open && "rotate-180",
          )}
        />
      </button>
    </li>
  );
}
