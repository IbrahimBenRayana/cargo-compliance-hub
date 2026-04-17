import * as React from "react";
import { cn } from "@/lib/utils";

interface MacWindowProps {
  title?: string;
  urlBar?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function MacWindow({
  title,
  urlBar,
  className,
  contentClassName,
  children,
}: MacWindowProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden bg-card ring-1 ring-foreground/10",
        "shadow-[0_2px_4px_hsl(var(--foreground)/0.06),0_12px_32px_-8px_hsl(var(--foreground)/0.18),0_32px_80px_-24px_hsl(var(--foreground)/0.22)]",
        className
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-3 h-9 px-4 bg-gradient-to-b from-muted to-muted/85 border-b border-border/60">
        {/* Traffic-light dots */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57] ring-1 ring-black/10 dark:ring-white/10" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E] ring-1 ring-black/10 dark:ring-white/10" />
          <span className="h-3 w-3 rounded-full bg-[#28C840] ring-1 ring-black/10 dark:ring-white/10" />
        </div>
        {/* Title */}
        {title && (
          <span className="flex-1 text-center text-xs font-medium text-muted-foreground truncate px-2">
            {title}
          </span>
        )}
        {/* URL bar */}
        {urlBar && (
          <span className="hidden md:inline-flex items-center gap-1.5 h-6 rounded-md bg-background/60 border border-border/60 px-2.5 text-[11px] font-mono text-muted-foreground truncate max-w-[260px]">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 opacity-60"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            {urlBar}
          </span>
        )}
        {/* Spacer if no urlBar, to balance the dots */}
        {!urlBar && title && <span className="w-[54px] shrink-0" />}
      </div>

      {/* Content */}
      <div className={cn("bg-background", contentClassName)}>{children}</div>
    </div>
  );
}
