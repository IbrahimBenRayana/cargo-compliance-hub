"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

/** True after hydration (no setState-in-effect). */
function useMounted() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;
type ThemeValue = (typeof OPTIONS)[number]["value"];

/**
 * Light / dark / system segmented control (lives in the header bar and the
 * mobile sheet). A radiogroup with one Tab stop: arrow keys move the choice.
 * `compact` is icon-only for the desktop bar; the default shows labels.
 */
export function ThemeSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const thumbId = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const current: ThemeValue | null = mounted ? ((theme as ThemeValue | undefined) ?? "system") : null;
  const currentIndex = Math.max(0, OPTIONS.findIndex((o) => o.value === current));

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (currentIndex + step + OPTIONS.length) % OPTIONS.length;
    setTheme(OPTIONS[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-flex w-fit items-center rounded-full border border-[hsl(var(--surface-border))] bg-secondary/50 p-[3px]",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }, i) => {
        const on = current === value;
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={compact ? `${label} theme` : undefined}
            title={compact ? `${label} theme` : undefined}
            tabIndex={i === currentIndex ? 0 : -1}
            onClick={() => setTheme(value)}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 rounded-full font-medium outline-offset-1 transition-colors duration-150",
              compact ? "size-7" : "h-9 flex-1 px-3.5 text-[14px]",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && (
              <motion.span
                layoutId={`theme-thumb-${thumbId}`}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="absolute inset-0 rounded-full bg-[hsl(var(--card))] shadow-[0_1px_2px_hsl(var(--foreground)/0.12),0_0_0_1px_hsl(var(--foreground)/0.04)]"
                aria-hidden
              />
            )}
            <Icon size={compact ? 14 : 15} strokeWidth={2} aria-hidden className="relative" />
            {!compact && <span className="relative">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
