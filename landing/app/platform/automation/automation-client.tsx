"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTime,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { BellRing, Clock, Database, Mail, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { IconTile, type IconTileHover } from "@/components/ui/icon-tile";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";

const EASE = [0.22, 1, 0.36, 1] as const;
import { GOLD, EMERALD } from "@/lib/colors";

type ClockSpec = {
  cx: number;
  cy: number;
  label: string;
  sub: string;
  /** Seconds for one full revolution at idle (no scrolling). */
  rotationDur: number;
  delay: number;
};

const CLOCKS: ClockSpec[] = [
  { cx: 100, cy: 110, label: "5 min", sub: "CBP poll", rotationDur: 4, delay: 0 },
  { cx: 240, cy: 110, label: "1 h", sub: "Deadlines", rotationDur: 8, delay: 0.3 },
  { cx: 380, cy: 110, label: "6 h", sub: "Stale check", rotationDur: 14, delay: 0.6 },
  // Bottom clock was at cy=270, putting its sub-label at y=342 — only
  // 4px above the y=346 heartbeat strip, so the two texts collided.
  // Lifting to cy=244 leaves the labels at y=302/316, ~30px of breathing
  // room above the strip. Connector line below was shortened to match.
  { cx: 240, cy: 244, label: "04:00 UTC", sub: "Fed Register", rotationDur: 22, delay: 0.9 },
];

/**
 * Animated hero, four clock faces, one per background schedule.
 *
 * Each hand has TWO drivers combined:
 *   1. An idle continuous rotation. Speed comes from `rotationDur` (the
 *      faster the cadence, the faster the hand). Drives the "system is
 *      alive" feel when the user isn't interacting.
 *   2. A scroll-linked boost. As the user scrolls past the section, the
 *      hands sweep proportionally to scroll progress. The 5-min clock
 *      gets a bigger boost than the daily-sync clock so the
 *      faster-cadence pieces visibly outrun the slower ones, matching
 *      the system metaphor.
 *
 * Replaces the previous SMIL `<animateTransform>` which did not respect
 * `prefers-reduced-motion: reduce`. The framer-motion path now collapses
 * to a static dial via `useReducedMotion()`.
 */
function AutomationHeroIllustration() {
  // useScroll's `target` accepts an HTMLElement ref. SVG refs are not
  // compatible (different element type), so we wrap the svg in a div
  // and put the ref there.
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "end start"],
  });

  return (
    <div ref={wrapperRef} className="w-full max-w-md">
    <motion.svg
      viewBox="0 0 480 360"
      className="w-full h-auto text-foreground/90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
    >
      <defs>
        <radialGradient id="auto-glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="180" rx="200" ry="130" fill="url(#auto-glow)" stroke="none" />

      {/* === Soft connecting lines between clocks ====================== */}
      <motion.g
        strokeOpacity="0.18"
        strokeDasharray="3 5"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.8, delay: 0.4 } },
        }}
      >
        <line x1="138" y1="110" x2="202" y2="110" />
        <line x1="278" y1="110" x2="342" y2="110" />
        <line x1="240" y1="148" x2="240" y2="206" />
      </motion.g>

      {/* === Four clocks ============================================= */}
      {CLOCKS.map((c) => (
        <ClockGroup key={c.label} c={c} scrollProgress={scrollYProgress} />
      ))}

      {/* === Heartbeat strip at the bottom ============================ */}
      <motion.g
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.6, delay: 1.2 } },
        }}
      >
        <text
          x="40"
          y="346"
          fontSize="9"
          fontFamily="ui-sans-serif, sans-serif"
          fontWeight="700"
          letterSpacing="1"
          fill="currentColor"
          fillOpacity="0.55"
          stroke="none"
        >
          LIVE
        </text>
        <motion.circle
          cx="72"
          cy="343"
          r="3"
          fill={EMERALD}
          stroke="none"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <text
          x="86"
          y="346"
          fontSize="8.5"
          fontFamily="ui-monospace, monospace"
          fontWeight="600"
          fill="currentColor"
          fillOpacity="0.55"
          stroke="none"
        >
          all schedules running · last sweep 14s ago
        </text>
      </motion.g>
    </motion.svg>
    </div>
  );
}

