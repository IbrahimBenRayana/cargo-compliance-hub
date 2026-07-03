"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Clock,
  CornerDownLeft,
  Database,
  RefreshCw,
  Search,
} from "lucide-react";
import { SectionShell } from "@/components/sections/section-shell";
import { Donut } from "@/components/ui/donut";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

/**
 * Everything the platform watches on its own: HTS classification, ADD/CVD
 * orders, UFLPA risk, PGA flags — with the always-on automation strip as
 * the section's receipt. Single instance of the ticker on the page.
 */
export function Watchtower() {
  return (
    <SectionShell
      id="watch"
      tone="default"
      className="bg-muted/30"
      eyebrow="Classify · watch"
      title="It watches the rules while you work."
      intro="From the HTS code to the agency that owns it — checked continuously, surfaced only when something changes."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TileWrapper className="md:row-span-2" delay={0}>
          <TileHtsClassifier />
        </TileWrapper>
        <TileWrapper delay={0.08}>
          <TileAddCvd />
        </TileWrapper>
        <TileWrapper delay={0.16}>
          <TileUflpa />
        </TileWrapper>
        <TileWrapper className="md:col-span-2" delay={0.24}>
          <TilePga />
        </TileWrapper>
      </div>

      <AutomationStrip />

      <div className="mt-8 flex">
        <Link
          href="/platform/compliance"
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-gold-dark dark:hover:text-gold"
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

/* ---------- Always-on automation strip ---------- */

type TickerItem = {
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
};

const TICKER_ITEMS: TickerItem[] = [
  { Icon: RefreshCw, label: "Polling CBP every 5 minutes" },
  { Icon: Database, label: "Federal Register sync — daily at 04:00 UTC" },
  { Icon: BellRing, label: "Deadline alerts queued hourly" },
  { Icon: Clock, label: "Stale-check sweep every 6 hours" },
];

function AutomationStrip() {
  const reduce = useReducedMotion();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % TICKER_ITEMS.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div
      aria-label="Background automation status"
      className="mt-6 rounded-2xl border border-border/60 bg-card/60 px-5 py-4"
    >
      {/* Desktop: all four visible */}
      <ul className="hidden items-center justify-between gap-6 md:flex">
        {TICKER_ITEMS.map((item) => (
          <li key={item.label}>
            <TickerRow item={item} />
          </li>
        ))}
      </ul>

      {/* Mobile: one at a time */}
      <div className="flex flex-col items-center gap-2 md:hidden">
        <div className="relative h-6 w-full overflow-hidden">
          {TICKER_ITEMS.map((item, i) => (
            <motion.div
              key={item.label}
              initial={false}
              animate={{ opacity: i === index ? 1 : 0, y: i === index ? 0 : 4 }}
              transition={{ duration: 0.45, ease: EASE_OUT_QUART }}
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden={i !== index}
            >
              <TickerRow item={item} />
            </motion.div>
          ))}
        </div>
        <ul
          className="flex items-center gap-1.5"
          aria-label={`Showing item ${index + 1} of ${TICKER_ITEMS.length}`}
        >
          {TICKER_ITEMS.map((item, i) => (
            <li
              key={item.label}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "h-1 rounded-full transition-all duration-500 ease-out",
                i === index ? "w-4 bg-gold" : "w-1 bg-muted-foreground/30",
              )}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function TickerRow({ item }: { item: TickerItem }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <item.Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
        {item.label}
      </span>
    </div>
  );
}

/* ---------- Bento tiles ---------- */

function TileWrapper({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, ease: EASE_OUT_QUART, delay }}
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-6 transition-shadow duration-300 hover:shadow-card-hover",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

type HtsSuggestion = {
  code: string;
  desc: string;
  sub: string;
  best?: boolean;
};

const HTS_SUGGESTIONS: HtsSuggestion[] = [
  { code: "6115.96.6010", desc: "Stockings, socks — Knit", sub: "Of cotton", best: true },
  { code: "6115.95.6020", desc: "Stockings, socks — Knit", sub: "Of synthetic fibers" },
  { code: "6115.99.1410", desc: "Stockings, socks — Knit", sub: "Of other textile materials" },
];

function TileHtsClassifier() {
  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold text-foreground">HTS Classifier</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Describe goods → AI suggested 10-digit HTS code, with two alternatives
        and reasoning.
      </p>

      <div className="mt-5 flex-1">
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-card">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 truncate text-sm text-foreground/80">
            polyester athletic socks, women&apos;s
          </span>
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card text-muted-foreground">
            <CornerDownLeft className="size-3.5" aria-hidden />
          </span>
        </div>

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

        <div className="mt-4 rounded-lg border border-border/50 bg-background/60 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Reasoning
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Women&apos;s knit athletic socks of man-made fibers classify under
            heading 6115. Cotton-blend variants shift to 6115.96.6010 when
            cotton dominates by weight — check the mill certificate.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Link
          href="/platform/ai"
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
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

type AddCvdEntry = {
  case: string;
  product: string;
  country: string;
  status: string;
};

const ADDCVD_ENTRIES: AddCvdEntry[] = [
  { case: "A-570-053", product: "Steel wheels", country: "China", status: "amended" },
  { case: "A-552-826", product: "Wood mouldings", country: "Vietnam", status: "new" },
  { case: "A-549-844", product: "Polyester yarn", country: "Thailand", status: "sunset" },
];

function TileAddCvd() {
  const reduceMotion = useReducedMotion();
  const doubled = React.useMemo(() => [...ADDCVD_ENTRIES, ...ADDCVD_ENTRIES], []);

  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold text-foreground">
        ADD/CVD orders — always current.
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Daily sync from the Federal Register at 04:00 UTC. Look up by HTS,
        country, or case number.
      </p>

      <div className="mt-5 flex-1">
        <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Today
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        <div className="relative mt-2 h-[112px] overflow-hidden">
          <motion.ul
            className="space-y-1.5"
            initial={{ y: 0 }}
            animate={reduceMotion ? undefined : { y: ["0%", "-50%"] }}
            transition={{ duration: 14, ease: "linear", repeat: Infinity }}
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
                <span className="text-[10px] text-foreground/70">{e.status}</span>
              </li>
            ))}
          </motion.ul>
        </div>
      </div>
    </div>
  );
}

type RiskRow = {
  invoice: string;
  score: number;
  donutTone: "rose" | "amber" | "emerald";
  pillTone: Severity;
  pillLabel: string;
};

const RISK_ROWS: RiskRow[] = [
  { invoice: "INV-4198", score: 24, donutTone: "rose", pillTone: "rose", pillLabel: "High" },
  { invoice: "INV-4205", score: 58, donutTone: "amber", pillTone: "amber", pillLabel: "Elevated" },
  { invoice: "INV-4211", score: 80, donutTone: "emerald", pillTone: "blue", pillLabel: "Info" },
];

function TileUflpa() {
  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold text-foreground">UFLPA Risk Inbox</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Flagged shipments ranked by severity, with the supplier evidence
        trail one click away.
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
    <div className="flex h-full flex-col gap-5 md:flex-row md:items-center md:gap-10">
      <div className="md:max-w-xs md:shrink-0">
        <h3 className="text-lg font-semibold text-foreground">PGA flags by HTS</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          FDA. USDA-APHIS. EPA. FCC. Know which agencies own your code before
          you file.
        </p>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4">
        {AGENCIES.map((a) => (
          <div
            key={a.name}
            className="flex flex-col justify-between gap-4 rounded-lg border border-border/50 bg-background/60 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                {a.name}
              </span>
              <span
                className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[a.dot])}
                aria-hidden
              />
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {a.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
