"use client";

import Link from "next/link";
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
import { GOLD, EMERALD } from "@/lib/colors";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Why hero — a stylized "inbox for customs" card. Three queued filing
 * rows draw on in sequence; the top row carries a gold AI pre-flight
 * badge that pulses. Mirrors the About/Security hero idiom: framer-motion
 * staggered draw-on for the static composition, SMIL animate for the
 * looping pulse. SMIL ignores prefers-reduced-motion, so the pulse is
 * gated on useReducedMotion — reduced-motion users get the static card.
 */
function WhyHeroIllustration() {
  const reduceMotion = useReducedMotion();
  const rows = [
    { y: 132, label: "ISF-10 · INV-4421", tone: "ai" as const },
    { y: 192, label: "Entry 7501 · INV-4390", tone: "ok" as const },
    { y: 252, label: "Cargo Release 3461", tone: "ok" as const },
  ];
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
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <defs>
        <radialGradient id="why-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.18" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="180" rx="200" ry="140" fill="url(#why-glow)" stroke="none" />

      {/* Inbox window frame */}
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
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: { pathLength: 1, opacity: 1, transition: { duration: 0.9, ease: EASE } },
        }}
      />

      {/* Inbox header: icon + "INBOX" */}
      <motion.g
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.5, delay: 0.3 } },
        }}
      >
        <rect x="112" y="100" width="14" height="11" rx="2" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <path d="M 112 104 L 119 108 L 126 104" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <text
          x="134"
          y="110"
          fontSize="10"
          fontFamily="ui-sans-serif, sans-serif"
          fontWeight="700"
          letterSpacing="2"
          fill="currentColor"
          fillOpacity="0.6"
          stroke="none"
        >
          INBOX
        </text>
      </motion.g>

      {/* Queued filing rows */}
      {rows.map((row, i) => (
        <motion.g
          key={row.y}
          variants={{
            hidden: { opacity: 0, x: 14 },
            visible: {
              opacity: 1,
              x: 0,
              transition: { duration: 0.55, ease: EASE, delay: 0.4 + i * 0.18 },
            },
          }}
        >
          <rect
            x="112"
            y={row.y - 22}
            width="256"
            height="44"
            rx="9"
            stroke="currentColor"
            strokeOpacity="0.16"
            fill="currentColor"
            fillOpacity={i === 0 ? 0.05 : 0.015}
          />
          {/* status dot */}
          <circle
            cx="128"
            cy={row.y}
            r="4"
            fill={row.tone === "ai" ? GOLD : EMERALD}
            stroke="none"
          />
          <text
            x="144"
            y={row.y + 4}
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fontWeight="600"
            fill="currentColor"
            fillOpacity="0.75"
            stroke="none"
          >
            {row.label}
          </text>
          {row.tone === "ai" && (
            <g>
              {/* AI pre-flight badge */}
              <rect x="296" y={row.y - 11} width="60" height="22" rx="11" fill={`${GOLD}26`} stroke={GOLD} strokeWidth="1" />
              <text
                x="326"
                y={row.y + 4}
                textAnchor="middle"
                fontSize="9"
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight="700"
                letterSpacing="0.5"
                fill={GOLD}
                stroke="none"
              >
                AI ✓
              </text>
              {!reduceMotion && (
                <circle cx="326" cy={row.y} r="14" stroke={GOLD} strokeOpacity="0.4" fill="none">
                  <animate attributeName="r" values="14;22;14" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          )}
        </motion.g>
      ))}

      {/* "an inbox for US customs" stamp top-left */}
      <motion.g
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.5, delay: 1.1 } },
        }}
      >
        <circle cx="60" cy="56" r="2.5" fill={EMERALD} stroke="none" />
        <text x="72" y="60" fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight="600" fill="currentColor" fillOpacity="0.55" stroke="none">
          an inbox for US customs
        </text>
      </motion.g>
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
  { step: "01", title: "Sign up free", body: "Email-verified account in minutes. No card, no commitment." },
  { step: "02", title: "See a demo", body: "We'll walk you through the inbox and your first filing live." },
  { step: "03", title: "Get provisioned", body: "Your ABI gateway connection is set up on our side." },
  { step: "04", title: "File", body: "Run a real ISF or Entry — AI pre-flight checks it first." },
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