/**
 * One clock face. The hand's rotation comes from useTime (continuous
 * idle sweep) summed with a scroll-derived boost so faster-cadence
 * clocks visibly outrun slower ones when the user scrolls past.
 *
 * Hand pivot: we use the SVG-native `transform` attribute on a wrapper
 * `<g>` — `translate(cx cy) rotate(θ)` — so the pivot lands on the dial
 * centre regardless of how the parent SVG is scaled by its container.
 * CSS `transformOrigin` in pixel units breaks under viewBox scaling
 * (the origin lands off-center when the SVG is rendered at any width
 * other than the viewBox width), which is what the previous
 * implementation was hitting — hands rotated around a phantom point
 * off to the side and read as random arrows instead of clock hands.
 */
function ClockGroup({
  c,
  scrollProgress,
}: {
  c: ClockSpec;
  scrollProgress: MotionValue<number>;
}) {
  const reduce = useReducedMotion();
  const time = useTime();
  // Idle continuous rotation. degPerMs * elapsed ms = degrees.
  const degPerMs = 360 / (c.rotationDur * 1000);
  // Scroll-linked boost. Faster cadence = bigger boost. Multiplier is
  // capped so the slowest clock still moves a noticeable amount.
  const scrollMult = Math.max(0.4, 8 / c.rotationDur);
  const scrollDeg = useTransform(scrollProgress, [0, 1], [0, 360 * scrollMult]);

  const rotation = useTransform([time, scrollDeg], (latest) => {
    if (reduce) return 0;
    const [t, s] = latest as [number, number];
    return t * degPerMs + s;
  });

  // Drive the SVG `transform` attribute imperatively on a plain <g>.
  // framer-motion's motion.g doesn't route the `transform` prop to the
  // native SVG attribute reliably (it composes into CSS transform, which
  // in turn needs transformBox + transform-origin gymnastics under
  // viewBox scaling). Setting the attribute directly on every frame
  // sidesteps all of that — the pivot is exactly (cx, cy) at any render
  // size.
  const handRef = React.useRef<SVGGElement | null>(null);
  useMotionValueEvent(rotation, "change", (deg) => {
    handRef.current?.setAttribute(
      "transform",
      `translate(${c.cx} ${c.cy}) rotate(${deg})`,
    );
  });

  return (
    <motion.g
      variants={{
        hidden: { opacity: 0, scale: 0.7 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: { duration: 0.55, ease: EASE, delay: c.delay },
        },
      }}
    >
      {/* Pulsing halo */}
      <motion.circle
        cx={c.cx}
        cy={c.cy}
        r="42"
        stroke={GOLD}
        strokeOpacity="0.25"
        strokeWidth="1.2"
        fill="none"
        animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 3 + c.delay, repeat: Infinity, ease: "easeInOut", delay: 1 + c.delay }}
        style={{ transformOrigin: `${c.cx}px ${c.cy}px` }}
      />
      {/* Outer clock face */}
      <circle
        cx={c.cx}
        cy={c.cy}
        r="38"
        fill="currentColor"
        fillOpacity="0.03"
        strokeOpacity="0.7"
      />
      {/* Inner ring */}
      <circle
        cx={c.cx}
        cy={c.cy}
        r="32"
        stroke="currentColor"
        strokeOpacity="0.15"
        fill="none"
      />
      {/* 12 / 3 / 6 / 9 tick marks */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg - 90) * (Math.PI / 180);
        const x1 = c.cx + Math.cos(rad) * 32;
        const y1 = c.cy + Math.sin(rad) * 32;
        const x2 = c.cx + Math.cos(rad) * 26;
        const y2 = c.cy + Math.sin(rad) * 26;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} strokeOpacity="0.6" />;
      })}
      {/* Rotating hand. The wrapper <g> gets its `transform` attribute
          updated per-frame from `rotation` (see useMotionValueEvent
          above). Initial attribute puts the hand at 12 o'clock so SSR
          + first paint aren't off by a full frame. */}
      <g
        ref={handRef}
        transform={`translate(${c.cx} ${c.cy}) rotate(0)`}
      >
        <line x1={0} y1={0} x2={0} y2={-22} stroke={GOLD} strokeWidth="2.5" />
      </g>
      {/* Center hub */}
      <circle cx={c.cx} cy={c.cy} r="3.5" fill={GOLD} stroke="none" />
      {/* Cadence label */}
      <text
        x={c.cx}
        y={c.cy + 58}
        textAnchor="middle"
        fontSize="11"
        fontFamily="ui-monospace, monospace"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        {c.label}
      </text>
      {/* Sub-label */}
      <text
        x={c.cx}
        y={c.cy + 72}
        textAnchor="middle"
        fontSize="8.5"
        fontFamily="ui-sans-serif, sans-serif"
        fontWeight="600"
        fill="currentColor"
        fillOpacity="0.55"
        stroke="none"
      >
        {c.sub}
      </text>
    </motion.g>
  );
}

