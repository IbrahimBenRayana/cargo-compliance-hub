"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  Inbox,
  Layers,
  MessageSquareWarning,
  Rocket,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
import { GOLD, ROSE, AMBER, EMERALD } from "@/lib/colors";

const EASE = [0.22, 1, 0.36, 1] as const;

const EASE_IN = [0.55, 0, 1, 0.45] as const;

/** The four filings that rotate through the inbox. Ids are stable keys. */
const FILINGS = [
  { id: 0, label: "ISF-10 · INV-4421", dot: ROSE, pill: "URGENT", pillColor: ROSE },
  { id: 1, label: "Entry 7501 · INV-4390", dot: EMERALD, pill: "READY", pillColor: EMERALD },
  { id: 2, label: "Cargo Release 3461", dot: EMERALD, pill: "READY", pillColor: EMERALD },
  { id: 3, label: "ISF-5 · deadline 4h", dot: AMBER, pill: "4H LEFT", pillColor: AMBER },
] as const;

/** Slot geometry: 4 fixed row positions inside the window frame. */
const slotY = (slot: number) => 128 + slot * 42;

/* --- Deterministic legacy-clutter geometry (no randomness: SSR-safe) --- */
const CLUTTER_TOOLBAR = Array.from({ length: 16 }, (_, i) => ({
  x: 104 + (i % 8) * 30,
  y: 96 + Math.floor(i / 8) * 14,
  w: 20 + ((i * 7) % 3) * 4,
}));
const CLUTTER_GRID = Array.from({ length: 20 }, (_, i) => ({
  x: 104 + (i % 5) * 56,
  y: 132 + Math.floor(i / 5) * 34,
}));
const CLUTTER_CONNECTORS = [
  "M 116 150 C 220 240 260 120 372 232",
  "M 120 250 C 190 130 300 280 368 150",
  "M 140 128 C 250 300 240 110 352 268",
];
const CLUTTER_MENUS = [
  { x: 176, y: 168, w: 92, h: 62, lines: 3 },
  { x: 246, y: 196, w: 84, h: 52, lines: 2 },
];

type Phase = "mess" | "collapse" | "inbox";
type Loop = { order: number[]; entering: number | null; exiting: number | null };

/**
 * Why hero — "legacy collapses into calm". A dense monochrome wireframe
 * (the enterprise-software mess) accretes fast, collapses inward, and a
 * calm three-row inbox assembles in its place. Then a continuous loop:
 * a new urgent filing fades in at the bottom and re-sorts to the top
 * while the rest shift down — urgency rises, the product's core behavior.
 * Reduced motion renders the settled inbox statically with no loop.
 */
