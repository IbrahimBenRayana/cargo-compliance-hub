"use client";

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import { GOLD } from "@/lib/colors";

/**
 * Features overview hero — "chaos → order" capability constellation.
 * 36 scattered dots converge into 5 clusters (one per platform surface),
 * labels stamp in, rings draw on, then the scene breathes: subtle per-cluster
 * pulse + gold signal dots traveling the connector lines. A "+31 MORE"
 * satellite arrives last. Fully deterministic (SSR-safe), reduced-motion aware.
 */

/** Deterministic pseudo-random in [0, 1) — no Math.random (SSR hydration). */
function ftrRand(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

const FTR_CLUSTERS = [
  { label: "FILINGS", cx: 106, cy: 96, count: 8 },
  { label: "COMPLIANCE", cx: 252, cy: 72, count: 7 },
  { label: "AI", cx: 392, cy: 116, count: 7 },
  { label: "LIFECYCLE", cx: 130, cy: 236, count: 7 },
  { label: "AUTOMATION", cx: 290, cy: 242, count: 7 },
] as const;

const FTR_RING_R = 24;

/** Connector edges between cluster centers (indices into FTR_CLUSTERS). */
const FTR_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 4],
  [4, 3],
  [3, 0],
];

/** Travel loop order for the signal dots. */
const FTR_LOOP = [0, 1, 2, 4, 3] as const;

/** Dot offsets within a cluster: one center dot + a ring of the rest. */
function ftrClusterOffsets(count: number, clusterIndex: number) {
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const ring = count - 1;
  for (let j = 0; j < ring; j++) {
    const a = (j / ring) * Math.PI * 2 + clusterIndex * 0.9;
    pts.push({ x: Math.cos(a) * 13, y: Math.sin(a) * 13 });
  }
  return pts;
}

