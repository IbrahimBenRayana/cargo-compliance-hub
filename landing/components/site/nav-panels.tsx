"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { accentClass } from "@/lib/accents";
import {
  BROKER_PILOT_LINE,
  PLATFORM_COLUMNS,
  ROUTES,
  menuItems,
  platformColumn,
  type MenuKey,
  type SiteRoute,
} from "@/lib/site";

export const NAV_EASE = [0.23, 1, 0.32, 1] as const;

export const PANEL_WIDTH: Record<MenuKey, number> = {
  platform: 640,
  solutions: 380,
  resources: 360,
  company: 340,
};

/**
 * The one dropdown surface. It appears under its trigger, then glides and
 * resizes between menus (width, offset and height interpolate) while the
 * content cross-fades in the direction of travel. Enter 180ms, exit 120ms.
 */
export function NavPanel({
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
          key="nav-panel"
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12, ease: NAV_EASE } }}
          transition={{ duration: 0.18, ease: NAV_EASE }}
          style={{ transformOrigin: `${box.left + box.width / 2}px top` }}
          className="absolute left-0 right-0 top-full z-50 hidden pt-2 lg:block"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <motion.div
            layout
            initial={false}
            transition={{ duration: 0.22, ease: NAV_EASE }}
            style={{ width: box.width, marginLeft: box.left, borderRadius: 16 }}
            className="relative overflow-hidden border border-[hsl(var(--surface-border))] bg-[hsl(var(--card))] shadow-[0_1px_2px_hsl(var(--foreground)/0.05),0_16px_48px_-16px_hsl(var(--foreground)/0.22)]"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={active}
                id={`menu-${active}`}
                initial={{ opacity: 0, x: direction * 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -12 }}
                transition={{ duration: 0.18, ease: NAV_EASE }}
                style={{ width: box.width }}
              >
                {active === "platform" ? <PlatformPanel close={close} /> : <ListPanel menu={active} close={close} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Module accent: a small square in the module colour. */
export function AccentDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-[3px] bg-a", className)} />;
}

function PanelLink({ item, close, dot }: { item: SiteRoute; close: () => void; dot?: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={close}
        className={cn(
          "group flex gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-secondary/60 focus-visible:bg-secondary/60",
          accentClass(item.module),
        )}
      >
        {dot && <AccentDot className="mt-[7px]" />}
        <span className="min-w-0">
          <span className="block text-[14.5px] font-semibold leading-snug text-foreground">{item.label}</span>
          {item.blurb && (
            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{item.blurb}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

const footLink =
  "group inline-flex items-center gap-1.5 rounded-md text-[13.5px] font-medium text-foreground transition-colors hover:text-foreground/80";

function PlatformPanel({ close }: { close: () => void }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-1 p-2">
        {PLATFORM_COLUMNS.map((col) => (
          <div key={col.key}>
            <p className="px-3 pb-1 pt-2.5 text-[12px] font-medium text-muted-foreground">{col.heading}</p>
            <ul>
              {platformColumn(col.key).map((item) => (
                <PanelLink key={item.href} item={item} close={close} dot />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-[hsl(var(--surface-border))] bg-secondary/30 px-5 py-3">
        <Link href={ROUTES.platform.href} onClick={close} className={footLink}>
          {ROUTES.platform.label}
          <ArrowRight size={13} aria-hidden className="text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
        <Link href={ROUTES.security.href} onClick={close} className={cn(footLink, "text-muted-foreground hover:text-foreground")}>
          {ROUTES.security.label}
          <ArrowRight size={13} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function ListPanel({ menu, close }: { menu: Exclude<MenuKey, "platform">; close: () => void }) {
  return (
    <div>
      <ul className="p-2">
        {menuItems(menu).map((item) => (
          <PanelLink key={item.href} item={item} close={close} dot={Boolean(item.module)} />
        ))}
      </ul>
      {menu === "solutions" && (
        <div className="border-t border-[hsl(var(--surface-border))] bg-secondary/30 px-5 py-3">
          <Link
            href={BROKER_PILOT_LINE.href}
            onClick={close}
            data-cta-id="book_demo"
            data-location="nav"
            className={cn(footLink, "text-muted-foreground hover:text-foreground")}
          >
            {BROKER_PILOT_LINE.label}
            <ArrowRight size={13} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
