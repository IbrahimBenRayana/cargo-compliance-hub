"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, MoreHorizontal, Sparkles } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Hero3D } from "@/components/hero3d/Hero3D";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { Donut } from "@/components/ui/donut";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
// Hero illustration is defined inline below for a tighter match with the
// Compliance Center's specific story (queue + score + alerts).

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "risk", label: "Risk & Watch" },
  { id: "classification", label: "Classification" },
  { id: "records", label: "Records" },
];

const QUEUE: {
  title: string;
  meta: string;
  score: number;
  tone: Extract<Severity, "rose" | "amber" | "emerald">;
  pill: string;
}[] = [
  { title: "CBP rejected: INV-4421", meta: "Manufacturer party missing tax ID · Open AI coach to fix", score: 42, tone: "rose", pill: "Rejected" },
  { title: "ISF-10 deadline in 4h: INV-4502", meta: "MBOL MAEU9381-2 · Vessel arriving Long Beach 18:30", score: 78, tone: "amber", pill: "4h" },
  { title: "UFLPA high-risk: INV-4198", meta: "Apparel from Xinjiang-adjacent supplier · Review evidence", score: 24, tone: "rose", pill: "High" },
  { title: "PSC window closing: Entry 230-1148293-5", meta: "11 days to PSC · 53 days to liquidation", score: 88, tone: "amber", pill: "PSC" },
  { title: "3 drafts ready for review", meta: "Templates · AI pre-flight available · Bulk submit", score: 96, tone: "emerald", pill: "Ready" },
];

const RISK_KPIS = [
  { value: "12,847", label: "Scanned" },
  { value: "23", label: "High risk" },
  { value: "142", label: "Elevated" },
  { value: "12,682", label: "Clean" },
];

const UFLPA_ROWS: { id: string; score: number; tone: Extract<Severity, "rose" | "amber" | "emerald">; pillTone: Severity; pill: string; meta: string }[] = [
  { id: "INV-4198", score: 24, tone: "rose", pillTone: "rose", pill: "High", meta: "Apparel · Xinjiang-adjacent supplier · Reviewed 2h ago" },
  { id: "INV-4202", score: 58, tone: "amber", pillTone: "amber", pill: "Elevated", meta: "Cotton goods · 2nd-tier supplier in PRC" },
  { id: "INV-4211", score: 71, tone: "amber", pillTone: "amber", pill: "Elevated", meta: "Polysilicon trace · supplier chain verified" },
  { id: "INV-4217", score: 80, tone: "emerald", pillTone: "blue", pill: "Info", meta: "Routine flag · supplier on safe list" },
  { id: "INV-4224", score: 92, tone: "emerald", pillTone: "emerald", pill: "Clean", meta: "Fully audited supplier chain" },
];

const PGA = [
  { name: "FDA", required: "Permit required", tone: "rose" as const, body: "0207.13.00, fresh chicken" },
  { name: "USDA-APHIS", required: "Conditional", tone: "amber" as const, body: "Plant/animal origin" },
  { name: "EPA", required: "Not required", tone: "neutral" as const, body: "Non-chemical" },
  { name: "FCC", required: "Not required", tone: "neutral" as const, body: "No radio device" },
];

const HTS_SUGGESTIONS = [
  { code: "6115.96.6010", desc: "Stockings, socks · Knit · Of cotton", best: true, reason: "Best match. Polyester is synthetic and athletic socks are typically knit." },
  { code: "6115.95.6020", desc: "Stockings, socks · Synthetic fibers", best: false, reason: "Alternative. Used for non-cotton blends." },
  { code: "6115.99.1410", desc: "Stockings, socks · Other textile materials", best: false, reason: "Fallback for blends with no dominant material." },
];

