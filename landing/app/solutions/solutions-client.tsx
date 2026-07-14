"use client";

import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import * as React from "react";
import {
  ArrowRight,
  Bot,
  ClipboardList,
  Layers,
  ShieldCheck,
  Ship,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { SeverityPill } from "@/components/ui/severity-pill";
import { GOLD, ROSE, EMERALD } from "@/lib/colors";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

type Persona = {
  id: string;
  badge: string;
  title: string;
  pullquote: string;
  pain: string;
  body: string;
  whatYouUse: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    href: string;
  }[];
};

const PERSONAS: Persona[] = [
  {
    id: "ops",
    badge: "Ops manager",
    title: "You walk in Monday morning and need to know what's broken.",
    pullquote:
      "I have 47 open filings. I don't need a dashboard. I need to know which 3 need me right now.",
    pain: "Email piles up. ABI rejects half a week later. PSC clocks tick in spreadsheets. Compliance scores live in Excel — if they live anywhere.",
    body: "MyCargoLens replaces the spreadsheet + email + ABI terminal stack with one inbox. Cards rank themselves by urgency. AI Coach explains every rejection so you don't have to decode CBP error codes.",
    whatYouUse: [
      { icon: ClipboardList, label: "Action queue", href: "/platform/compliance#overview" },
      { icon: Bot, label: "AI Coach", href: "/platform/ai" },
      { icon: ShieldCheck, label: "Risk & Watch", href: "/platform/compliance#risk" },
    ],
  },
  {
    id: "brokerage",
    badge: "Customs brokerage",
    title: "You file for 30 importers and you can't lose a thread.",
    pullquote:
      "I need every operator on the team to see the same picture and never duplicate work.",
    pain: "Filings live in someone's head. Onboarding takes a week. Audit trail is whoever was on the email. PSC windows close while you're filing the next thing.",
    body: "Multi-tenant from day one. Four roles (owner / admin / operator / viewer) with email-verified invites. Templates so the 30 importers' party data stops being retyped. Bulk submit for the daily batch. Every action logged.",
    whatYouUse: [
      { icon: Users, label: "Roles & team", href: "/platform/automation#team" },
      { icon: Layers, label: "Templates · bulk submit", href: "/platform/filings" },
      { icon: ClipboardList, label: "Records & audit trail", href: "/platform/compliance#records" },
    ],
  },
  {
    id: "forwarder",
    badge: "Freight forwarder",
    title: "You move the box. Customs is downstream — but it's on your invoice.",
    pullquote:
      "Half my customer calls are 'is my shipment cleared yet?' I need that answer in two clicks, with the manifest open.",
    pain: "ABI status checks via the gateway. Manifest queries by phone. Liquidation tracking nowhere. Customers asking for PDFs you don't have.",
    body: "MBOL-driven manifest queries, ISF → ABI → manifest chain in one view, and a PDF export at every stage of the lifecycle. Liquidation pipeline tracks the 314-day window for every accepted entry so you can close out your client's case.",
    whatYouUse: [
      { icon: Ship, label: "Manifest queries", href: "/platform/filings" },
      { icon: ClipboardList, label: "Lifecycle visibility", href: "/platform/lifecycle" },
      { icon: ShieldCheck, label: "Liquidation pipeline", href: "/platform/compliance#records" },
    ],
  },
];

