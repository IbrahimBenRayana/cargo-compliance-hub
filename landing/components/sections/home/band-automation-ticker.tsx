"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BellRing, Clock, Database, RefreshCw } from "lucide-react";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

type TickerItem = {
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
};

const ITEMS: TickerItem[] = [
  { Icon: RefreshCw, label: "Polling CBP every 5 minutes" },
  { Icon: Database, label: "Federal Register sync — daily at 04:00 UTC" },
  { Icon: BellRing, label: "Deadline alerts queued hourly" },
  { Icon: Clock, label: "Stale-check sweep every 6 hours" },
];

export function BandAutomationTicker() {
  const reduce = useReducedMotion();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ITEMS.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <section
      aria-label="Background automation status"
      className="border-y border-border/60 bg-muted/30 py-4"
    >
      <Container>
        {/* Desktop / tablet: all 4 visible */}
        <ul className="hidden md:grid md:grid-cols-4 md:items-center md:gap-6">
          {ITEMS.map((item) => (
            <li key={item.label}>
              <TickerRow item={item} />
            </li>
          ))}
        </ul>

        {/* Mobile: one item at a time, crossfade */}
        <div className="relative flex items-center justify-center md:hidden">
          <div className="relative h-6 w-full">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={ITEMS[index].label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.45, ease: EASE_OUT_QUART }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <TickerRow item={ITEMS[index]} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </section>
  );
}

function TickerRow({ item }: { item: TickerItem }) {
  return (
    <div className="flex items-center justify-center gap-2 md:justify-start">
      <PulseDot />
      <item.Icon
        className={cn("size-3.5 shrink-0 text-muted-foreground")}
        aria-hidden
      />
      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
        {item.label}
      </span>
    </div>
  );
}

function PulseDot() {
  return (
    <span className="relative flex size-2 shrink-0" aria-hidden>
      <span className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  );
}
