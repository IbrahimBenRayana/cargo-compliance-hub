"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LANE_EVENT, type Lane } from "./lane-switch";
import { ISF_PRICE, usd } from "./pricing-data";

/** Above this monthly count the estimator points to volume pricing (conversion-plan M3). */
const VOLUME_THRESHOLD = 200;

const fieldCls =
  "h-11 w-full rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--card))] px-3 text-[15px] tabular-nums text-tone-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * S5 ISF estimator: count x $45, the only public price. No savings figure,
 * no broker comparison, no entry price. Output crossfades in 150ms, no count-up.
 */
export function Estimator() {
  const [count, setCount] = React.useState("24");
  const [lane, setLane] = React.useState<Lane>("import");

  React.useEffect(() => {
    const on = (e: Event) => setLane((e as CustomEvent<Lane>).detail);
    window.addEventListener(LANE_EVENT, on);
    return () => window.removeEventListener(LANE_EVENT, on);
  }, []);

  const n = Math.max(0, Math.floor(Number(count) || 0));
  const volume = lane === "volume" || n > VOLUME_THRESHOLD;
  const key = volume ? "volume" : `${n}`;

  return (
    <div className="grid gap-8 rounded-[24px] p-6 site-surface sm:p-8 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end md:gap-12">
      <div>
        <label htmlFor="est-count" className="mb-1.5 block text-[13.5px] font-semibold text-tone-fg">
          ISFs per month
        </label>
        <input
          id="est-count"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className={fieldCls}
        />
      </div>

      <div aria-live="polite" className="min-h-[96px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {volume ? (
              <p className="text-[19px] font-semibold leading-snug text-tone-fg">
                At this volume,{" "}
                <a href="#volume" className="underline decoration-current/35 underline-offset-4 hover:decoration-current">
                  volume pricing is on request
                </a>
                .
              </p>
            ) : (
              <>
                <p className="text-[19px] leading-snug text-tone-fg">
                  About{" "}
                  <strong className="text-[28px] font-bold tabular-nums tracking-[-0.02em]">{usd(n * ISF_PRICE)}</strong>{" "}
                  a month at <strong className="font-semibold tabular-nums">{usd(ISF_PRICE)}</strong> per accepted ISF
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-tone-muted">
                  An estimate. You&apos;re charged per ISF when CBP accepts it, so drafts, rejections and amendments cost
                  nothing.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
