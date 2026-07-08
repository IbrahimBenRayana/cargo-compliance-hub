"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  CircleDot,
  Clock,
  FileDown,
  XCircle,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { SeverityPill } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
import { GOLD, ROSE, EMERALD } from "@/lib/colors";

/**
 * Animated lifecycle hero — a journey of milestone nodes connected by a
 * progress line. Mirrors the "Created → Submitted → CBP response →
 * Amended → Liquidated" story the page tells. Each milestone reveals on
 * scroll, the line draws between them, and the score sparkline at the
 * bottom traces in last.
 */
function LifecycleHeroIllustration() {
  const milestones = [
    { x: 80, y: 130, label: "Created", state: "done" as const },
    { x: 168, y: 130, label: "Submitted", state: "done" as const },
    { x: 256, y: 130, label: "Rejected", state: "rejected" as const },
    { x: 344, y: 130, label: "Amended", state: "done" as const },
    { x: 432, y: 130, label: "Accepted", state: "active" as const },
  ];

  // Mini sparkline points — same dip-then-recover story as the page's
  // real score history (62 → 38 → 84 → 92).
  const sparkX = [40, 110, 180, 250, 320, 390, 440];
  const sparkY = [196, 196, 226, 188, 188, 174, 174];
  const sparkPath = sparkX
    .map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${sparkY[i]}`)
    .join(" ");

  return (
    <motion.svg
      viewBox="0 0 480 360"
      className="w-full max-w-md h-auto text-foreground/90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <defs>
        <pattern id="lc-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" fillOpacity="0.08" stroke="none" />
        </pattern>
        <radialGradient id="lc-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lc-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={EMERALD} stopOpacity="0.7" />
          <stop offset="50%" stopColor={GOLD} stopOpacity="0.7" />
          <stop offset="100%" stopColor={EMERALD} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <ellipse cx="240" cy="180" rx="220" ry="150" fill="url(#lc-glow)" stroke="none" />

      {/* === TITLE STRIPS ============================================== */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: -6 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
        }}
      >
        <text
          x="42"
          y="64"
          fontSize="9"
          fontFamily="ui-sans-serif, sans-serif"
          fontWeight="700"
          letterSpacing="1.2"
          fill="currentColor"
          fillOpacity="0.55"
          stroke="none"
        >
          INV-4421 · ISF-10
        </text>
        <text
          x="438"
          y="64"
          textAnchor="end"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          fontWeight="600"
          fill="currentColor"
          fillOpacity="0.55"
          stroke="none"
        >
          Apr 12 · 09:14 → 11:54
        </text>
      </motion.g>

      {/* === Connecting line under milestones ========================== */}
      <motion.line
        x1="80"
        y1="130"
        x2="432"
        y2="130"
        stroke="url(#lc-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        variants={{
          hidden: { pathLength: 0 },
          visible: { pathLength: 1, transition: { duration: 1.4, ease: EASE, delay: 0.2 } },
        }}
      />

      {/* === Milestone nodes ========================================== */}
      {milestones.map((m, i) => (
        <motion.g
          key={m.label}
          variants={{
            hidden: { opacity: 0, scale: 0.7 },
            visible: {
              opacity: 1,
              scale: 1,
              transition: { duration: 0.45, ease: EASE, delay: 0.4 + i * 0.15 },
            },
          }}
        >
          {/* Halo */}
          {m.state === "active" && (
            <motion.circle
              cx={m.x}
              cy={m.y}
              r="16"
              stroke={GOLD}
              strokeWidth="1.5"
              fill="none"
              strokeOpacity="0.45"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: `${m.x}px ${m.y}px` }}
            />
          )}
          {/* Node */}
          <circle
            cx={m.x}
            cy={m.y}
            r="14"
            fill={
              m.state === "rejected"
                ? `${ROSE}26`
                : m.state === "active"
                  ? `${GOLD}33`
                  : `${EMERALD}26`
            }
            stroke={
              m.state === "rejected" ? ROSE : m.state === "active" ? GOLD : EMERALD
            }
            strokeWidth="2"
          />
          {/* Icon mark — check for done, X for rejected, dot for active */}
          {m.state === "done" && (
            <path
              d={`M ${m.x - 5} ${m.y} l 3.5 3.5 l 6 -6.5`}
              stroke={EMERALD}
              strokeWidth="2"
              fill="none"
            />
          )}
          {m.state === "rejected" && (
            <g stroke={ROSE} strokeWidth="2">
              <line x1={m.x - 4} y1={m.y - 4} x2={m.x + 4} y2={m.y + 4} />
              <line x1={m.x - 4} y1={m.y + 4} x2={m.x + 4} y2={m.y - 4} />
            </g>
          )}
          {m.state === "active" && (
            <circle cx={m.x} cy={m.y} r="3.5" fill={GOLD} stroke="none" />
          )}
          {/* Label */}
          <text
            x={m.x}
            y={m.y + 32}
            textAnchor="middle"
            fontSize="9"
            fontFamily="ui-sans-serif, sans-serif"
            fontWeight={m.state === "active" ? 700 : 600}
            fill="currentColor"
            fillOpacity={m.state === "active" ? 0.95 : 0.65}
            stroke="none"
          >
            {m.label}
          </text>
        </motion.g>
      ))}

      {/* === Section divider ========================================== */}
      <motion.line
        x1="40"
        y1="240"
        x2="440"
        y2="240"
        strokeOpacity="0.18"
        strokeDasharray="3 4"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.6, delay: 1.6 } },
        }}
      />

      {/* === Score sparkline below ==================================== */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: 6 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 1.7 } },
        }}
      >
        <text
          x="40"
          y="234"
          fontSize="8"
          fontFamily="ui-sans-serif, sans-serif"
          fontWeight="700"
          letterSpacing="0.8"
          fill="currentColor"
          fillOpacity="0.55"
          stroke="none"
        >
          SCORE OVER TIME
        </text>

        <motion.path
          d={sparkPath}
          stroke={GOLD}
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: EASE, delay: 1.9 }}
        />

        {/* Sparkline points with score labels */}
        {[
          { x: 40, y: 196, score: 62 },
          { x: 180, y: 226, score: 38 },
          { x: 320, y: 188, score: 84 },
          { x: 440, y: 174, score: 92 },
        ].map((p, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 2.5 + i * 0.15 }}
          >
            <circle cx={p.x} cy={p.y} r="3.5" fill={GOLD} stroke="white" strokeWidth="1.5" />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fontSize="8"
              fontFamily="ui-sans-serif, sans-serif"
              fontWeight="700"
              fill="currentColor"
              stroke="none"
            >
              {p.score}
            </text>
          </motion.g>
        ))}
      </motion.g>

      {/* === PDF export badge ========================================= */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: 8 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 2.0 } },
        }}
      >
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <rect
            x="40"
            y="284"
            width="120"
            height="48"
            rx="8"
            fill="currentColor"
            fillOpacity="0.04"
            strokeOpacity="0.55"
          />
          {/* PDF icon */}
          <rect x="54" y="296" width="20" height="24" rx="2" strokeOpacity="0.7" />
          <line x1="58" y1="304" x2="70" y2="304" strokeOpacity="0.5" />
          <line x1="58" y1="310" x2="68" y2="310" strokeOpacity="0.5" />
          <line x1="58" y1="316" x2="66" y2="316" strokeOpacity="0.5" />
          <text
            x="82"
            y="308"
            fontSize="9"
            fontFamily="ui-sans-serif, sans-serif"
            fontWeight="700"
            fill="currentColor"
            fillOpacity="0.78"
            stroke="none"
          >
            INV-4421.pdf
          </text>
          <text
            x="82"
            y="320"
            fontSize="7.5"
            fontFamily="ui-monospace, monospace"
            fontWeight="500"
            fill="currentColor"
            fillOpacity="0.55"
            stroke="none"
          >
            full lifecycle · 4 pages
          </text>
        </motion.g>
      </motion.g>

      {/* === ISF → ABI → Manifest chain badge ========================= */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: 8 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 2.2 } },
        }}
      >
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut", delay: 2.4 }}
        >
          <rect
            x="200"
            y="284"
            width="240"
            height="48"
            rx="8"
            fill="currentColor"
            fillOpacity="0.04"
            strokeOpacity="0.55"
          />
          {[
            { x: 218, label: "ISF" },
            { x: 296, label: "ABI" },
            { x: 374, label: "MANIFEST" },
          ].map((step, i) => (
            <g key={step.label}>
              <rect
                x={step.x - 14}
                y="302"
                width={step.label === "MANIFEST" ? 56 : 28}
                height="14"
                rx="4"
                fill={GOLD}
                fillOpacity="0.16"
                stroke={GOLD}
                strokeOpacity="0.4"
              />
              <text
                x={step.x + (step.label === "MANIFEST" ? 14 : 0)}
                y="312"
                textAnchor="middle"
                fontSize="7.5"
                fontFamily="ui-monospace, monospace"
                fontWeight="700"
                fill={GOLD}
                stroke="none"
              >
                {step.label}
              </text>
              {i < 2 && (
                <line
                  x1={step.x + (step.label === "MANIFEST" ? 0 : 16)}
                  y1="309"
                  x2={step.x + 50}
                  y2="309"
                  strokeOpacity="0.4"
                />
              )}
            </g>
          ))}
          <text
            x="320"
            y="296"
            textAnchor="middle"
            fontSize="7"
            fontFamily="ui-sans-serif, sans-serif"
            fontWeight="700"
            letterSpacing="0.6"
            fill="currentColor"
            fillOpacity="0.55"
            stroke="none"
          >
            CHAIN · all three linked
          </text>
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}

const TIMELINE = [
  { label: "Created", date: "Apr 12 · 09:14", status: "done" as const },
  { label: "Submitted to CBP", date: "Apr 12 · 09:21", status: "done" as const },
  { label: "CBP response", date: "Apr 12 · 09:23", status: "done" as const, badge: "rejected" as const },
  { label: "Amended", date: "Apr 12 · 11:48", status: "done" as const },
  { label: "Re-submitted", date: "Apr 12 · 11:51", status: "done" as const, badge: "accepted" as const },
  { label: "Liquidated", date: "Pending", status: "pending" as const },
];

const SCORE_HISTORY = [
  { day: "Apr 12 · 09:14", score: 62, event: "Created · 1 critical, 2 warnings" },
  { day: "Apr 12 · 09:21", score: 62, event: "Submitted to CBP" },
  { day: "Apr 12 · 09:23", score: 38, event: "CBP rejected: manufacturer party missing tax ID" },
  { day: "Apr 12 · 11:48", score: 84, event: "Amended: tax ID added, pre-flight clean" },
  { day: "Apr 12 · 11:51", score: 84, event: "Re-submitted to CBP" },
  { day: "Apr 12 · 11:54", score: 92, event: "Accepted by CBP: score finalised" },
];

const VALIDATION_TICKER = [
  { tone: "rose" as const, count: 1, label: "critical" },
  { tone: "amber" as const, count: 2, label: "warnings" },
  { tone: "blue" as const, count: 0, label: "info" },
];

const PIPELINE = [
  { type: "ISF-10", status: "accepted" as const, key: "ISF-10" },
  { type: "ABI 7501", status: "accepted" as const, key: "ABI 7501" },
  { type: "Manifest", status: "tracking" as const, key: "Manifest" },
];

export function LifecycleClient() {
  return (
    <>
      <PageHero
        label="Platform"
        title="Every filing has a story you can read."
        description="Created → Submitted → CBP response → Amended → Liquidated. Score history with a per-event ticker. Rejection cards translated into plain English. Full ISF → ABI → manifest chain. PDF export at any stage."
        breadcrumbs={[
          { label: "Platform", href: "/features" },
          { label: "Lifecycle", href: "/platform/lifecycle" },
        ]}
        illustration={<LifecycleHeroIllustration />}
      />

      {/* Timeline */}
      <SectionShell tone="default" eyebrow="Timeline" title="Every event, in order, with the time it happened.">
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <ol className="relative">
            <span className="absolute left-3 top-2 bottom-2 w-px bg-border/60" aria-hidden />
            {TIMELINE.map((step) => (
              <li key={step.label} className="relative pl-9 pb-5 last:pb-0">
                <span
                  className={cn(
                    "absolute left-0 top-1 grid size-6 place-items-center rounded-full border-2",
                    step.status === "done"
                      ? "border-gold bg-gold/20 text-gold-dark dark:text-gold"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {step.status === "done" ? <Check size={12} /> : <CircleDot size={12} />}
                </span>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-sm font-semibold text-foreground">{step.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{step.date}</span>
                  {step.badge === "rejected" && <SeverityPill tone="rose">Rejected</SeverityPill>}
                  {step.badge === "accepted" && <SeverityPill tone="emerald">Accepted</SeverityPill>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </SectionShell>

      {/* Score history sparkline + ticker */}
      <SectionShell tone="default" className="bg-muted/30" title="See your compliance score move with every event." intro="Snapshotted at every scoring event. Each row in the ticker explains the delta.">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-card p-5 lg:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Score over time</div>
            <svg viewBox="0 0 240 80" className="w-full h-32" aria-hidden>
              {(() => {
                const pts = SCORE_HISTORY.map((s, i) => {
                  const x = (i / (SCORE_HISTORY.length - 1)) * 220 + 10;
                  const y = 70 - (s.score / 100) * 60;
                  return { x, y, score: s.score };
                });
                const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                return (
                  <>
                    <motion.path
                      d={path}
                      stroke="hsl(43 96% 56%)"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                    {pts.map((p, i) => (
                      <motion.circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill="hsl(43 96% 56%)"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.6 + i * 0.1 }}
                      />
                    ))}
                  </>
                );
              })()}
            </svg>
            <div className="mt-3 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>Apr 12 · 09:14</span>
              <span>Apr 12 · 11:54</span>
            </div>
            <div className="mt-4 flex items-center gap-4">
              {VALIDATION_TICKER.map((t) => (
                <div key={t.label} className="flex items-center gap-1.5 text-[11px]">
                  <SeverityPill tone={t.tone}>{t.count}</SeverityPill>
                  <span className="text-muted-foreground">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5 lg:col-span-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Event ticker</div>
            <ul className="space-y-2.5">
              {SCORE_HISTORY.map((s) => (
                <li key={s.day + s.event} className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                  <span className="mt-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground whitespace-nowrap">{s.day}</span>
                  <span className="text-[12px] text-foreground flex-1 leading-snug">{s.event}</span>
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">{s.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionShell>

      {/* Rejection card translated */}
      <SectionShell tone="default" title="CBP error codes, translated.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <XCircle size={16} className="text-rose-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">CBP response · raw</span>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(220_22%_12%)] p-3 font-mono text-[11px] text-rose-200">
{`ABI Code: 7K1-022
Subject: 5106 / PARTY
Severity: REJECT
Detail: MFR EIN/MID/DUNS REQUIRED
Filing: INV-4421 (ISF-10)
Vessel: MAEU9381-2
Filed at: 2026-04-12T09:21:00Z`}
            </pre>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What it actually means</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed mb-3">
              The manufacturer party is missing its tax ID. CBP needs either a US EIN, a manufacturer ID (MID), or a foreign tax ID like DUNS to clear the filing.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Open INV-4421 → Parties → Manufacturer</li>
              <li>Add the tax ID (DUNS, MID, or foreign ID accepted)</li>
              <li>Re-submit. The bond and other parties carry over.</li>
            </ol>
          </div>
        </div>
      </SectionShell>

      {/* ISF → ABI → Manifest chain */}
      <SectionShell tone="default" className="bg-muted/30" title="Follow the shipment from ISF to manifest.">
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {PIPELINE.map((p, i) => (
              <div key={p.key} className="relative rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground">{p.type}</span>
                  <SeverityPill tone={p.status === "accepted" ? "emerald" : "blue"}>
                    {p.status === "accepted" ? "Accepted" : "Tracking"}
                  </SeverityPill>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {i === 0 && "ISF-10 accepted by CBP. Manufacturer party verified."}
                  {i === 1 && "Entry summary filed and accepted. Bond posted."}
                  {i === 2 && "Manifest live. Vessel ETA Long Beach 18:30."}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      {/* PDF export */}
      <SectionShell tone="default" title="Every filing, exportable.">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card p-6 flex items-center gap-4">
          <IconTile icon={FileDown} hover="lift" size="lg" reveal />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">One-click PDF of any filing, at any stage.</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              Wizard fields, CBP responses, score history, AI Coach explanations, all in one self-contained document. Use it for audits, customer hand-offs, or your records system.
            </p>
          </div>
          <Clock size={18} className="text-muted-foreground hidden sm:block" />
        </div>
      </SectionShell>

      <SectionShell tone="muted" headingAlign="center" title="See it on your own filings.">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="gold" size="lg" asChild>
            <Link href="/book-a-demo">Request a demo</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </SectionShell>
    </>
  );
}
