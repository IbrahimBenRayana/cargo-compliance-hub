"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { accentClass } from "@/lib/accents";
import { DemoButton } from "@/components/site/cta";
import { ThemeSwitch } from "@/components/site/theme-switch";
import { AccentDot, NAV_EASE } from "@/components/site/nav-panels";
import {
  APP_LOGIN_URL,
  BROKER_PILOT_LINE,
  HEADER_MENUS,
  HEADER_ORDER,
  ROUTES,
  menuItems,
  type MenuKey,
  type SiteRoute,
} from "@/lib/site";

const noopSubscribe = () => () => {};

const groupItems = (k: MenuKey): SiteRoute[] =>
  k === "platform" ? [ROUTES.platform, ...menuItems("platform").filter((x) => x.href !== ROUTES.platform.href)] : menuItems(k);

const rowLink =
  "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[16px] text-foreground/90 transition-colors duration-150 active:bg-secondary/70";

/**
 * Full-height mobile sheet under the header bar. Groups collapse; the theme
 * switch, Log in and the one gold Book a demo stay pinned at the bottom.
 * Portalled to <body>: the bar's backdrop-filter would otherwise become the
 * containing block of this fixed sheet. Focus is kept inside by the nav.
 */
export function MobileSheet({ open, close }: { open: boolean; close: () => void }) {
  const [group, setGroup] = React.useState<MenuKey | null>("platform");
  const toggle = (k: MenuKey) => setGroup((g) => (g === k ? null : k));

  const mounted = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-sheet"
          id="mobile-menu"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.14, ease: NAV_EASE } }}
          transition={{ duration: 0.22, ease: NAV_EASE }}
          className="fixed inset-0 z-40 flex flex-col bg-[hsl(var(--paper))] pt-16 lg:hidden"
        >
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-2">
            {HEADER_ORDER.map((k) =>
              k === "pricing" ? (
                <Link
                  key="pricing"
                  href={ROUTES.pricing.href}
                  onClick={close}
                  className="flex min-h-14 items-center rounded-xl px-3 text-[17px] font-semibold text-foreground active:bg-secondary/70"
                >
                  {ROUTES.pricing.label}
                </Link>
              ) : (
                <div key={k}>
                  <button
                    type="button"
                    onClick={() => toggle(k)}
                    aria-expanded={group === k}
                    aria-controls={`mobile-group-${k}`}
                    className="flex min-h-14 w-full items-center justify-between rounded-xl px-3 text-left text-[17px] font-semibold text-foreground active:bg-secondary/70"
                  >
                    {HEADER_MENUS.find((m) => m.key === k)!.label}
                    <motion.span
                      animate={{ rotate: group === k ? 180 : 0 }}
                      transition={{ duration: 0.2, ease: NAV_EASE }}
                      className="grid size-7 place-items-center rounded-full bg-secondary/60"
                    >
                      <ChevronDown size={16} className="text-muted-foreground" aria-hidden />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {group === k && (
                      <motion.div
                        id={`mobile-group-${k}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: NAV_EASE }}
                        className="overflow-hidden"
                      >
                        <ul className="pb-3 pl-2">
                          {groupItems(k).map((item) => (
                            <li key={item.href}>
                              <Link href={item.href} onClick={close} className={cn(rowLink, accentClass(item.module))}>
                                {item.module ? <AccentDot /> : <span aria-hidden className="size-2 shrink-0" />}
                                {item.label}
                              </Link>
                            </li>
                          ))}
                          {k === "solutions" && (
                            <li>
                              <Link
                                href={BROKER_PILOT_LINE.href}
                                onClick={close}
                                data-cta-id="book_demo"
                                data-location="nav"
                                className={cn(rowLink, "text-[14.5px] text-muted-foreground")}
                              >
                                <span aria-hidden className="size-2 shrink-0" />
                                {BROKER_PILOT_LINE.label}
                              </Link>
                            </li>
                          )}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ),
            )}
          </nav>

          <div className="space-y-3 border-t border-[hsl(var(--surface-border))] bg-[hsl(var(--card))] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <ThemeSwitch className="w-full" />
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <a
                href={APP_LOGIN_URL}
                data-location="nav"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border px-6 text-[15px] font-medium text-foreground transition-colors active:bg-secondary/70"
              >
                Log in
              </a>
              <DemoButton location="nav" src="nav" size="lg" className="h-12 w-full" onClick={close} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
