"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
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

/** Footer theme toggle: "Light" / "Dark" segmented switch (global.md §5). */
export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (resolvedTheme === "dark" ? "dark" : "light") : null;

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-0.5",
        className,
      )}
    >
      {(["light", "dark"] as const).map((t) => {
        const Icon = t === "light" ? Sun : Moon;
        const on = current === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={on}
            aria-label={`Switch to ${t} theme`}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium transition-colors",
              on ? "bg-[hsl(var(--card))] text-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.1)]" : "text-tone-muted hover:text-tone-fg",
            )}
          >
            <Icon size={13} aria-hidden />
            {t === "light" ? "Light" : "Dark"}
          </button>
        );
      })}
    </div>
  );
}
