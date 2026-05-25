"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
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
        <figure className="rounded-2xl border-l-4 border-gold bg-card/60 px-5 py-4 my-5">
          <blockquote className="text-sm italic text-foreground leading-relaxed">
            "{persona.pullquote}"
          </blockquote>
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

function SolutionsHeroIllustration() {
  const GOLD = "hsl(43 96% 56%)";
  const ROSE = "hsl(0 72% 51%)";
  const EMERALD = "hsl(160 84% 39%)";

  // Three persona panels — each shows a snippet of "what they see"
  // (rather than just a labeled circle). Center is the shared product.
  const panels = [
    {
      x: 18,
      y: 70,
      label: "OPS MANAGER",
      tone: GOLD,
      rows: [
        { dot: ROSE, text: "INV-4421 · rejected" },
        { dot: "hsl(38 92% 50%)", text: "ISF · 4h" },
        { dot: EMERALD, text: "3 ready" },
      ],
    },
    {
      x: 330,
      y: 70,
      label: "BROKERAGE",
      tone: GOLD,
      rows: [
        { dot: EMERALD, text: "12 imp. · 47 open" },
        { dot: EMERALD, text: "Templates · 8" },
        { dot: GOLD, text: "Audit · live" },
      ],
    },
    {
      x: 174,
      y: 224,
      label: "FORWARDER",
      tone: GOLD,
      rows: [
        { dot: GOLD, text: "MAEU9381-2" },
        { dot: EMERALD, text: "ABI · accepted" },
        { dot: GOLD, text: "Liq · 53d" },
      ],
    },
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
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
    >
      <defs>
        <radialGradient id="sol-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="180" rx="200" ry="140" fill="url(#sol-glow)" stroke="none" />

      {/* Connecting paths from each persona panel toward the central hub */}
      <motion.g
        strokeOpacity="0.22"
        strokeDasharray="3 5"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.8, delay: 0.4 } },
        }}
      >
        <path d="M 132 130 Q 180 160 200 178" />
        <path d="M 348 130 Q 300 160 280 178" />
        <path d="M 240 220 L 240 224" />
      </motion.g>

      {/* === Three persona "what they see" panels =================== */}
      {panels.map((p, idx) => (
        <motion.g
          key={p.label}
          variants={{
            hidden: { opacity: 0, y: 14, scale: 0.95 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.6, ease: EASE_OUT_QUART, delay: idx * 0.12 },
            },
          }}
        >
          <motion.g
            animate={{ y: [0, -3, 0] }}
            transition={{
              duration: 5 + idx,
              repeat: Infinity,
              ease: "easeInOut",
              delay: idx * 0.4,
            }}
          >
            {/* Panel card */}
            <rect
              x={p.x}
              y={p.y}
              width="132"
              height="110"
              rx="10"
              fill="currentColor"
              fillOpacity="0.04"
              strokeOpacity="0.6"
            />
            {/* Header */}
            <text
              x={p.x + 12}
              y={p.y + 20}
              fontSize="8"
              fontFamily="ui-sans-serif, sans-serif"
              fontWeight="700"
              letterSpacing="0.8"
              fill={p.tone}
              stroke="none"
            >
              {p.label}
            </text>
            <line x1={p.x + 12} y1={p.y + 28} x2={p.x + 120} y2={p.y + 28} strokeOpacity="0.4" />

            {/* Three "row" snippets */}
            {p.rows.map((row, i) => (
              <g key={i}>
                <circle cx={p.x + 18} cy={p.y + 46 + i * 18} r="2.5" fill={row.dot} stroke="none" />
                <text
                  x={p.x + 26}
                  y={p.y + 49 + i * 18}
                  fontSize="8.5"
                  fontFamily="ui-sans-serif, sans-serif"
                  fontWeight="500"
                  fill="currentColor"
                  fillOpacity="0.75"
                  stroke="none"
                >
                  {row.text}
                </text>
              </g>
            ))}
          </motion.g>
        </motion.g>
      ))}

      {/* === Central MyCargoLens hub ================================= */}
      <motion.g
        variants={{
          hidden: { opacity: 0, scale: 0.7 },
          visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: EASE_OUT_QUART, delay: 0.5 } },
        }}
      >
        {/* Pulse halo */}
        <motion.circle
          cx="240"
          cy="180"
          r="48"
          stroke={GOLD}
          strokeOpacity="0.4"
          fill="none"
          animate={{ scale: [1, 1.3, 1], opacity: [0.45, 0, 0.45] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "240px 180px" }}
        />
        {/* Hub circle with gold */}
        <circle
          cx="240"
          cy="180"
          r="44"
          fill={`${GOLD}26`}
          stroke={GOLD}
          strokeWidth="2"
        />
        {/* Inner ring */}
        <circle
          cx="240"
          cy="180"
          r="32"
          stroke={GOLD}
          strokeOpacity="0.55"
          fill="none"
        />
        {/* MCL wordmark — three stacked chevrons */}
        <g stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 226 174 l 14 -8 l 14 8" fill="none" />
          <path d="M 226 184 l 14 -8 l 14 8" strokeOpacity="0.7" fill="none" />
        </g>
        <text
          x="240"
          y="208"
          textAnchor="middle"
          fontSize="9"
          fontFamily="ui-sans-serif, sans-serif"
          fontWeight="700"
          letterSpacing="1.2"
          fill="currentColor"
          fillOpacity="0.6"
          stroke="none"
        >
          MYCARGOLENS
        </text>
      </motion.g>
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
          Start a free trial — the same product works for all three. Pick the persona that
          matches your day-to-day, but the rest is one click away.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="gold" size="lg" asChild>
            <a href="https://app.mycargolens.com/register">Start free</a>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/contact">Talk to founders</Link>
          </Button>
        </div>
      </SectionShell>
    </>
  );
}