const SCHEDULES: Array<{
  icon: typeof RefreshCw;
  hover: IconTileHover;
  cadence: string;
  title: string;
  body: string;
  trigger: string;
}> = [
  {
    icon: RefreshCw,
    // Spin is semantically perfect for a refresh/poll icon.
    hover: "spin",
    cadence: "Every 5 minutes",
    title: "CBP status polling",
    body: "We poll the CustomsCity ABI gateway for every in-flight filing. New acceptances, rejections, and on-hold notices land in your action queue within minutes.",
    trigger: "Triggers: acceptance card · rejection card with AI Coach link · on-hold notification",
  },
  {
    icon: Database,
    hover: "lift",
    cadence: "Daily at 04:00 UTC",
    title: "Federal Register sync",
    body: "The full Antidumping & Countervailing Duty docket from the Federal Register, parsed and indexed by HTS, country, and case number. Every morning before the East Coast workday.",
    trigger: "Triggers: ADD/CVD lookup updates · UFLPA watch list refresh",
  },
  {
    icon: BellRing,
    // Wiggle matches a bell being struck — the "alert" gesture.
    hover: "wiggle",
    cadence: "Every hour",
    title: "Deadline alerts",
    body: "Sweeps every open filing for impending deadlines: ISF cutoffs, PSC windows, liquidation dates, AD/CVD reviews. Items inside 24h get pushed to the top of your queue.",
    trigger: "Triggers: action queue reorder · email per opted-in user · bell badge",
  },
  {
    icon: Clock,
    hover: "lift",
    cadence: "Every 6 hours",
    title: "Stale-check sweep",
    body: "Filings that haven't moved in 48h get a stale-flag. We check that CBP didn't lose a response, that the importer hasn't gone silent, and that the bond is still active.",
    trigger: "Triggers: stale-flag card · audit-trail entry",
  },
];

const NOTIF_KINDS = [
  { kind: "filing.rejected", channels: "in-app · email", body: "AI Coach card pre-loaded with the rejection explanation." },
  { kind: "filing.accepted", channels: "in-app", body: "Quiet confirmation. No email noise for good news." },
  { kind: "filing.on_hold", channels: "in-app · email", body: "Includes the CBP detail code and the suggested next step." },
  { kind: "deadline.warning", channels: "in-app · email", body: "Fires at 72h, 48h, and 24h before the deadline, plus an overdue alert once it lapses." },
  { kind: "entry.psc_closing", channels: "in-app · email", body: "Once the PSC window enters its final 14 days." },
  { kind: "billing.event", channels: "email", body: "Plan-limit warnings and invoice events from Stripe." },
];

