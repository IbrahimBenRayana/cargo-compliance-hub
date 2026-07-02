"use client";

import * as React from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  Bot,
  Boxes,
  Building2,
  Check,
  ClipboardCheck,
  Container as ContainerIcon,
  Ship,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { SectionShell } from "@/components/sections/section-shell";
import { MacWindow } from "@/components/ui/mac-window";
import { CodeStream } from "@/components/ui/code-stream";
import { Donut } from "@/components/ui/donut";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;
const STEP_MS = 8000;

type StepKey = "file" | "triage" | "fix";

type Step = {
  key: StepKey;
  number: string;
  short: string;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  urlBar: string;
};

const STEPS: Step[] = [
  {
    key: "file",
    number: "01",
    short: "File",
    title: "File it once.",
    body: "ISF-10, ISF-5, Entry Summary, Entry, In-bond — one wizard for all of them. Templates, one-click duplication, bulk submit, and an AI pre-flight before anything leaves your hands.",
    href: "/platform/filings",
    linkLabel: "See the filing pipeline",
    urlBar: "app.mycargolens.com/filings/new",
  },
  {
    key: "triage",
    number: "02",
    short: "Triage",
    title: "The queue ranks itself.",
    body: "Every filing scored and sorted by urgency, not chronology. Today's brief on top, one line, generated daily. Snooze what isn't yours yet.",
    href: "/platform/compliance",
    linkLabel: "See Compliance Center",
    urlBar: "app.mycargolens.com/compliance",
  },
  {
    key: "fix",
    number: "03",
    short: "Fix",
    title: "Rejections come back in plain English.",
    body: "The AI coach reads the CBP error code, your filing, and your party data — then streams numbered fix steps. The same coach pre-flights drafts before you submit.",
    href: "/platform/ai",
    linkLabel: "See the AI coach",
    urlBar: "app.mycargolens.com/filings/INV-4421",
  },
];

/**
 * The homepage centerpiece: one product window, three moments of the same
 * day. The section argues "one calm surface" by literally being one surface
 * that the whole workflow passes through.
 */
