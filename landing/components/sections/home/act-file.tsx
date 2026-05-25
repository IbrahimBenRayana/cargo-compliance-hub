"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Users,
  Ship,
  Boxes,
  Container as ContainerIcon,
  ShieldCheck,
  ClipboardCheck,
  Check,
} from "lucide-react";
import { SectionShell } from "@/components/sections/section-shell";
import { SeverityPill } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

type Step = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status: "done" | "active" | "pending";
};

const STEPS: Step[] = [
  { key: "importer", label: "Importer", icon: Building2, status: "done" },
  { key: "parties", label: "Parties", icon: Users, status: "done" },
  { key: "shipment", label: "Shipment", icon: Ship, status: "done" },
  { key: "commodities", label: "Commodities", icon: Boxes, status: "active" },
  {
    key: "containers",
    label: "Containers",
    icon: ContainerIcon,
    status: "pending",
  },
  { key: "bond", label: "Bond", icon: ShieldCheck, status: "pending" },
  { key: "review", label: "Review", icon: ClipboardCheck, status: "pending" },
];

const FILE_TYPES = [
  {
    code: "ISF-10",
    title: "Importer Security Filing",
    blurb: "10 + 2 elements for ocean cargo importers",
  },
  {
    code: "ISF-5",
    title: "Carrier ISF",
    blurb: "5 elements for foreign exporters / FROB",
  },
  {
    code: "7501",
    title: "Entry Summary",
    blurb: "Prefilled from accepted ISF — bond carries over",
  },
  {
    code: "3461",
    title: "Entry / Immediate Delivery",
    blurb: "ABI Documents API path with manifest queries",
  },
  {
    code: "In-bond",
    title: "Transportation In-Bond",
    blurb: "Across-port moves with hand-off tracking",
  },
];

export function ActFile() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <SectionShell
      id="file"
      tone="muted"
      eyebrow="File"
      title="One wizard. Every shipment type."
      intro="ISF-10, ISF-5, Entry Summary, Entry, In-bond — all in the same flow. Save reusable templates. Duplicate any filing as a new draft. Bulk-submit dozens at once. Every draft gets a rule-based validation gate plus an optional AI pre-flight review before it leaves your hands."
    >
      <div
        ref={ref}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
      >
        {/* Copy column — 5/12 */}
        <div className="lg:col-span-5 space-y-7">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
              Filing types
            </h3>
            <ul className="space-y-2.5">
              {FILE_TYPES.map((ft, i) => (
                <motion.li
                  key={ft.code}
                  initial={{ opacity: 0, x: -8 }}
                  animate={inView ? { opacity: 1, x: 0 } : undefined}
                  transition={{
                    duration: 0.45,
                    delay: 0.1 + i * 0.06,
                    ease: EASE_OUT_QUART,
                  }}
                  className="flex items-start gap-3"
                >
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[64px] h-6 px-2 rounded-md bg-card border border-border/70 text-[11px] font-mono font-semibold tabular-nums">
                    {ft.code}
                  </span>
                  <div className="text-sm">
                    <span className="font-medium text-foreground">
                      {ft.title}
                    </span>
                    <span className="text-muted-foreground">
                      {" — "}
                      {ft.blurb}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Templates", body: "Parties, ports, HTS — save once" },
              { label: "Duplicate", body: "Any filing → new draft, one click" },
              { label: "Bulk submit", body: "Dozens of drafts in parallel" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border/60 bg-card p-3"
              >
                <div className="text-xs font-semibold text-foreground mb-1">
                  {card.label}
                </div>
                <div className="text-[11px] text-muted-foreground leading-snug">
                  {card.body}
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/platform/filings"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-gold transition-colors group"
          >
            See the filing pipeline
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* Wizard mock — 7/12 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT_QUART }}
          className="lg:col-span-7"
        >
          <div className="relative rounded-2xl border border-border/60 bg-card shadow-card-hover overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-card/60 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-rose-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <div className="text-[11px] font-mono text-muted-foreground tabular-nums">
                INV-4502 · ISF-10 — Draft
              </div>
              <SeverityPill tone="amber">4h to deadline</SeverityPill>
            </div>

            {/* Step rail */}
            <div className="px-5 py-5 border-b border-border/60">
              <ol className="grid grid-cols-7 gap-1.5">
                {STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const done = step.status === "done";
                  const active = step.status === "active";
                  return (
                    <li key={step.key} className="flex flex-col items-center">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={inView ? { scale: 1, opacity: 1 } : undefined}
                        transition={{
                          duration: 0.4,
                          delay: 0.3 + i * 0.06,
                          ease: EASE_OUT_QUART,
                        }}
                        className={cn(
                          "relative size-9 rounded-full flex items-center justify-center border transition-colors",
                          done &&
                            "bg-gold/20 border-gold/40 text-gold-dark dark:text-gold",
                          active &&
                            "bg-gold border-gold text-yellow-950 shadow-gold",
                          !done &&
                            !active &&
                            "bg-card border-border/60 text-muted-foreground",
                        )}
                      >
                        {done ? <Check size={15} /> : <Icon size={14} />}
                        {active && (
                          <motion.span
                            aria-hidden
                            className="absolute inset-0 rounded-full border-2 border-gold"
                            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{
                              duration: 1.6,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        )}
                      </motion.div>
                      <span
                        className={cn(
                          "mt-2 text-[10px] font-medium tabular-nums",
                          done && "text-foreground",
                          active && "text-foreground font-semibold",
                          !done && !active && "text-muted-foreground",
                        )}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Mock body */}
            <div className="p-5 sm:p-6 grid sm:grid-cols-2 gap-5">
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                  Commodities · 3 items
                </h4>
                <div className="space-y-2.5">
                  {[
                    {
                      hts: "6115.96.6010",
                      desc: "Women's polyester athletic socks",
                      ok: true,
                    },
                    {
                      hts: "6109.10.0027",
                      desc: "Cotton T-shirts, women's",
                      ok: true,
                    },
                    {
                      hts: "6204.62.4011",
                      desc: "Cotton trousers, women's",
                      ok: false,
                    },
                  ].map((c) => (
                    <div
                      key={c.hts}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-background/60"
                    >
                      <span className="font-mono text-[11.5px] tabular-nums font-semibold text-foreground">
                        {c.hts}
                      </span>
                      <span className="flex-1 min-w-0 text-[11.5px] text-muted-foreground truncate">
                        {c.desc}
                      </span>
                      <SeverityPill tone={c.ok ? "emerald" : "amber"}>
                        {c.ok ? "OK" : "Check"}
                      </SeverityPill>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                  Pre-flight · AI review
                </h4>
                <div className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-2">
                  {[
                    {
                      tone: "rose" as const,
                      label: "1 critical",
                      body: "Manufacturer party missing tax ID",
                    },
                    {
                      tone: "amber" as const,
                      label: "2 warnings",
                      body: "HTS 6204.62.4011 has ADD/CVD watch",
                    },
                    {
                      tone: "emerald" as const,
                      label: "Suggestion",
                      body: "Save these parties as template",
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-start gap-2">
                      <SeverityPill tone={row.tone} className="mt-0.5">
                        {row.label}
                      </SeverityPill>
                      <span className="text-[11.5px] text-muted-foreground leading-snug">
                        {row.body}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </SectionShell>
  );
}