function PersonaCard({ persona, index }: { persona: Persona; index: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.65, ease: EASE_OUT_QUART, delay: index * 0.08 }}
      className="grid gap-8 lg:grid-cols-12 lg:gap-12"
    >
      <div className="lg:col-span-5">
        <SeverityPill tone="amber" className="mb-4">
          {persona.badge}
        </SeverityPill>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight mb-5">
          {persona.title}
        </h2>
        {/* Pull-quote uses a clean full border + an italic body, with
            the persona role re-stated as figcaption so the quote is
            grounded instead of disembodied. Earlier revision used a
            thick gold left-rail accent (impeccable side-tab tell). */}
        <figure className="rounded-xl border border-border/60 bg-card/40 px-5 py-4 my-5">
          <blockquote className="text-sm italic text-foreground leading-relaxed">
            "{persona.pullquote}"
          </blockquote>
          <figcaption className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {persona.badge}
          </figcaption>
        </figure>
        <p className="text-[13px] text-muted-foreground mb-2 font-semibold uppercase tracking-[0.14em]">
          Before MyCargoLens
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">{persona.pain}</p>
      </div>

      <div className="lg:col-span-7 space-y-5">
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="text-base font-semibold text-foreground mb-3">What MyCargoLens does for you</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{persona.body}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
            What you'll actually use
          </h3>
          <ul className="space-y-2.5">
            {persona.whatYouUse.map(({ icon: Icon, label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:bg-gold/5"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-gold/15 text-gold-dark dark:text-gold">
                    <Icon size={14} />
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-foreground">{label}</span>
                  <ArrowRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-gold-dark dark:group-hover:text-gold" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   Hero illustration — "Three lenses, one core".
   A central Focus Frame (the brand motif: four corner brackets + a gold
   square) feeds three persona panels. After the entrance, a gold signal
   dot cycles forever: core → panel, the panel brightens and its lead row
   advances to an "updated" state, then the signal moves to the next
   persona. Calm by construction: transform/opacity/cx-cy only, no
   bounce, and reduced-motion renders the finished, equally-lit scene.
   ========================================================================= */

const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;
const EASE_IN_OUT_CUBIC = [0.65, 0, 0.35, 1] as const;
const AMBER = "hsl(38 92% 50%)";

/** Focus Frame corner brackets — a 44x44 square centred on (240, 172). */
const HERO_BRACKETS = [
  "M 218 162 L 218 150 L 230 150",
  "M 250 150 L 262 150 L 262 162",
  "M 262 182 L 262 194 L 250 194",
  "M 230 194 L 218 194 L 218 182",
];

/** Straight connectors, core edge → panel edge. Index matches HERO_PANELS. */
const HERO_CONNECTORS = [
  { x1: 215, y1: 163, x2: 152, y2: 127 },
  { x1: 265, y1: 163, x2: 328, y2: 127 },
  { x1: 240, y1: 198, x2: 240, y2: 238 },
];

type HeroRow = { dot: string; text: string };

const HERO_PANELS: {
  x: number;
  y: number;
  label: string;
  /** Lead row crossfades base → done while the panel is active. */
  lead: { base: HeroRow; done: HeroRow };
  rows: HeroRow[];
}[] = [
  {
    x: 18,
    y: 70,
    label: "OPS MANAGER",
    lead: {
      base: { dot: ROSE, text: "INV-4421 · rejected" },
      done: { dot: EMERALD, text: "INV-4421 · resolved" },
    },
    rows: [
      { dot: AMBER, text: "ISF · due 4h" },
      { dot: EMERALD, text: "3 ready to file" },
    ],
  },
  {
    x: 330,
    y: 70,
    label: "BROKERAGE",
    lead: {
      base: { dot: EMERALD, text: "12 imp. · 47 open" },
      done: { dot: GOLD, text: "12 imp. · 44 open" },
    },
    rows: [
      { dot: EMERALD, text: "Templates · 8" },
      { dot: GOLD, text: "Audit · live" },
    ],
  },
  {
    x: 174,
    y: 240,
    label: "FORWARDER",
    lead: {
      base: { dot: GOLD, text: "ABI · pending" },
      done: { dot: EMERALD, text: "ABI · accepted" },
    },
    rows: [
      { dot: GOLD, text: "MAEU9381-2" },
      { dot: EMERALD, text: "Liq · 53d" },
    ],
  },
];

const SIGNAL_TRAVEL_MS = 1000;
const SIGNAL_ACTIVE_MS = 1500;
const SIGNAL_REST_MS = 500;

function SolutionsHeroIllustration() {
  const reduced = useReducedMotion();

  // Signal loop state machine: travel (dot flies core → panel) →
  // active (panel holds bright, lead row advances) → rest (beat at the
  // core) → travel to the next panel. 3 × 3s = one ~9s full cycle.
  const [started, setStarted] = React.useState(false);
  const [phase, setPhase] = React.useState<{
    target: number;
    mode: "travel" | "active" | "rest";
  }>({ target: 0, mode: "travel" });

  // Hold the loop until the entrance choreography has finished.
  React.useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setStarted(true), 2400);
    return () => clearTimeout(t);
  }, [reduced]);

  React.useEffect(() => {
    if (reduced || !started) return;
    const hold =
      phase.mode === "travel"
        ? SIGNAL_TRAVEL_MS
        : phase.mode === "active"
          ? SIGNAL_ACTIVE_MS
          : SIGNAL_REST_MS;
    const t = setTimeout(() => {
      setPhase((p) =>
        p.mode === "travel"
          ? { target: p.target, mode: "active" }
          : p.mode === "active"
            ? { target: p.target, mode: "rest" }
            : { target: (p.target + 1) % HERO_PANELS.length, mode: "travel" },
      );
    }, hold);
    return () => clearTimeout(t);
  }, [phase, started, reduced]);

  const travel =
    !reduced && started && phase.mode === "travel"
      ? HERO_CONNECTORS[phase.target]
      : null;

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
    >
      <defs>
        <radialGradient id="sol-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.14" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sol-particle" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.9" />
          <stop offset="60%" stopColor={GOLD} stopOpacity="0.5" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="240" cy="180" rx="190" ry="130" fill="url(#sol-glow)" stroke="none" />

      {/* === Connectors — draw outward from the core ================== */}
      {HERO_CONNECTORS.map((c, i) => (
        <motion.line
          key={i}
          x1={c.x1}
          y1={c.y1}
          x2={c.x2}
          y2={c.y2}
          stroke="currentColor"
          strokeOpacity="0.28"
          initial={reduced ? false : { pathLength: 0, opacity: 0 }}
          animate={reduced ? undefined : { pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: { duration: 0.5, delay: 0.75 + i * 0.15, ease: EASE_OUT_QUINT },
            opacity: { duration: 0.25, delay: 0.75 + i * 0.15 },
          }}
        />
      ))}

      {/* === Travelling signal dot ==================================== */}
      {travel && (
        <g key={`signal-${phase.target}`}>
          <motion.circle
            r="6"
            fill="url(#sol-particle)"
            stroke="none"
            initial={{ cx: travel.x1, cy: travel.y1, opacity: 0 }}
            animate={{ cx: travel.x2, cy: travel.y2, opacity: 1 }}
            transition={{
              cx: { duration: 1, ease: EASE_IN_OUT_CUBIC },
              cy: { duration: 1, ease: EASE_IN_OUT_CUBIC },
              opacity: { duration: 0.25 },
            }}
          />
          <motion.circle
            r="2.2"
            fill={GOLD}
            stroke="none"
            initial={{ cx: travel.x1, cy: travel.y1, opacity: 0 }}
            animate={{ cx: travel.x2, cy: travel.y2, opacity: 1 }}
            transition={{
              cx: { duration: 1, ease: EASE_IN_OUT_CUBIC },
              cy: { duration: 1, ease: EASE_IN_OUT_CUBIC },
              opacity: { duration: 0.25 },
            }}
          />
        </g>
      )}

      {/* === Persona panels =========================================== */}
      {HERO_PANELS.map((p, idx) => {
        const isActive =
          !reduced && started && phase.target === idx && phase.mode === "active";
        const borderOpacity = reduced ? 0.75 : isActive ? 0.9 : 0.4;
        return (
          <motion.g
            key={p.label}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_QUINT, delay: 1.15 + idx * 0.18 }}
          >
            {/* Idle float — panels only; the core stays anchored. */}
            <motion.g
              animate={reduced ? undefined : { y: [0, -2, 0, 2, 0] }}
              transition={
                reduced
                  ? undefined
                  : {
                      duration: 6.5 + idx,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 2 + idx * 0.9,
                    }
              }
            >
              {/* One-shot halo when the signal arrives */}
              {isActive && (
                <motion.rect
                  x={p.x - 6}
                  y={p.y - 6}
                  width={144}
                  height={122}
                  rx={14}
                  fill={GOLD}
                  stroke="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.14, 0] }}
                  transition={{ duration: 1.4, ease: EASE_OUT_QUART }}
                />
              )}

              {/* Panel card — border brightens while active */}
              <motion.rect
                x={p.x}
                y={p.y}
                width={132}
                height={110}
                rx={10}
                fill="currentColor"
                fillOpacity="0.04"
                stroke="currentColor"
                initial={false}
                animate={{ strokeOpacity: borderOpacity }}
                transition={{ duration: 0.45, ease: EASE_OUT_QUART }}
              />

              {/* Header */}
              <text
                x={p.x + 12}
                y={p.y + 20}
                fontSize="8"
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight="600"
                letterSpacing="1"
                fill="currentColor"
                fillOpacity="0.7"
                stroke="none"
              >
                {p.label}
              </text>
              <line
                x1={p.x + 12}
                y1={p.y + 28}
                x2={p.x + 120}
                y2={p.y + 28}
                strokeOpacity="0.3"
                strokeWidth="1"
              />

              {/* Lead row — crossfades to its updated variant when active */}
              <motion.circle
                cx={p.x + 18}
                cy={p.y + 46}
                r="2.5"
                fill={p.lead.base.dot}
                stroke="none"
                initial={false}
                animate={{ opacity: isActive ? 0 : 1 }}
                transition={{ duration: 0.35 }}
              />
              <motion.circle
                cx={p.x + 18}
                cy={p.y + 46}
                r="2.5"
                fill={p.lead.done.dot}
                stroke="none"
                initial={false}
                animate={{ opacity: isActive ? 1 : 0 }}
                transition={{ duration: 0.35 }}
              />
              {isActive && (
                <motion.circle
                  cx={p.x + 18}
                  cy={p.y + 46}
                  r="6"
                  fill={p.lead.done.dot}
                  stroke="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.4, 0] }}
                  transition={{ duration: 0.9, ease: EASE_OUT_QUART }}
                />
              )}
              <motion.text
                x={p.x + 26}
                y={p.y + 49}
                fontSize="7.5"
                fontFamily="ui-monospace, monospace"
                fill="currentColor"
                fillOpacity="0.75"
                stroke="none"
                initial={false}
                animate={{ opacity: isActive ? 0 : 1 }}
                transition={{ duration: 0.35 }}
              >
                {p.lead.base.text}
              </motion.text>
              <motion.text
                x={p.x + 26}
                y={p.y + 49}
                fontSize="7.5"
                fontFamily="ui-monospace, monospace"
                fill="currentColor"
                fillOpacity="0.75"
                stroke="none"
                initial={false}
                animate={{ opacity: isActive ? 1 : 0 }}
                transition={{ duration: 0.35 }}
              >
                {p.lead.done.text}
              </motion.text>

              {/* Static rows */}
              {p.rows.map((row, i) => (
                <g key={i}>
                  <circle
                    cx={p.x + 18}
                    cy={p.y + 64 + i * 18}
                    r="2.5"
                    fill={row.dot}
                    stroke="none"
                  />
                  <text
                    x={p.x + 26}
                    y={p.y + 67 + i * 18}
                    fontSize="7.5"
                    fontFamily="ui-monospace, monospace"
                    fill="currentColor"
                    fillOpacity="0.7"
                    stroke="none"
                  >
                    {row.text}
                  </text>
                </g>
              ))}
            </motion.g>
          </motion.g>
        );
      })}

      {/* === Core — the Focus Frame (anchored, never floats) =========== */}
      <g>
        {HERO_BRACKETS.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke={GOLD}
            strokeWidth="2"
            fill="none"
            initial={reduced ? false : { pathLength: 0, opacity: 0 }}
            animate={reduced ? undefined : { pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { duration: 0.45, delay: i * 0.08, ease: EASE_OUT_QUINT },
              opacity: { duration: 0.2, delay: i * 0.08 },
            }}
          />
        ))}
        {/* Gold centre square scales in from the frame's centre point */}
        <motion.rect
          x={235}
          y={167}
          width={10}
          height={10}
          rx={2}
          fill={GOLD}
          stroke="none"
          initial={
            reduced
              ? false
              : { attrX: 240, attrY: 172, width: 0, height: 0, opacity: 0 }
          }
          animate={
            reduced
              ? undefined
              : { attrX: 235, attrY: 167, width: 10, height: 10, opacity: 1 }
          }
          transition={{ duration: 0.5, delay: 0.4, ease: EASE_OUT_QUINT }}
        />
      </g>
    </motion.svg>
  );
}

export function SolutionsClient() {
  return (
    <>
      <PageHero
        label="Solutions"
        title="One product. Three angles."
        description="Same MyCargoLens. Different jobs, different surfaces. Pick the persona that sounds like you — and we'll show you what you'll actually open every day."
        breadcrumbs={[{ label: "Solutions", href: "/solutions" }]}
        illustration={<SolutionsHeroIllustration />}
      />

      <SectionShell tone="default">
        <div className="space-y-20 md:space-y-28">
          {PERSONAS.map((persona, i) => (
            <PersonaCard key={persona.id} persona={persona} index={i} />
          ))}
        </div>
      </SectionShell>

      <SectionShell tone="muted" headingAlign="center" title="Not sure which one fits?">
        <p className="mx-auto max-w-2xl text-center text-base leading-relaxed mb-8 opacity-80">
          Same product, three angles. Pick the persona that matches your day-to-day —
          the rest is one click away. Book a walkthrough and we&apos;ll set you up for yours.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="gold" size="lg" asChild>
            <Link href="/book-a-demo">Request a demo</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/contact">Talk to founders</Link>
          </Button>
        </div>
      </SectionShell>
    </>
  );
}
