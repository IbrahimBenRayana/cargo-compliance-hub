"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { SectionShell } from "@/components/sections/section-shell";
import { Donut } from "@/components/ui/donut";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

// ---------- Tile 1: HTS Classifier ----------

type HtsSuggestion = {
  code: string;
  desc: string;
  sub: string;
  best?: boolean;
};

const HTS_SUGGESTIONS: HtsSuggestion[] = [
  {
    code: "6115.96.6010",
    desc: "Stockings, socks — Knit",
    sub: "Of cotton",
    best: true,
  },
  {
    code: "6115.95.6020",
    desc: "Stockings, socks — Knit",
    sub: "Of synthetic fibers",
  },
  {
    code: "6115.99.1410",
    desc: "Stockings, socks — Knit",
    sub: "Of other textile materials",
  },
];

function TileHtsClassifier() {
  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold text-foreground">HTS Classifier</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Describe goods → AI suggested 10-digit HTS code, with two alternatives
        and reasoning.
      </p>

      <div className="mt-5 flex-1">
        {/* Mock input */}
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-card">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 truncate text-sm text-foreground/80">
            polyester athletic socks, women&apos;s
          </span>
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card text-muted-foreground">
            <CornerDownLeft className="size-3.5" aria-hidden />
          </span>
        </div>

        {/* Suggestions */}
        <ul className="mt-4 space-y-2">
          {HTS_SUGGESTIONS.map((s) => (
            <li
              key={s.code}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2",
                s.best && "ring-1 ring-[hsl(43_96%_56%/0.35)]",
              )}
            >
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                  {s.code}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {s.desc} · {s.sub}
                </div>
              </div>
              {s.best ? (
                <SeverityPill tone="amber">Best</SeverityPill>
              ) : (
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  alt
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <Link
          href="/platform/ai"
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          Try the classifier
          <ArrowRight
            className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}

// ---------- Tile 2: ADD/CVD ticker ----------

type AddCvdEntry = {
  case: string;
  product: string;
  country: string;
  status: string;
};

const ADDCVD_ENTRIES: AddCvdEntry[] = [
  {
    case: "A-570-053",
    product: "Steel wheels",
    country: "China",
    status: "A-570-053 amended",
  },
  {
    case: "A-552-826",
    product: "Wood mouldings",
    country: "Vietnam",
    status: "A-552-826 new",
  },
  {
    case: "A-549-844",
    product: "Polyester yarn",
    country: "Thailand",
    status: "A-549-844 sunset",
  },
];

function TileAddCvd() {
  const reduceMotion = useReducedMotion();

  // Duplicate the list for seamless vertical loop.
  const doubled = React.useMemo(
    () => [...ADDCVD_ENTRIES, ...ADDCVD_ENTRIES],
    [],
  );

  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold text-foreground">
        ADD/CVD orders — always current.
      </h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Daily sync from the Federal Register at 04:00 UTC. Look up by HTS,
        country, or case number.
      </p>

      <div className="mt-5 flex-1">
        <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Today
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>

        <div className="relative mt-2 h-[112px] overflow-hidden">
          <motion.ul
            className="space-y-1.5"
            initial={{ y: 0 }}
            animate={
              reduceMotion
                ? undefined
                : { y: ["0%", "-50%"] }
            }
            transition={{
              duration: 14,
              ease: "linear",
              repeat: Infinity,
            }}
          >
            {doubled.map((e, i) => (
              <li
                key={`${e.case}-${i}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md bg-background/60 px-2.5 py-1.5 font-mono text-[11px] tabular-nums"
              >
                <span className="font-semibold text-foreground">{e.case}</span>
                <span className="truncate text-muted-foreground">
                  {e.product} · {e.country}
                </span>
                <span className="text-[10px] text-foreground/70">
                  {e.status}
                </span>
              </li>
            ))}
          </motion.ul>
        </div>
      </div>
    </div>
  );
}

// ---------- Tile 3: UFLPA Risk Inbox ----------

type RiskRow = {
  invoice: string;
  score: number;
  donutTone: "rose" | "amber" | "emerald";
  pillTone: Severity;
  pillLabel: string;
};

const RISK_ROWS: RiskRow[] = [
  {
    invoice: "INV-4198",
    score: 24,
    donutTone: "rose",
    pillTone: "rose",
    pillLabel: "High",
  },
  {
    invoice: "INV-4205",
    score: 58,
    donutTone: "amber",
    pillTone: "amber",
    pillLabel: "Elevated",
  },
  {
    invoice: "INV-4211",
    score: 80,
    donutTone: "emerald",
    pillTone: "blue",
    pillLabel: "Info",
  },
];

function TileUflpa() {
  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold text-foreground">UFLPA Risk Inbox</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Flagged shipments ranked by severity. Severity rails: rose (high) →
        amber (elevated) → blue (informational).
      </p>

      <ul className="mt-5 flex-1 space-y-2">
        {RISK_ROWS.map((row, i) => (
          <li
            key={row.invoice}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2"
          >
            <Donut
              value={row.score}
              tone={row.donutTone}
              size={28}
              strokeWidth={4}
              delay={0.2 + i * 0.1}
              showLabel
            />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                {row.invoice}
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Risk score
              </div>
            </div>
            <SeverityPill tone={row.pillTone}>{row.pillLabel}</SeverityPill>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Tile 4: PGA Flag Lookup ----------

type Agency = {
  name: string;
  dot: "rose" | "amber" | "neutral";
  status: string;
};

const AGENCIES: Agency[] = [
  { name: "FDA", dot: "rose", status: "Permit required" },
  { name: "USDA-APHIS", dot: "amber", status: "Conditional" },
  { name: "EPA", dot: "neutral", status: "Not required" },
  { name: "FCC", dot: "neutral", status: "Not required" },
];

const DOT_CLASS: Record<Agency["dot"], string> = {
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  neutral: "bg-foreground/30",
};

function TilePga() {
  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold text-foreground">PGA flags by HTS</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        FDA. USDA-APHIS. EPA. FCC. Know which agencies own your code before you
        file.
      </p>

      <div className="mt-5 grid flex-1 grid-cols-2 gap-2.5">
        {AGENCIES.map((a) => (
          <div
            key={a.name}
            className="flex flex-col justify-between rounded-lg border border-border/50 bg-background/60 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                {a.name}
              </span>
              <span
                className={cn("size-1.5 rounded-full", DOT_CLASS[a.dot])}
                aria-hidden
              />
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {a.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Composite ----------

type TileWrapperProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

function TileWrapper({ children, className, delay = 0 }: TileWrapperProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, ease: EASE_OUT_QUART, delay }}
      className={cn(
        "group rounded-2xl border border-border/60 bg-card p-6 transition-shadow duration-300 hover:shadow-card-hover",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function ActRegulated() {
  return (
    <SectionShell
      tone="muted"
      headingAlign="left"
      eyebrow="Classify · watch"
      title="Look up the rule that applies to this shipment."
      intro="From the HTS code to the agency that touches it — in one place."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:auto-rows-fr">
        <TileWrapper className="md:row-span-2" delay={0}>
          <TileHtsClassifier />
        </TileWrapper>
        <TileWrapper delay={0.08}>
          <TileAddCvd />
        </TileWrapper>
        <TileWrapper delay={0.16}>
          <TileUflpa />
        </TileWrapper>
        <TileWrapper delay={0.24}>
          <TilePga />
        </TileWrapper>
      </div>

      <div className="mt-8 flex">
        <Link
          href="/platform/compliance"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          See Compliance Center
          <ArrowRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </SectionShell>
  );
}