const ADD_CVD = [
  { case: "A-570-053", product: "Steel wheels", country: "China", status: "amended", tone: "amber" as const },
  { case: "A-552-826", product: "Wood mouldings", country: "Vietnam", status: "new", tone: "rose" as const },
  { case: "A-549-844", product: "Polyester yarn", country: "Thailand", status: "sunset", tone: "emerald" as const },
  { case: "A-583-871", product: "PET resin", country: "Taiwan", status: "amended", tone: "amber" as const },
  { case: "A-475-841", product: "Solar cells", country: "Italy", status: "revoked", tone: "neutral" as const },
];

const FTA_PROGRAMS = [
  "USMCA", "GSP", "AGOA", "CBI", "Israel", "Jordan", "Korea", "Australia",
  "Singapore", "Chile", "CAFTA-DR", "Peru", "Colombia", "Panama",
  "Morocco", "Bahrain", "Oman",
];

const RECORDS_KPIS = [
  { value: "1,247", label: "Tracked" },
  { value: "142", label: "PSC open" },
  { value: "38", label: "Awaiting liquidation" },
  { value: "1,067", label: "Liquidated this year" },
];

const ENTRIES = [
  { number: "230-1148293-5", importer: "Atlas Apparel · Long Beach", elapsed: 308, score: 64 },
  { number: "230-1126044-2", importer: "Northwind Electronics · LAX", elapsed: 263, score: 81 },
  { number: "230-1131775-8", importer: "Pinecone Furniture · NY/NJ", elapsed: 221, score: 89 },
  { number: "230-1144501-9", importer: "Galaxy Toys · Seattle", elapsed: 176, score: 92 },
  { number: "230-1149820-4", importer: "Pacific Spirits · Charleston", elapsed: 139, score: 86 },
  { number: "230-1152300-7", importer: "Aurora Hardware · Houston", elapsed: 97, score: 94 },
];

const TOTAL_DAYS = 314;
const PSC_DAY = 270;
const URGENT_THRESHOLD = TOTAL_DAYS - 14;

function entryStatus(d: number): { tone: Severity; label: string } {
  if (d >= URGENT_THRESHOLD) return { tone: "rose", label: "Urgent" };
  if (d >= PSC_DAY) return { tone: "amber", label: "PSC closing" };
  return { tone: "emerald", label: "On track" };
}