const ROLES: { name: string; tone: Severity; can: string[] }[] = [
  { name: "Owner", tone: "amber", can: ["Everything Admin can do", "Billing", "Delete the team", "Manage org-level integrations"] },
  { name: "Admin", tone: "neutral", can: ["Invite + manage users", "Configure templates", "Toggle AI features", "View audit log"] },
  { name: "Operator", tone: "neutral", can: ["Create, edit, submit filings", "Use AI Coach + pre-flight", "Reply to CBP rejections"] },
  { name: "Viewer", tone: "blue", can: ["Read-only access", "Export PDFs", "Subscribe to notifications", "View score history"] },
];

export function AutomationClient() {
  return (
    <>
      <PageHero
        label="Platform"
        title="Background work, happening 24/7."
        description="Polling, syncs, alerts, sweeps: the plumbing that keeps your queue honest. Plus the notifications, roles, and audit trail your team needs to share the workload."
        breadcrumbs={[
          { label: "Platform", href: "/features" },
          { label: "Automation", href: "/platform/automation" },
        ]}
        illustration={<AutomationHeroIllustration />}
      />

      {/* 4 schedules */}
      <SectionShell tone="default" eyebrow="The schedules" title="Four jobs running on your behalf.">
        <ul className="grid gap-5 md:grid-cols-2">
          {SCHEDULES.map(({ icon: Icon, hover, cadence, title, body, trigger }, idx) => (
            <li
              key={title}
              className="group rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-gold/40"
            >
              <div className="flex items-start gap-4 mb-3">
                <IconTile icon={Icon} hover={hover} reveal revealDelay={idx * 0.06} />
                <div>
                  <div className="text-[11px] font-mono tabular-nums uppercase tracking-[0.14em] text-muted-foreground">{cadence}</div>
                  <h3 className="text-base font-semibold text-foreground mt-0.5">{title}</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{body}</p>
              <p className="text-[11px] font-mono text-muted-foreground/80">{trigger}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* Notifications */}
      <SectionShell
        tone="default"
        title="In-app bell. Email when it matters."
        intro="Every notification kind is opt-in per user. Deep-links from email land you on the right action card with an amber halo pulse so you can spot it instantly."
      >
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground border-b border-border/60 bg-card/60">
            <div className="md:col-span-4">Kind</div>
            <div className="md:col-span-2">Channels</div>
            <div className="md:col-span-6">What it says</div>
          </div>
          <ul>
            {NOTIF_KINDS.map((n) => (
              <li key={n.kind} className="grid md:grid-cols-12 gap-4 px-5 py-3 border-b border-border/40 last:border-b-0">
                <div className="md:col-span-4">
                  <span className="font-mono tabular-nums text-[12px] text-foreground">{n.kind}</span>
                </div>
                <div className="md:col-span-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {n.channels.split(" · ").map((c) => (
                    <span key={c} className="inline-flex items-center gap-1">
                      {c === "email" ? <Mail size={11} /> : <BellRing size={11} />}
                      {c}
                    </span>
                  ))}
                </div>
                <div className="md:col-span-6 text-[12px] text-muted-foreground">{n.body}</div>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      {/* Roles */}
      <SectionShell
        id="team"
        tone="default"
        title="Four roles. Same data, different permissions."
        intro="Email-verified invites with a 6-digit code. Suspend access in one click. Every action logged."
      >
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <li key={r.name} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-muted-foreground" />
                <SeverityPill tone={r.tone}>{r.name}</SeverityPill>
              </div>
              <ul className="space-y-1.5 text-[12.5px] text-muted-foreground">
                {r.can.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <ShieldCheck size={12} className="mt-1 text-gold-dark dark:text-gold shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </SectionShell>

      <SectionShell tone="muted" headingAlign="center" title="Let MyCargoLens handle the plumbing.">
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