function FeaturesHeroIllustration() {
  const reduce = useReducedMotion();

  // Flatten clusters into one dot list with final + scattered positions.
  const dots: {
    key: string;
    fx: number;
    fy: number;
    dx: number;
    dy: number;
    delay: number;
    gold: boolean;
  }[] = [];
  let g = 0;
  FTR_CLUSTERS.forEach((c, ci) => {
    ftrClusterOffsets(c.count, ci).forEach((o, j) => {
      const fx = c.cx + o.x;
      const fy = c.cy + o.y;
      const sx = 28 + ftrRand(g * 2 + 1) * 424;
      const sy = 22 + ftrRand(g * 2 + 2) * 276;
      dots.push({
        key: `${c.label}-${j}`,
        fx,
        fy,
        dx: sx - fx,
        dy: sy - fy,
        delay: 0.05 + ftrRand(g + 53) * 0.38,
        gold: j === 0, // one gold anchor dot per cluster
      });
      g += 1;
    });
  });

  // Signal-dot paths: the loop of cluster centers, rotated per dot so the
  // three travelers are spread around the circuit. Times weighted by segment
  // length so speed stays constant.
  const loopPts = FTR_LOOP.map((i) => ({ x: FTR_CLUSTERS[i].cx, y: FTR_CLUSTERS[i].cy }));
  const travelers = [0, 2, 4].map((offset, k) => {
    const rotated = [...loopPts.slice(offset), ...loopPts.slice(0, offset)];
    const path = [...rotated, rotated[0]];
    const segs: number[] = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      segs.push(d);
      total += d;
    }
    const times = [0];
    let acc = 0;
    for (const d of segs) {
      acc += d;
      times.push(acc / total);
    }
    return {
      key: `traveler-${k}`,
      xs: path.map((p) => p.x),
      ys: path.map((p) => p.y),
      times,
      delay: 2.3 + k * 0.5,
    };
  });

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
    >
      <defs>
        <radialGradient id="ftr-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.18" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="160" rx="220" ry="130" fill="url(#ftr-glow)" stroke="none" />

      {/* Connector lines between cluster centers — fade in after settle */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 1.55 }}
      >
        {FTR_EDGES.map(([a, b]) => (
          <line
            key={`edge-${a}-${b}`}
            x1={FTR_CLUSTERS[a].cx}
            y1={FTR_CLUSTERS[a].cy}
            x2={FTR_CLUSTERS[b].cx}
            y2={FTR_CLUSTERS[b].cy}
            strokeOpacity="0.1"
            strokeWidth="1"
          />
        ))}
        {/* faint tether to the satellite */}
        <line x1="392" y1="116" x2="420" y2="256" strokeOpacity="0.07" strokeWidth="1" strokeDasharray="2 4" />
      </motion.g>

      {/* Clusters: converging dots + drawn-on ring + stamped label */}
      {FTR_CLUSTERS.map((c, ci) => (
        <g key={c.label}>
          {/* breathing group — subtle scale pulse, per-cluster offset */}
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
            animate={reduce ? undefined : { scale: [1, 1.03, 1] }}
            transition={{
              duration: 6.5 + ci * 1.1,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2.4 + ci * 0.85,
            }}
          >
            <motion.circle
              cx={c.cx}
              cy={c.cy}
              r={FTR_RING_R}
              strokeOpacity="0.22"
              strokeWidth="1"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: EASE, delay: 1.35 + ci * 0.07 }}
            />
            {dots
              .filter((d) => d.key.startsWith(`${c.label}-`))
              .map((d) => (
                <motion.circle
                  key={d.key}
                  cx={d.fx}
                  cy={d.fy}
                  r={d.gold ? 3 : 2.4}
                  fill={d.gold ? GOLD : "currentColor"}
                  fillOpacity={d.gold ? 0.95 : 0.5}
                  stroke="none"
                  initial={reduce ? false : { x: d.dx, y: d.dy, opacity: 0 }}
                  animate={{ x: 0, y: 0, opacity: 1 }}
                  transition={{
                    x: { duration: 1.05, ease: EASE, delay: d.delay },
                    y: { duration: 1.05, ease: EASE, delay: d.delay },
                    opacity: { duration: 0.45, ease: EASE, delay: d.delay },
                  }}
                />
              ))}
          </motion.g>
          {/* label stamps in after the dots settle */}
          <motion.g
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 1.42 + ci * 0.07 }}
          >
            <text
              x={c.cx}
              y={c.cy + FTR_RING_R + 15}
              textAnchor="middle"
              fontSize="8"
              fontFamily="ui-sans-serif, sans-serif"
              fontWeight="700"
              letterSpacing="0.8"
              fill="currentColor"
              fillOpacity="0.65"
              stroke="none"
            >
              {c.label}
            </text>
          </motion.g>
        </g>
      ))}

      {/* Traveling gold signal dots along the connector circuit */}
      {!reduce &&
        travelers.map((t) => (
          <motion.circle
            key={t.key}
            cx={t.xs[0]}
            cy={t.ys[0]}
            r="2"
            fill={GOLD}
            stroke="none"
            initial={{ opacity: 0 }}
            animate={{ cx: t.xs, cy: t.ys, opacity: 0.9 }}
            transition={{
              cx: { duration: 16, times: t.times, repeat: Infinity, ease: "linear", delay: t.delay },
              cy: { duration: 16, times: t.times, repeat: Infinity, ease: "linear", delay: t.delay },
              opacity: { duration: 0.7, ease: EASE, delay: t.delay },
            }}
          />
        ))}

      {/* "+31 MORE" satellite — arrives last */}
      <motion.g
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 1.8 }}
      >
        <circle cx="420" cy="256" r="16" stroke={GOLD} strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 4" fill={`${GOLD}10`} />
        <circle cx="416" cy="252" r="1.8" fill={GOLD} fillOpacity="0.8" stroke="none" />
        <circle cx="425" cy="255" r="1.8" fill="currentColor" fillOpacity="0.5" stroke="none" />
        <circle cx="418" cy="261" r="1.8" fill="currentColor" fillOpacity="0.5" stroke="none" />
        <text
          x="420"
          y="286"
          textAnchor="middle"
          fontSize="8"
          fontFamily="ui-sans-serif, sans-serif"
          fontWeight="700"
          letterSpacing="0.8"
          fill="currentColor"
          fillOpacity="0.65"
          stroke="none"
        >
          +31 MORE
        </text>
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
  { name: "ABI 7501 Entry Summary", surface: "filings", status: "live", blurb: "Prefilled from accepted ISF. The bond carries over.", icon: ClipboardList },
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
  { name: "5106 EIN self-check", surface: "compliance", status: "live", blurb: "EIN format check + Form 5106 quick link before CBP rejects your filing.", icon: ShieldCheck },
  { name: "HTS Classifier", surface: "compliance", status: "live", blurb: "AI-suggested 10-digit HTS from goods description.", icon: Sparkles },
  { name: "ADD/CVD daily sync", surface: "compliance", status: "live", blurb: "Federal Register synced daily at 04:00 UTC.", icon: Database },
  { name: "FTA Preference Calculator", surface: "compliance", status: "live", blurb: "USMCA, GSP, AGOA, CBI + 13 more programs.", icon: ShieldCheck },
  { name: "Liquidation Pipeline", surface: "compliance", status: "live", blurb: "314-day window per accepted entry, PSC at 270.", icon: Clock },
  { name: "PSC window tracking", surface: "compliance", status: "live", blurb: "Urgent entries (≤14d) rise to the top.", icon: Clock },
  { name: "Snooze cards (24h)", surface: "compliance", status: "live", blurb: "Not yours yet? Snooze and revisit tomorrow.", icon: Clock },
  { name: "Bulk-fix opportunities", surface: "compliance", status: "live", blurb: "When 3+ filings share a root cause, fix all at once.", icon: Layers },
  { name: "CBP exam tracking", surface: "compliance", status: "q4-2026", blurb: "Exam intent notices + status from CBP.", icon: ShieldCheck },

  // AI
  { name: "AI Coach: rejection mode", surface: "ai", status: "live", blurb: "Plain-English explanation + numbered fix steps.", icon: Bot },
  { name: "AI Coach: pre-flight mode", surface: "ai", status: "live", blurb: "Review before submit. Catches UFLPA / PGA / HTS issues.", icon: Sparkles },
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
        description={`${liveCount} features live in production today, plus what's on the roadmap. Five platform surfaces, each with its own deep-dive page: Filings, Compliance Center, AI, Lifecycle, and Automation.`}
        breadcrumbs={[{ label: "All features", href: "/features" }]}
        illustration={<FeaturesHeroIllustration />}
      />

      {/* 5 surfaces — asymmetric bento: two featured, three compact */}
      <SectionShell tone="default" title="Five places you'll spend your time.">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-6">
          {SURFACES.map((surf, i) => {
            const featured = i < 2;
            return (
              <motion.div
                key={surf.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                className={featured ? "lg:col-span-3" : "lg:col-span-2"}
              >
                <SurfaceCard surf={surf} featured={featured} />
              </motion.div>
            );
          })}
        </div>
      </SectionShell>

      {/* Full inventory — grouped by surface, filterable by status */}
      <SectionShell
        tone="default"
        className="bg-muted/30"
        title="The full inventory."
        intro="Every shipped capability, grouped by surface. Filter by status to see what's live, what's coming this quarter, and what's on the longer roadmap."
      >
        <div className="mb-10 flex flex-wrap gap-2">
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
                    ? "inline-flex items-center gap-1.5 rounded-full border border-gold bg-gold/20 px-4 py-1.5 text-xs font-semibold text-foreground"
                    : "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-gold/10 hover:text-foreground"
                }
              >
                {f.label}
                <span className="font-mono tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-14">
          {SURFACES.map((surf) => {
            const items = visible.filter((f) => f.surface === surf.id);
            if (items.length === 0) return null;
            const Icon = surf.icon;
            return (
              <section key={surf.id} aria-labelledby={`inventory-${surf.id}`}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className="text-gold-dark dark:text-gold" />
                    <h3
                      id={`inventory-${surf.id}`}
                      className="text-base font-semibold tracking-tight text-foreground"
                    >
                      {surf.label}
                    </h3>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <Link
                    href={surf.href}
                    className="group inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Deep dive
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
                <ul className="grid grid-cols-1 gap-x-12 gap-y-1 md:grid-cols-2">
                  {items.map(({ name, status, blurb }) => (
                    <li
                      key={`${surf.id}-${name}`}
                      className="-mx-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-card"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                          {name}
                        </h4>
                        <SeverityPill tone={STATUS_TONE[status]}>
                          {STATUS_LABEL[status]}
                        </SeverityPill>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                        {blurb}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {visible.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No features match this filter.
          </p>
        )}
      </SectionShell>

      <SectionShell tone="default" headingAlign="center" title="See it for yourself.">
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

function SurfaceCard({ surf, featured }: { surf: Surface; featured: boolean }) {
  const Icon = surf.icon;
  return (
    <Link
      href={surf.href}
      className={
        featured
          ? "group flex h-full flex-col rounded-2xl border border-gold/25 bg-gold/[0.05] p-7 transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-card-hover"
          : "group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-card-hover"
      }
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className={
            featured
              ? "grid size-11 place-items-center rounded-xl bg-gold/20 text-gold-dark dark:text-gold"
              : "grid size-9 place-items-center rounded-lg bg-gold/15 text-gold-dark dark:text-gold"
          }
        >
          <Icon size={featured ? 18 : 15} />
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {surf.count} features
        </span>
      </div>
      <h3
        className={
          featured
            ? "mb-2 text-xl font-semibold leading-tight tracking-tight text-foreground"
            : "mb-2 text-[15px] font-semibold leading-tight tracking-tight text-foreground"
        }
      >
        {surf.title}
      </h3>
      <p
        className={
          featured
            ? "mb-5 text-sm leading-relaxed text-muted-foreground"
            : "mb-5 text-[12.5px] leading-relaxed text-muted-foreground"
        }
      >
        {surf.blurb}
      </p>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/85 transition-colors group-hover:text-gold-dark dark:group-hover:text-gold">
        {surf.label}
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
