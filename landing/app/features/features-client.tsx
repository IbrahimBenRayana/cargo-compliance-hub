"use client";

import Link from "next/link";
import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Bot,
  Boxes,
  ClipboardList,
  Clock,
  Database,
  FileDown,
  Layers,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Ship,
  Sparkles,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";

/**
 * Features overview hero — 5 floating tiles (one per platform surface) +
 * a "+30 more" tile in the 6th slot. No bg box; floats freely with a
 * soft gold glow behind.
 */
function FeaturesHeroIllustration() {
  const tiles = [
    { x: 70, y: 70, label: "FILINGS", delay: 0, draw: <>
      <rect x="92" y="92" width="36" height="24" rx="2" stroke={GOLD} strokeOpacity="0.85" />
      <line x1="98" y1="100" x2="122" y2="100" stroke={GOLD} strokeOpacity="0.6" />
      <line x1="98" y1="106" x2="118" y2="106" stroke={GOLD} strokeOpacity="0.6" />
      <line x1="98" y1="112" x2="110" y2="112" stroke={GOLD} strokeOpacity="0.6" />
    </> },
    { x: 180, y: 70, label: "COMPLIANCE", delay: 0.1, draw: <>
      <circle cx="220" cy="105" r="14" stroke={GOLD} strokeOpacity="0.85" />
      <path d="M 214 105 l 4 4 l 9 -9" stroke={GOLD} strokeOpacity="0.85" strokeWidth="2" />
    </> },
    { x: 290, y: 70, label: "AI", delay: 0.2, draw: <>
      <circle cx="330" cy="105" r="14" stroke={GOLD} strokeOpacity="0.85" />
      <circle cx="325" cy="102" r="1.5" fill={GOLD} stroke="none" />
      <circle cx="335" cy="102" r="1.5" fill={GOLD} stroke="none" />
      <path d="M 322 110 q 8 5 16 0" stroke={GOLD} strokeOpacity="0.85" />
      <path d="M 330 91 v -4" stroke={GOLD} strokeOpacity="0.6" />
    </> },
    { x: 70, y: 190, label: "LIFECYCLE", delay: 0.3, draw: <>
      <line x1="92" y1="225" x2="128" y2="225" stroke={GOLD} strokeOpacity="0.6" />
      <circle cx="98" cy="225" r="4" stroke={GOLD} strokeOpacity="0.85" fill={`${GOLD}26`} />
      <circle cx="110" cy="225" r="4" stroke={GOLD} strokeOpacity="0.85" fill={`${GOLD}26`} />
      <circle cx="122" cy="225" r="4" stroke={GOLD} strokeOpacity="0.85" fill={GOLD} />
    </> },
    { x: 180, y: 190, label: "AUTOMATION", delay: 0.4, draw: <>
      <circle cx="220" cy="225" r="14" stroke={GOLD} strokeOpacity="0.85" />
      <line x1="220" y1="225" x2="220" y2="215" stroke={GOLD} strokeOpacity="0.85" strokeWidth="2" />
      <line x1="220" y1="225" x2="226" y2="225" stroke={GOLD} strokeOpacity="0.85" strokeWidth="2" />
      <circle cx="220" cy="225" r="1.5" fill={GOLD} stroke="none" />
    </> },
  ];

  return (
    <motion.svg
      viewBox="0 0 480 320"
      className="w-full max-w-md h-auto text-foreground/90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
    >
      <defs>
        <radialGradient id="ftr-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.18" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="160" rx="220" ry="130" fill="url(#ftr-glow)" stroke="none" />

      {tiles.map((tile, i) => (
        <motion.g
          key={tile.label}
          variants={{
            hidden: { opacity: 0, y: 12, scale: 0.94 },
            visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE, delay: tile.delay } },
          }}
        >
          <motion.g
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: tile.delay + 0.5 }}
          >
            <rect x={tile.x} y={tile.y} width="90" height="90" rx="10" fill="currentColor" fillOpacity="0.035" strokeOpacity="0.65" />
            {tile.draw}
            <text
              x={tile.x + 45}
              y={tile.y + 80}
              textAnchor="middle"
              fontSize="8"
              fontFamily="ui-sans-serif, sans-serif"
              fontWeight="700"
              letterSpacing="0.8"
              fill="currentColor"
              fillOpacity="0.65"
              stroke="none"
            >
              {tile.label}
            </text>
          </motion.g>
        </motion.g>
      ))}

      {/* +30 MORE tile */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: 12, scale: 0.94 },
          visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE, delay: 0.5 } },
        }}
      >
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <rect
            x="290"
            y="190"
            width="90"
            height="90"
            rx="10"
            fill={`${GOLD}10`}
            stroke={GOLD}
            strokeOpacity="0.6"
            strokeDasharray="3 4"
          />
          <text x="335" y="232" textAnchor="middle" fontSize="20" fontFamily="ui-sans-serif, sans-serif" fontWeight="700" fill={GOLD} stroke="none">+30</text>
          <text x="335" y="252" textAnchor="middle" fontSize="8" fontFamily="ui-sans-serif, sans-serif" fontWeight="700" letterSpacing="0.6" fill="currentColor" fillOpacity="0.65" stroke="none">MORE</text>
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}