export function ComplianceClient() {
  return (
    <>
      <PageHero
        label="Platform"
        title="The Compliance Center."
        description="Four tabs. Every shipped capability in one calm surface: action queue, risk inbox, classification, and the 314-day liquidation pipeline."
        breadcrumbs={[
          { label: "Platform", href: "/features" },
          { label: "Compliance Center", href: "/platform/compliance" },
        ]}
        illustration={<Hero3D scene="compliance" />}
      />

      {/* Tab nav, pill-style with stronger visual distinction */}
      <nav className="sticky top-16 z-30 border-y border-border/60 bg-background/95 backdrop-blur-md shadow-card">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 overflow-x-auto px-4 py-3 lg:px-6">
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mr-2 sm:inline">
            Jump to
          </span>
          {TABS.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-4 py-1.5 text-[12px] font-semibold text-foreground shadow-card transition-[transform,border-color,background-color,color] duration-150 ease-out hover:-translate-y-0.5 hover:border-gold/60 hover:bg-gold/10 hover:text-gold-dark dark:hover:text-gold"
            >
              <span className="size-1.5 rounded-full bg-gold/70 group-hover:bg-gold" aria-hidden />
              {t.label}
            </a>
          ))}
        </div>
      </nav>

      {/* OVERVIEW */}
      <SectionShell
        id="overview"
        tone="default"
        title="An inbox, not a dashboard."
        intro="Today's AI brief at the top. Then every filing that needs your attention, ranked by urgency, not chronology."
      >
        <div className="rounded-2xl border border-border/60 bg-card shadow-card-hover overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-card/60">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-400/70" />
              <span className="size-2.5 rounded-full bg-amber-400/70" />
              <span className="size-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <div className="text-[11px] font-mono text-muted-foreground tabular-nums">app.mycargolens.com/compliance</div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Overview</span>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 mb-6">
              <Donut value={86} tone="gold" size={96} strokeWidth={3.5} showLabel />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-gold-dark dark:text-gold" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Today’s brief</span>
                </div>
                <p className="text-foreground font-medium leading-snug">
                  3 drafts waiting on you. Run an AI pre-flight before submitting. One rejection is blocking re-file.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span aria-hidden className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Action queue</h3>
              </div>
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">5 need attention</span>
            </div>

            <ul className="flex flex-col gap-2">
              {QUEUE.map((row) => (
                <li key={row.title} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3 hover:bg-card hover:border-border transition-colors">
                  <Donut value={row.score} tone={row.tone} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">{row.title}</div>
                    <div className="text-[11.5px] text-muted-foreground truncate">{row.meta}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityPill tone={row.tone}>{row.pill}</SeverityPill>
                    <Bot size={14} className="hidden sm:inline text-muted-foreground" />
                    <MoreHorizontal size={14} className="hidden sm:inline text-muted-foreground" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { title: "How urgency is scored", body: "Severity × time-to-deadline × blast radius. Urgent items always rise to the top." },
            { title: "Snooze for 24h", body: "Not yours yet? Snooze the card; it returns tomorrow morning." },
            { title: "AI coach right there", body: "One click on any row opens the Coach with the full context already loaded." },
          ].map((c) => (
            <li key={c.title} className="rounded-xl border border-border/60 bg-card p-4">
              <h4 className="text-sm font-semibold text-foreground">{c.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* RISK & WATCH */}
      <SectionShell
        id="risk"
        tone="default"
        className="bg-muted/30"
        title="Spot risk before CBP does."
        intro="A unified risk inbox plus the partner-agency and 5106 verifications most teams do in spreadsheets."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          {RISK_KPIS.map((k) => (
            <div key={k.label} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="text-xl font-semibold tabular-nums text-foreground">{k.value}</div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground">UFLPA Risk Inbox</h3>
            <div className="flex items-center gap-1.5">
              {["All", "High", "Elevated", "Informational"].map((f) => (
                <span key={f} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">{f}</span>
              ))}
            </div>
          </div>
          <ul>
            {UFLPA_ROWS.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-secondary/30">
                <Donut value={row.score} tone={row.tone} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-mono font-semibold tabular-nums text-foreground">{row.id}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{row.meta}</div>
                </div>
                <SeverityPill tone={row.pillTone}>{row.pill}</SeverityPill>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">PGA Flag Lookup</h3>
            <div
              role="presentation"
              aria-hidden="true"
              className="mb-4 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-xs"
            >
              0207.13.00 · Chicken, fresh
            </div>
            <ul className="grid grid-cols-2 gap-2.5">
              {PGA.map((p) => (
                <li key={p.name} className="rounded-lg border border-border/60 bg-background/60 p-3">
                  <div className="font-semibold text-[12px] text-foreground">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{p.body}</div>
                  <SeverityPill tone={p.tone} className="mt-2">{p.required}</SeverityPill>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">5106 EIN Self-Check</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Catch malformed EINs and missing CBP 5106 registrations before
              CBP rejects your filing, plus a one-click jump to Form 5106.
            </p>
            <div
              role="presentation"
              aria-hidden="true"
              className="mb-3 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-xs"
            >
              12-3456789
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-[12px] text-foreground">EIN format valid · 5106 reminder armed</span>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* CLASSIFICATION */}
      <SectionShell
        id="classification"
        tone="default"
        title="HTS, ADD/CVD, FTA: every classification answer in one place."
      >
        <div className="rounded-2xl border border-border/60 bg-card p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">HTS Classifier</h3>
          <div
            role="presentation"
            aria-hidden="true"
            className="mb-4 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-sm"
          >
            polyester athletic socks, women&apos;s
          </div>
          <ul className="space-y-2">
            {HTS_SUGGESTIONS.map((s) => (
              <li key={s.code} className="rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">{s.code}</span>
                  <span className="flex-1 text-[12.5px] text-foreground">{s.desc}</span>
                  <SeverityPill tone={s.best ? "amber" : "neutral"}>{s.best ? "Best" : "Alt"}</SeverityPill>
                </div>
                <div className="text-[11px] text-muted-foreground italic">{s.reason}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground">ADD/CVD: recent updates</h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="relative flex size-2">
                <span aria-hidden className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Synced 04:02 UTC · daily at 04:00
            </div>
          </div>
          <ul>
            {ADD_CVD.map((r) => (
              <li key={r.case} className="grid grid-cols-12 gap-3 items-center px-4 py-2.5 border-b border-border/40 last:border-b-0 text-[12px]">
                <span className="col-span-3 font-mono tabular-nums text-foreground">{r.case}</span>
                <span className="col-span-5 text-foreground">{r.product}</span>
                <span className="col-span-2 text-muted-foreground">{r.country}</span>
                <span className="col-span-2"><SeverityPill tone={r.tone}>{r.status}</SeverityPill></span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">FTA Preference Calculator</h3>
          <p className="text-xs text-muted-foreground mb-4">17 preference programs supported. Which apply to your shipment?</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {FTA_PROGRAMS.map((p) => (
              <li key={p} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span className="text-[12px] font-medium text-foreground">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      {/* RECORDS */}
      <SectionShell
        id="records"
        tone="default"
        className="bg-muted/30"
        title="Every entry has a 314-day clock."
        intro="From CBP acceptance to liquidation. PSC closes at 270. Urgent rises to the top."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          {RECORDS_KPIS.map((k) => (
            <div key={k.label} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="text-xl font-semibold tabular-nums text-foreground">{k.value}</div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        <div className="relative pt-8 mb-6">
          <div className="absolute inset-x-0 top-0 flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground px-1">
            <span>Day 0 · accepted</span>
            <span>Day 270 · PSC</span>
            <span>Day 314 · liquidates</span>
          </div>
          <div className="relative h-2 rounded-full bg-secondary/60 overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.2, ease: EASE_OUT_QUART }}
              className="absolute inset-y-0 left-0 right-0 origin-left bg-gradient-to-r from-emerald-400/40 via-amber-400/40 to-rose-500/60"
            />
            <div className="absolute top-0 bottom-0 w-px bg-amber-500" style={{ left: `${(PSC_DAY / TOTAL_DAYS) * 100}%` }} />
            <div className="absolute top-0 bottom-0 w-px bg-rose-500" style={{ left: `${(URGENT_THRESHOLD / TOTAL_DAYS) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <ul>
            {[...ENTRIES].sort((a, b) => b.elapsed - a.elapsed).map((e) => {
              const pct = Math.min(100, (e.elapsed / TOTAL_DAYS) * 100);
              const { tone, label } = entryStatus(e.elapsed);
              return (
                <li key={e.number} className="grid grid-cols-12 gap-3 items-center px-4 py-3 border-b border-border/40 last:border-b-0">
                  <div className="col-span-12 md:col-span-3 flex items-center gap-3 min-w-0">
                    <Donut value={e.score} tone="gold" size={32} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-mono font-semibold tabular-nums text-foreground">{e.number}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{e.importer}</div>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-5">
                    <div className="relative h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${tone === "rose" ? "bg-rose-500" : tone === "amber" ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
                      <span>{e.elapsed}d / 314d</span>
                      <span>{TOTAL_DAYS - e.elapsed}d left</span>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-4 flex md:justify-end"><SeverityPill tone={tone}>{label}</SeverityPill></div>
                </li>
              );
            })}
          </ul>
        </div>
      </SectionShell>

      <SectionShell tone="muted" headingAlign="center" title="Want to see this for your shipments?">
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