export function Workflow() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const reduceMotion = useReducedMotion();

  const [active, setActive] = React.useState<StepKey>("file");
  const [auto, setAuto] = React.useState(true);
  const [cycle, setCycle] = React.useState(0);

  // Auto-advance until the visitor takes over.
  React.useEffect(() => {
    if (!inView || !auto || reduceMotion) return;
    const id = window.setTimeout(() => {
      setActive((prev) => {
        const i = STEPS.findIndex((s) => s.key === prev);
        return STEPS[(i + 1) % STEPS.length].key;
      });
      setCycle((c) => c + 1);
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [inView, auto, reduceMotion, active, cycle]);

  const select = (key: StepKey) => {
    setAuto(false);
    setActive(key);
  };

  const step = STEPS.find((s) => s.key === active) ?? STEPS[0];

  return (
    <SectionShell
      id="how"
      tone="default"
      eyebrow="How it works"
      title="Three moves. One surface."
      intro="File, triage, fix — a whole customs day without leaving the window."
    >
      <div ref={ref} className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Step rail — desktop */}
        <div className="hidden lg:col-span-4 lg:block">
          <ol className="flex flex-col gap-2">
            {STEPS.map((s) => {
              const isActive = s.key === active;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => select(s.key)}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-colors duration-200",
                      isActive
                        ? "border-border bg-card shadow-card"
                        : "border-transparent hover:border-border/60 hover:bg-card/50",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg font-mono text-[12px] font-semibold tabular-nums transition-colors duration-200",
                          isActive
                            ? "bg-gold text-yellow-950"
                            : "border border-border/70 bg-background text-muted-foreground",
                        )}
                      >
                        {s.number}
                      </span>
                      <div className="min-w-0">
                        <h3
                          className={cn(
                            "text-[15px] font-semibold tracking-tight transition-colors duration-200",
                            isActive ? "text-foreground" : "text-foreground/70",
                          )}
                        >
                          {s.title}
                        </h3>
                        <p
                          className={cn(
                            "mt-1.5 text-[13px] leading-relaxed text-muted-foreground transition-opacity duration-200",
                            isActive ? "opacity-100" : "opacity-70",
                          )}
                        >
                          {s.body}
                        </p>
                        {isActive && (
                          <Link
                            href={s.href}
                            className="group/link mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground transition-colors hover:text-gold-dark dark:hover:text-gold"
                          >
                            {s.linkLabel}
                            <ArrowRight
                              size={14}
                              className="transition-transform group-hover/link:translate-x-0.5"
                            />
                          </Link>
                        )}
                      </div>
                    </div>
                    {/* Auto-advance progress along the bottom hairline */}
                    {isActive && auto && !reduceMotion && (
                      <motion.span
                        key={`progress-${s.key}-${cycle}`}
                        aria-hidden
                        initial={{ scaleX: 0 }}
                        animate={inView ? { scaleX: 1 } : undefined}
                        transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                        className="absolute inset-x-5 bottom-0 h-px origin-left bg-gold/60"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Step tabs — mobile */}
        <div className="lg:hidden">
          <div
            role="tablist"
            aria-label="Workflow steps"
            className="grid grid-cols-3 gap-2"
          >
            {STEPS.map((s) => {
              const isActive = s.key === active;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => select(s.key)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors",
                    isActive
                      ? "border-gold/50 bg-gold/10 text-foreground"
                      : "border-border/60 bg-card/50 text-muted-foreground",
                  )}
                >
                  <span className="font-mono text-[11px] tabular-nums opacity-60">
                    {s.number}
                  </span>
                  {s.short}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        </div>

        {/* The one window */}
        <div className="lg:col-span-8">
          <MacWindow
            urlBar={step.urlBar}
            contentClassName="relative min-h-[480px] sm:min-h-[440px]"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: EASE_OUT_QUART }}
                className="p-4 sm:p-6"
              >
                {step.key === "file" && <PanelFile />}
                {step.key === "triage" && <PanelTriage />}
                {step.key === "fix" && <PanelFix />}
              </motion.div>
            </AnimatePresence>
          </MacWindow>

          {/* Mobile deep link for the active step */}
          <div className="mt-4 lg:hidden">
            <Link
              href={step.href}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-gold-dark dark:hover:text-gold"
            >
              {step.linkLabel}
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ---------- Panel 01 · File ---------- */

type WizardStep = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status: "done" | "active" | "pending";
};

const WIZARD_STEPS: WizardStep[] = [
  { key: "importer", label: "Importer", icon: Building2, status: "done" },
  { key: "parties", label: "Parties", icon: Users, status: "done" },
  { key: "shipment", label: "Shipment", icon: Ship, status: "done" },
  { key: "commodities", label: "Commodities", icon: Boxes, status: "active" },
  { key: "containers", label: "Containers", icon: ContainerIcon, status: "pending" },
  { key: "bond", label: "Bond", icon: ShieldCheck, status: "pending" },
  { key: "review", label: "Review", icon: ClipboardCheck, status: "pending" },
];

const COMMODITIES = [
  { hts: "6115.96.6010", desc: "Women's polyester athletic socks", ok: true },
  { hts: "6109.10.0027", desc: "Cotton T-shirts, women's", ok: true },
  { hts: "6204.62.4011", desc: "Cotton trousers, women's", ok: false },
];

const PREFLIGHT: { tone: Severity; label: string; body: string }[] = [
  { tone: "rose", label: "1 critical", body: "Manufacturer party missing tax ID" },
  { tone: "amber", label: "2 warnings", body: "HTS 6204.62.4011 has ADD/CVD watch" },
  { tone: "emerald", label: "Suggestion", body: "Save these parties as template" },
];

function PanelFile() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          INV-4502 · ISF-10 — Draft
        </span>
        <SeverityPill tone="amber">4h to deadline</SeverityPill>
      </div>

      {/* Step rail */}
      <ol className="mb-6 grid grid-cols-7 gap-1.5 border-b border-border/60 pb-5">
        {WIZARD_STEPS.map((s) => {
          const Icon = s.icon;
          const done = s.status === "done";
          const isActive = s.status === "active";
          return (
            <li key={s.key} className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border sm:size-9",
                  done && "border-gold/40 bg-gold/20 text-gold-dark dark:text-gold",
                  isActive && "border-gold bg-gold text-yellow-950 shadow-gold",
                  !done && !isActive && "border-border/60 bg-card text-muted-foreground",
                )}
              >
                {done ? <Check size={14} /> : <Icon size={13} />}
              </span>
              <span
                className={cn(
                  "mt-1.5 hidden text-[10px] font-medium sm:block",
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Commodities · 3 items
          </h4>
          <div className="space-y-2.5">
            {COMMODITIES.map((c) => (
              <div
                key={c.hts}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-2.5"
              >
                <span className="font-mono text-[11.5px] font-semibold tabular-nums text-foreground">
                  {c.hts}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
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
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pre-flight · AI review
          </h4>
          <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
            {PREFLIGHT.map((row) => (
              <div key={row.label} className="flex items-start gap-2">
                <SeverityPill tone={row.tone} className="mt-0.5">
                  {row.label}
                </SeverityPill>
                <span className="text-[11.5px] leading-snug text-muted-foreground">
                  {row.body}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Rule-based validation plus an optional AI pre-flight on every
            draft — nothing leaves your hands unchecked.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Panel 02 · Triage ---------- */

type QueueRow = {
  id: string;
  title: string;
  meta: string;
  score: number;
  tone: "rose" | "amber" | "emerald";
  pill: string;
  pillTone: Severity;
};

const TRIAGE_QUEUE: QueueRow[] = [
  {
    id: "INV-4421",
    title: "CBP rejected — INV-4421",
    meta: "Manufacturer party missing tax ID · Open AI coach to fix",
    score: 42,
    tone: "rose",
    pill: "Rejected",
    pillTone: "rose",
  },
  {
    id: "INV-4502",
    title: "ISF-10 deadline in 4h — INV-4502",
    meta: "MBOL MAEU9381-2 · Vessel arriving Long Beach 18:30",
    score: 78,
    tone: "amber",
    pill: "4h",
    pillTone: "amber",
  },
  {
    id: "INV-4198",
    title: "UFLPA high-risk — INV-4198",
    meta: "Apparel from Xinjiang-adjacent supplier · Review evidence",
    score: 24,
    tone: "rose",
    pill: "High",
    pillTone: "rose",
  },
  {
    id: "Entry-230-1148293-5",
    title: "PSC window closing — Entry 230-1148293-5",
    meta: "11 days to PSC · 53 days to liquidation",
    score: 88,
    tone: "amber",
    pill: "PSC",
    pillTone: "amber",
  },
  {
    id: "drafts-3",
    title: "3 drafts ready for review",
    meta: "Templates · AI pre-flight available · Bulk submit",
    score: 96,
    tone: "emerald",
    pill: "Ready",
    pillTone: "emerald",
  },
];

function PanelTriage() {
  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <Donut value={86} tone="gold" size={64} strokeWidth={3.5} showLabel delay={0.2} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles size={12} className="text-gold-dark dark:text-gold" aria-hidden />
            Today&apos;s brief
          </div>
          <p className="text-[13px] font-medium leading-snug text-foreground sm:text-sm">
            3 drafts waiting on you. Run an AI pre-flight before submitting —
            one rejection blocking re-file.
          </p>
        </div>
      </div>

      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Action queue
        </span>
        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
          5 need attention
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {TRIAGE_QUEUE.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-2.5 sm:p-3"
          >
            <Donut value={row.score} tone={row.tone} size={32} delay={0.3} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-foreground sm:text-[13px]">
                {row.title}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {row.meta}
              </div>
            </div>
            <SeverityPill tone={row.pillTone}>{row.pill}</SeverityPill>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Panel 03 · Fix ---------- */

const AI_RESPONSE = `CBP rejected because the manufacturer party is missing a tax ID.

Three fixes, in order:
  1. Open INV-4421 → Parties → Manufacturer
  2. Add the tax ID (DUNS, MID, or foreign ID)
  3. Re-submit — the bond and other parties carry over

Pre-flight on this filing would have caught it.`;

function PanelFix() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-[hsl(43_96%_56%/0.18)] to-[hsl(43_96%_56%/0.08)] px-4 py-2.5 text-sm text-foreground ring-1 ring-[hsl(43_96%_56%/0.25)]">
          Why was INV-4421 rejected?
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 ring-1 ring-border/60">
          <Bot className="size-4 text-foreground/70" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="font-semibold">AI Coach</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">rejection mode</span>
          </div>
          <CodeStream
            variant="chat"
            replayOnView
            speed={10}
            startDelay={400}
            text={AI_RESPONSE}
            ariaLabel="AI Coach response streaming"
            className="min-h-[220px] text-[13px]"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {[
          { label: "Rejection mode", Icon: Bot },
          { label: "Pre-flight mode", Icon: Sparkles },
        ].map(({ label, Icon }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-card"
          >
            <Icon className="size-3.5 text-foreground/60" aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