type Surface = {
  id: string;
  label: string;
  title: string;
  blurb: string;
  href: string;
  count: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const SURFACES: Surface[] = [
  {
    id: "filings",
    label: "Filings",
    title: "One wizard. Every shipment type.",
    blurb: "ISF-10, ISF-5, Entry, Entry Summary, In-Bond. Templates, duplicate, bulk submit, rule-based gate + AI pre-flight.",
    href: "/platform/filings",
    count: 12,
    icon: Ship,
  },
  {
    id: "compliance",
    label: "Compliance Center",
    title: "An inbox for US customs.",
    blurb: "Action queue ranked by urgency. UFLPA risk inbox. PGA flags (FDA / USDA-APHIS / EPA / FCC). 314-day liquidation clock.",
    href: "/platform/compliance",
    count: 14,
    icon: ClipboardList,
  },
  {
    id: "ai",
    label: "AI",
    title: "Plain English explains every rejection.",
    blurb: "Today's brief. AI Coach (rejection + pre-flight modes). HTS Classifier. Built on gpt-4o, gated by your team's enable flag.",
    href: "/platform/ai",
    count: 4,
    icon: Bot,
  },
  {
    id: "lifecycle",
    label: "Lifecycle",
    title: "Every filing has a story.",
    blurb: "Per-filing timeline. Compliance score sparkline + event ticker. Rejection cards translated. ISF→ABI→manifest chain. PDF export.",
    href: "/platform/lifecycle",
    count: 6,
    icon: ListChecks,
  },
  {
    id: "automation",
    label: "Automation",
    title: "Background work, happening 24/7.",
    blurb: "CBP polled every 5 min. Federal Register synced daily at 04:00 UTC. Hourly deadline alerts. Multi-user RBAC. Notifications.",
    href: "/platform/automation",
    count: 10,
    icon: RefreshCw,
  },
];

type Status = "live" | "q3-2026" | "q4-2026" | "2027";

type Feature = {
  name: string;
  surface: Surface["id"];
  status: Status;
  blurb: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const FEATURES: Feature[] = [
  // Filings
  { name: "ISF-10 filing", surface: "filings", status: "live", blurb: "10 + 2 elements for ocean cargo importers.", icon: Ship },
  { name: "ISF-5 filing", surface: "filings", status: "live", blurb: "5-element ISF for foreign exporters / FROB.", icon: Ship },
  { name: "ABI 7501 Entry Summary", surface: "filings", status: "live", blurb: "Prefilled from accepted ISF — bond carries over.", icon: ClipboardList },
  { name: "ABI 3461 Entry", surface: "filings", status: "live", blurb: "Manifest queries by Master BOL + hold notices.", icon: ClipboardList },
  { name: "In-Bond filing", surface: "filings", status: "live", blurb: "Cross-port moves with hand-off tracking.", icon: Layers },
  { name: "Templates", surface: "filings", status: "live", blurb: "Save parties, ports, HTS, bond as reusable templates.", icon: Boxes },
  { name: "Duplicate any filing", surface: "filings", status: "live", blurb: "Clone a draft/accepted/rejected filing in one click.", icon: Boxes },
  { name: "Bulk submit", surface: "filings", status: "live", blurb: "Submit up to 50 drafts in parallel.", icon: Layers },
  { name: "Rule-based validation gate", surface: "filings", status: "live", blurb: "Deterministic checks before every submit.", icon: ShieldCheck },
  { name: "AI pre-flight review", surface: "filings", status: "live", blurb: "Streamed review of any draft/submitted/on-hold filing.", icon: Sparkles },
  { name: "PDF export", surface: "filings", status: "live", blurb: "Full filing + lifecycle as a single PDF.", icon: FileDown },
  { name: "FDA Prior Notice", surface: "filings", status: "q3-2026", blurb: "Direct FDA filing for food/drug shipments.", icon: ShieldCheck },

  // Compliance Center
  { name: "Action queue (urgency-ranked)", surface: "compliance", status: "live", blurb: "Cards ranked by urgency, not chronology.", icon: ClipboardList },
  { name: "Today's AI brief", surface: "compliance", status: "live", blurb: "One-sentence brief auto-generated each login.", icon: Sparkles },
  { name: "Compliance score (per filing)", surface: "compliance", status: "live", blurb: "0-100 score with snapshot at every scoring event.", icon: ShieldCheck },
  { name: "UFLPA Risk Inbox", surface: "compliance", status: "live", blurb: "Severity-ranked filings with supplier chain evidence.", icon: ShieldCheck },
  { name: "PGA Flag Lookup", surface: "compliance", status: "live", blurb: "FDA, USDA-APHIS, EPA, FCC flags per HTS.", icon: ShieldCheck },
  { name: "5106 EIN self-check", surface: "compliance", status: "live", blurb: "Verify EIN matches IRS records before filing.", icon: ShieldCheck },
  { name: "HTS Classifier", surface: "compliance", status: "live", blurb: "AI-suggested 10-digit HTS from goods description.", icon: Sparkles },
  { name: "ADD/CVD daily sync", surface: "compliance", status: "live", blurb: "Federal Register synced daily at 04:00 UTC.", icon: Database },
  { name: "FTA Preference Calculator", surface: "compliance", status: "live", blurb: "USMCA, GSP, AGOA, CBI + 13 more programs.", icon: ShieldCheck },
  { name: "Liquidation Pipeline", surface: "compliance", status: "live", blurb: "314-day window per accepted entry, PSC at 270.", icon: Clock },
  { name: "PSC window tracking", surface: "compliance", status: "live", blurb: "Urgent entries (≤14d) rise to the top.", icon: Clock },
  { name: "Snooze cards (24h)", surface: "compliance", status: "live", blurb: "Not yours yet? Snooze and revisit tomorrow.", icon: Clock },
  { name: "Bulk-fix opportunities", surface: "compliance", status: "live", blurb: "When 3+ filings share a root cause, fix all at once.", icon: Layers },
  { name: "CBP exam tracking", surface: "compliance", status: "q4-2026", blurb: "Exam intent notices + status from CBP.", icon: ShieldCheck },

  // AI
  { name: "AI Coach — rejection mode", surface: "ai", status: "live", blurb: "Plain-English explanation + numbered fix steps.", icon: Bot },
  { name: "AI Coach — pre-flight mode", surface: "ai", status: "live", blurb: "Review before submit. Catches UFLPA / PGA / HTS issues.", icon: Sparkles },
  { name: "Today's brief generation", surface: "ai", status: "live", blurb: "≤140 char auto-generated summary at top of day.", icon: Sparkles },
  { name: "HTS Classifier (AI)", surface: "ai", status: "live", blurb: "Best match + alternatives + reasoning.", icon: Sparkles },

  // Lifecycle
  { name: "Per-filing timeline", surface: "lifecycle", status: "live", blurb: "Created → Submitted → CBP → Amended → Liquidated.", icon: ListChecks },
  { name: "Score history sparkline", surface: "lifecycle", status: "live", blurb: "Compliance score snapshot at every scoring event.", icon: ListChecks },
  { name: "Translated rejection cards", surface: "lifecycle", status: "live", blurb: "Raw CBP error code rendered in plain English.", icon: Bot },
  { name: "ISF → ABI → Manifest chain", surface: "lifecycle", status: "live", blurb: "Follow one shipment across all three filings.", icon: Layers },
  { name: "PDF export", surface: "lifecycle", status: "live", blurb: "Full lifecycle as a single self-contained PDF.", icon: FileDown },
  { name: "Audit log per filing", surface: "lifecycle", status: "live", blurb: "Who did what, when, with diffs on every edit.", icon: ClipboardList },

  // Automation
  { name: "CBP status polling (5-min)", surface: "automation", status: "live", blurb: "Auto-detects acceptance, rejection, on-hold.", icon: RefreshCw },
  { name: "Federal Register sync (daily)", surface: "automation", status: "live", blurb: "ADD/CVD docket synced 04:00 UTC.", icon: Database },
  { name: "Deadline alerts (hourly)", surface: "automation", status: "live", blurb: "24h / 12h / 4h / 1h pre-deadline notifications.", icon: BellRing },
  { name: "Stale-check sweep (6h)", surface: "automation", status: "live", blurb: "Flags filings stuck for 48h+ without movement.", icon: Clock },
  { name: "Terminal 49 container tracking", surface: "automation", status: "live", blurb: "Live vessel ETAs and port arrival notices.", icon: Ship },
  { name: "Email notifications (opt-in)", surface: "automation", status: "live", blurb: "Per-user, per-kind opt-in. Deep-link to action card.", icon: BellRing },
  { name: "Multi-user accounts", surface: "automation", status: "live", blurb: "Email-verified invites with 6-digit code.", icon: Users },
  { name: "4-role RBAC", surface: "automation", status: "live", blurb: "Owner / Admin / Operator / Viewer.", icon: Users },
  { name: "Audit log export (CSV)", surface: "automation", status: "live", blurb: "Full audit trail exportable for compliance.", icon: FileDown },
  { name: "SSO / SAML", surface: "automation", status: "q4-2026", blurb: "Okta, Azure AD, Google Workspace.", icon: ShieldCheck },
];

const STATUS_TONE: Record<Status, Severity> = {
  live: "emerald",
  "q3-2026": "amber",
  "q4-2026": "amber",
  "2027": "blue",
};

const STATUS_LABEL: Record<Status, string> = {
  live: "Live",
  "q3-2026": "Q3 2026",
  "q4-2026": "Q4 2026",
  "2027": "2027",
};

const FILTERS: { id: "all" | Status; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "q3-2026", label: "Q3 2026" },
  { id: "q4-2026", label: "Q4 2026" },
  { id: "2027", label: "2027" },
];

export function FeaturesClient() {
  const [filter, setFilter] = React.useState<"all" | Status>("all");
  const liveCount = FEATURES.filter((f) => f.status === "live").length;
  const visible = FEATURES.filter((f) => filter === "all" || f.status === filter);

  return (
    <>
      <PageHero
        label="All features"
        title="Every shipped capability, on one page."
        description={`${liveCount} features live in production today, plus what's on the roadmap. Five platform surfaces — Filings, Compliance Center, AI, Lifecycle, Automation — each with its own deep-dive page.`}
        breadcrumbs={[{ label: "All features", href: "/features" }]}
        illustration={<FeaturesHeroIllustration />}
      />

      {/* 5 surfaces */}
      <SectionShell tone="default" eyebrow="Platform surfaces" title="Five places you'll spend your time.">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SURFACES.map(({ id, label, title, blurb, href, count, icon: Icon }, i) => (
            <motion.li
              key={id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
            >
              <Link
                href={href}
                className="group block h-full rounded-2xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="grid size-11 place-items-center rounded-xl bg-gold/15 text-gold-dark dark:text-gold">
                    <Icon size={18} />
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{count} features</span>
                </div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">{label}</h3>
                <h4 className="text-lg font-semibold tracking-tight text-foreground mb-2 leading-tight">{title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{blurb}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/85 group-hover:text-gold-dark dark:group-hover:text-gold">
                  Explore
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </SectionShell>

      {/* Filterable grid */}
      <SectionShell
        tone="muted"
        eyebrow="Every feature"
        title="The full inventory."
        intro="One row per shipped capability. Filter by status to see what's live, what's coming this quarter, and what's on the longer roadmap."
      >
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count = f.id === "all" ? FEATURES.length : FEATURES.filter((x) => x.status === f.id).length;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 rounded-full border border-gold bg-gold/20 px-4 py-1.5 text-xs font-semibold"
                    : "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-gold/10"
                }
              >
                {f.label}
                <span className="font-mono tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map(({ name, surface, status, blurb, icon: Icon }) => {
            const surf = SURFACES.find((s) => s.id === surface)!;
            return (
              <li key={`${surface}-${name}`} className="rounded-xl border border-border/60 bg-card p-4 transition-shadow hover:shadow-card-hover">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-gold/15 text-gold-dark dark:text-gold shrink-0">
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-[13.5px] font-semibold truncate">{name}</h4>
                      <SeverityPill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</SeverityPill>
                    </div>
                    <p className="text-[12px] opacity-75 leading-relaxed mb-2">{blurb}</p>
                    <Link
                      href={surf.href}
                      className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-60 hover:opacity-100"
                    >
                      → {surf.label}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {visible.length === 0 && (
          <p className="text-center text-sm opacity-60 mt-8">No features match this filter.</p>
        )}
      </SectionShell>

      <SectionShell tone="default" headingAlign="center" title="See it for yourself.">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="gold" size="lg" asChild>
            <a href="https://app.mycargolens.com/register">Start free</a>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </SectionShell>
    </>
  );
}
