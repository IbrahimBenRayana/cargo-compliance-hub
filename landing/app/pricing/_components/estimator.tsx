"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LANE_EVENT, type Lane } from "./lane-switch";
import { TIERS, usd, type TierId } from "./pricing-data";

/** Above this monthly count the estimator points to volume pricing (conversion-plan M3). */
const VOLUME_THRESHOLD = 200;

const fieldCls =
  "h-11 w-full rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--card))] px-3 text-[15px] tabular-nums text-tone-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * S5 per-shipment estimator: arithmetic on the public card only. No savings
 * figure, no broker comparison. Output crossfades in 150ms, no count-up.
 */
export function Estimator() {
  const [count, setCount] = React.useState("24");
  const [tierId, setTierId] = React.useState<TierId>("entry");
  const [lane, setLane] = React.useState<Lane>("import");

  React.useEffect(() => {
    const on = (e: Event) => setLane((e as CustomEvent<Lane>).detail);
    window.addEventListener(LANE_EVENT, on);
    return () => window.removeEventListener(LANE_EVENT, on);
  }, []);

  const tier = TIERS.find((t) => t.id === tierId) ?? TIERS[1];
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const volume = lane === "volume" || n > VOLUME_THRESHOLD;
  const key = volume ? "volume" : `${n}-${tier.id}`;

  return (
    <div className="grid gap-8 rounded-[24px] p-6 site-surface sm:p-8 md:grid-cols-[1fr_1.1fr] md:items-end">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="est-count" className="mb-1.5 block text-[13.5px] font-semibold text-tone-fg">
            US shipments per month
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
        <div>
          <label htmlFor="est-plan" className="mb-1.5 block text-[13.5px] font-semibold text-tone-fg">
            Plan
          </label>
          <select id="est-plan" value={tierId} onChange={(e) => setTierId(e.target.value as TierId)} className={fieldCls}>
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
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
                  <strong className="text-[28px] font-bold tabular-nums tracking-[-0.02em]">{usd(n * tier.price)}</strong>{" "}
                  a month at <strong className="font-semibold tabular-nums">{usd(tier.price)}</strong> per shipment
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-tone-muted">
                  An estimate. You&apos;re charged per shipment when CBP accepts it, so rejected filings and drafts cost
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