function WhyHeroIllustration() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("mess");
  const [looping, setLooping] = useState(false);
  const [loop, setLoop] = useState<Loop>({ order: [0, 1, 2], entering: null, exiting: null });

  useEffect(() => {
    if (reduceMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    // Entrance phase machine
    at(() => setPhase("collapse"), 1200);
    at(() => setPhase("inbox"), 1800);
    at(() => setLooping(true), 4600);

    // Urgency re-sort loop (~7s per cycle)
    const cycle = () => {
      // 1. New filing fades in at the bottom slot
      setLoop((prev) => ({
        ...prev,
        entering: FILINGS.map((f) => f.id).find((id) => !prev.order.includes(id)) ?? null,
      }));
      // 2. After a beat, it re-sorts to the top; the oldest is pushed below
      at(() => {
        setLoop((prev) =>
          prev.entering == null
            ? prev
            : {
                order: [prev.entering, prev.order[0], prev.order[1]],
                entering: null,
                exiting: prev.order[2],
              }
        );
      }, 600);
      // 3. The pushed-out row has faded; drop it from the DOM
      at(() => setLoop((prev) => ({ ...prev, exiting: null })), 2600);
      at(cycle, 7000);
    };
    at(cycle, 4800);

    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  const showInbox = phase === "inbox" || reduceMotion;

  // Rows to render: current order (slots 0-2) + entering/exiting at slot 3
  const rows: { id: number; slot: number; exiting: boolean }[] = loop.order.map((id, i) => ({
    id,
    slot: i,
    exiting: false,
  }));
  if (loop.entering != null) rows.push({ id: loop.entering, slot: 3, exiting: false });
  if (loop.exiting != null) rows.push({ id: loop.exiting, slot: 3, exiting: true });
  rows.sort((a, b) => a.id - b.id); // stable element order across re-sorts

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
        <radialGradient id="why-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.18" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="180" rx="200" ry="140" fill="url(#why-glow)" stroke="none" />

      {/* ---- Phase 1-2: the legacy mess (accretes fast, then collapses) ---- */}
      {!reduceMotion && phase !== "inbox" && (
        <motion.g
          style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}
          animate={
            phase === "mess"
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.9, y: 14 }
          }
          transition={{ duration: 0.55, ease: EASE_IN }}
        >
          {/* Cramped window frame — sharp corners, joyless */}
          <motion.rect
            x="92"
            y="84"
            width="296"
            height="216"
            rx="4"
            stroke="currentColor"
            strokeOpacity="0.35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          />
          {/* Two rows of tiny toolbar chips */}
          {CLUTTER_TOOLBAR.map((c, i) => (
            <motion.rect
              key={`tb-${i}`}
              x={c.x}
              y={c.y}
              width={c.w}
              height="9"
              rx="1.5"
              strokeWidth="1"
              stroke="currentColor"
              strokeOpacity="0.3"
              fill="currentColor"
              fillOpacity="0.05"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, delay: 0.05 + i * 0.028 }}
            />
          ))}
          {/* Dense 4x5 grid of gray boxes */}
          {CLUTTER_GRID.map((c, i) => (
            <motion.rect
              key={`gr-${i}`}
              x={c.x}
              y={c.y}
              width="48"
              height="26"
              rx="2"
              strokeWidth="1"
              stroke="currentColor"
              strokeOpacity="0.3"
              fill="currentColor"
              fillOpacity="0.05"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, delay: 0.32 + i * 0.03 }}
            />
          ))}
          {/* Tangled dashed connectors crossing the grid */}
          {CLUTTER_CONNECTORS.map((d, i) => (
            <motion.path
              key={`cn-${i}`}
              d={d}
              strokeWidth="1"
              strokeOpacity="0.35"
              strokeDasharray="4 4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, delay: 0.82 + i * 0.08 }}
            />
          ))}
          {/* Overlapping fake dropdown menus */}
          {CLUTTER_MENUS.map((m, i) => (
            <motion.g
              key={`mn-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, delay: 0.95 + i * 0.09 }}
            >
              <rect
                x={m.x}
                y={m.y}
                width={m.w}
                height={m.h}
                rx="2"
                strokeWidth="1"
                stroke="currentColor"
                strokeOpacity="0.4"
                fill="currentColor"
                fillOpacity="0.06"
              />
              {Array.from({ length: m.lines }, (_, j) => (
                <line
                  key={j}
                  x1={m.x + 8}
                  y1={m.y + 14 + j * 14}
                  x2={m.x + m.w - 16}
                  y2={m.y + 14 + j * 14}
                  strokeWidth="1"
                  strokeOpacity="0.25"
                />
              ))}
            </motion.g>
          ))}
        </motion.g>
      )}

      {/* ---- Phase 3: the calm inbox assembles ---- */}
      {showInbox && (
        <g>
          {/* Rounded window frame draws on */}
          <motion.rect
            x="92"
            y="84"
            width="296"
            height="216"
            rx="16"
            stroke="currentColor"
            strokeOpacity="0.28"
            fill="currentColor"
            fillOpacity="0.02"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE }}
          />

          {/* TODAY'S BRIEF header */}
          <motion.g
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.45 }}
          >
            <circle cx="118" cy="105" r="2.5" fill={GOLD} stroke="none" />
            <text
              x="128"
              y="108.5"
              fontSize="8"
              fontFamily="ui-sans-serif, sans-serif"
              fontWeight="700"
              letterSpacing="2"
              fill="currentColor"
              fillOpacity="0.65"
              stroke="none"
            >
              TODAY&apos;S BRIEF
            </text>
            <line x1="112" y1="118" x2="368" y2="118" strokeWidth="1" strokeOpacity="0.12" />
          </motion.g>

          {/* Filing rows — fixed slots, re-sorted by translating y */}
          {rows.map(({ id, slot, exiting }) => {
            const row = FILINGS[id];
            const y = slotY(slot);
            const entranceDelay = looping || reduceMotion ? 0 : 0.55 + slot * 0.15;
            return (
              <motion.g
                key={id}
                initial={reduceMotion ? false : { opacity: 0, y: y + 16 }}
                animate={{ opacity: exiting ? 0 : 1, y }}
                transition={{
                  y: { duration: 0.6, ease: EASE, delay: entranceDelay },
                  opacity: exiting
                    ? { duration: 0.45, ease: "easeOut", delay: 0.9 }
                    : { duration: 0.45, ease: EASE, delay: entranceDelay },
                }}
              >
                <rect
                  x="112"
                  y="0"
                  width="256"
                  height="36"
                  rx="9"
                  stroke="currentColor"
                  strokeOpacity="0.16"
                  fill="currentColor"
                  fillOpacity={slot === 0 ? 0.045 : 0.015}
                />
                <circle cx="128" cy="18" r="3.5" fill={row.dot} stroke="none" />
                <text
                  x="142"
                  y="21"
                  fontSize="9"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="600"
                  fill="currentColor"
                  fillOpacity="0.75"
                  stroke="none"
                >
                  {row.label}
                </text>
                {/* Severity pill */}
                <rect
                  x="306"
                  y="10"
                  width="52"
                  height="16"
                  rx="8"
                  fill={row.pillColor}
                  fillOpacity="0.1"
                  stroke={row.pillColor}
                  strokeOpacity="0.45"
                  strokeWidth="1"
                />
                <text
                  x="332"
                  y="21"
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="ui-sans-serif, sans-serif"
                  fontWeight="700"
                  letterSpacing="0.5"
                  fill={row.pillColor}
                  stroke="none"
                >
                  {row.pill}
                </text>
              </motion.g>
            );
          })}

          {/* Stamp — top-left, outside the frame */}
          <motion.g
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: reduceMotion ? 0 : 1.1 }}
          >
            <circle cx="60" cy="56" r="2.5" fill={EMERALD} stroke="none" />
            <text
              x="72"
              y="60"
              fontSize="8.5"
              fontFamily="ui-monospace, monospace"
              fontWeight="600"
              fill="currentColor"
              fillOpacity="0.65"
              stroke="none"
            >
              an inbox for US customs
            </text>
          </motion.g>
        </g>
      )}
    </motion.svg>
  );
}

const DIFFERENTIATORS = [
  {
    icon: Bot,
    title: "AI that catches problems before CBP does",
    body:
      "Every filing runs through an AI pre-flight review before it leaves your hands — it reads your ISF, Entry, and HTS data the way a seasoned reviewer would and flags what looks wrong while you can still fix it. And when CBP does push back, our rejection coach translates the error code into plain English and tells you exactly what to change. No decoding cryptic ABI responses on your own.",
    hover: "pulse" as const,
  },
  {
    icon: Inbox,
    title: "A calm, modern interface — not a 1990s terminal",
    body:
      "ISF-10/ISF-5, Entry Summary 7501, Cargo Release 3461, container tracking, manifest queries, and HTS classification all live in one quiet inbox. Work a ranked queue instead of juggling a dozen browser tabs. Filing customs should feel like clearing email, not operating legacy software.",
    hover: "lift" as const,
  },
  {
    icon: Tag,
    title: "Transparent, per-shipment pricing",
    body:
      "No monthly fee. No enterprise contract. No \"talk to sales\" wall. $45 for an ISF, $180 for ISF + Entry, $280 for the full suite — and you only pay when you file. A rejected or late ISF, or a single misclassification, costs far more than the filing fee. The AI pre-flight is what stands between you and that cost.",
    hover: "lift" as const,
  },
  {
    icon: Rocket,
    title: "Fast to start — first filing in under an hour",
    body:
      "Sign up, watch a short demo, get provisioned, and file. No six-month implementation, no professional-services engagement, no IT project. The product is ready the day you are.",
    hover: "lift" as const,
  },
  {
    icon: Users,
    title: "Built for self-filers and brokers alike",
    body:
      "Self-filing importers get a guided, AI-checked path to filing their own ISF and Entry. Brokers and 3PLs get the same rails with team accounts and role-based access to run filings across clients. Same data, same plumbing — surfaced for how you actually work.",
    hover: "lift" as const,
  },
];

const VALUE_MATH: { label: string; tone: Severity; cost: string; note: string }[] = [
  {
    label: "Late / rejected ISF",
    tone: "rose",
    cost: "up to $5,000",
    note: "CBP liquidated-damages exposure per violation — many times the filing fee.",
  },
  {
    label: "HTS misclassification",
    tone: "amber",
    cost: "duties + penalties",
    note: "Wrong tariff line can mean back-duties, interest, and a closer look at future entries.",
  },
  {
    label: "One MyCargoLens filing",
    tone: "emerald",
    cost: "$45 – $280",
    note: "AI pre-flight runs before submission. Pay only when you file.",
  },
];

const ONBOARDING = [
  { step: "01", title: "Book a walkthrough", body: "20 minutes with the team. We show you the inbox and learn your filing volume." },
  { step: "02", title: "Get provisioned", body: "Your account and ABI gateway connection are set up on our side." },
  { step: "03", title: "Add a card", body: "Saved via Stripe, never charged until you file. You control every filing." },
  { step: "04", title: "File", body: "Run a real ISF or Entry — AI pre-flight checks it first. Billed on CBP acceptance." },
];

export function WhyMyCargoLensClient() {
  return (
    <>
      <PageHero
        label="Why MyCargoLens"
        title="Customs filing that feels like an inbox, not enterprise software."
        description="The same ISF, Entry, tracking, and HTS work you do today — surfaced in a calm, modern interface, checked by AI before it reaches CBP, and priced per shipment so you only pay when you file."
        breadcrumbs={[{ label: "Why MyCargoLens", href: "/why-mycargolens" }]}
        illustration={<WhyHeroIllustration />}
      />

      {/* HEADLINE DIFFERENTIATOR — AI */}
      <SectionShell
        tone="default"
        eyebrow="Our headline difference"
        title="AI that catches problems before CBP does."
        intro="Customs rejections are slow, expensive, and written in code. We put an AI reviewer in front of every filing so the problems surface while you can still fix them — and explain the ones that slip through in plain English."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <IconTile icon={Bot} tone="gold" hover="pulse" reveal className="mb-4" />
            <h3 className="text-base font-semibold mb-2">AI pre-flight review</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Before a filing leaves your hands, the AI reads your ISF, Entry, and HTS data
              the way an experienced reviewer would — flagging missing parties, inconsistent
              values, and likely-wrong classifications while there's still time to correct them.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <IconTile icon={MessageSquareWarning} tone="gold" hover="lift" reveal revealDelay={0.06} className="mb-4" />
            <h3 className="text-base font-semibold mb-2">Rejection coach</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When CBP pushes back, you don't get a cryptic code and a shrug. The rejection
              coach translates the response into plain English and tells you exactly what to
              change — then you resubmit from the same screen.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* THE FULL CASE — five differentiators */}
      <SectionShell
        tone="muted"
        eyebrow="Why teams choose us"
        title="Five reasons importers and brokers move to MyCargoLens."
      >
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {DIFFERENTIATORS.map(({ icon: Icon, title, body, hover }, idx) => (
            <li key={title} className="rounded-2xl border border-border/60 bg-card p-6">
              <IconTile icon={Icon} tone="gold" hover={hover} reveal revealDelay={idx * 0.06} className="mb-4" />
              <h3 className="text-base font-semibold mb-2 leading-snug">{title}</h3>
              <p className="text-sm opacity-80 leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* THE PRICING MATH */}
      <SectionShell
        tone="default"
        eyebrow="The value math"
        title="The filing fee isn't the cost that matters."
        intro="We don't compete on being the cheapest. We compete on what a clean filing is worth — because the price of getting it wrong dwarfs the price of the filing itself."
      >
        <ul className="grid gap-4 md:grid-cols-3">
          {VALUE_MATH.map((row) => (
            <li key={row.label} className="rounded-2xl border border-border/60 bg-card p-6">
              <SeverityPill tone={row.tone} className="mb-3">{row.label}</SeverityPill>
              <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{row.cost}</div>
              <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">{row.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          That's the trade: a flat, knowable per-shipment fee with an AI reviewer in front of
          it, versus the open-ended cost of a rejected ISF or a misclassified entry. Pay only
          when you file — see the full breakdown on{" "}
          <Link href="/pricing" className="font-semibold underline underline-offset-4 hover:text-gold">
            pricing
          </Link>
          .
        </p>
      </SectionShell>

      {/* ONBOARDING */}
      <SectionShell
        tone="muted"
        eyebrow="Fast to start"
        title="Your first filing in well under an hour."
        intro="No implementation project. No professional-services contract. No six-month rollout. The product works the day you sign up."
      >
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ONBOARDING.map((s, idx) => (
            <li key={s.step} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-sm font-semibold text-gold-dark dark:text-gold tabular-nums">{s.step}</span>
                <span className="h-px flex-1 bg-border/60" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold mb-1.5">{s.title}</h3>
              <p className="text-[13px] opacity-80 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </SectionShell>

      {/* BUILT FOR BOTH */}
      <SectionShell tone="default" eyebrow="Built for both" title="One platform, two audiences.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <IconTile icon={ShieldCheck} tone="gold" hover="lift" reveal className="mb-4" />
            <h3 className="text-base font-semibold mb-2">Self-filing importers</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              File your own ISF-10/ISF-5 and Entry with an AI reviewer watching your back.
              Track containers, classify HTS, and run manifest queries without hiring out
              every filing or learning a legacy terminal.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <IconTile icon={Layers} tone="gold" hover="lift" reveal revealDelay={0.06} className="mb-4" />
            <h3 className="text-base font-semibold mb-2">Brokers &amp; 3PLs</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Run filings across clients on the same rails, with team accounts and role-based
              access. The calm inbox and AI pre-flight scale from your first client to your
              hundredth — no per-seat enterprise contract to negotiate.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* CTA */}
      <SectionShell tone="default" headingAlign="center" title="See it on your own filings.">
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
