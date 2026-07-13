"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Bot, Search, Sparkles, Sun } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { IconTile } from "@/components/ui/icon-tile";
import { Button } from "@/components/ui/button";
import { CodeStream } from "@/components/ui/code-stream";
import { SeverityPill } from "@/components/ui/severity-pill";

const REJECTION_TEXT = `CBP rejected because the manufacturer party
is missing a tax ID.

Three fixes:
  1. Open INV-4421 → Parties → Manufacturer
  2. Add the tax ID (DUNS, MID, or foreign ID)
  3. Re-submit. The bond carries over.`;

const PREFLIGHT_TEXT = `Pre-flight on INV-4502: 1 warning.

HTS 6204.62.40 (women's trousers) has
ADD/CVD watch for Chinese-origin goods.
Confirm origin before submitting. It could
trigger an additional duty deposit.`;

const HTS_SUGGESTIONS = [
  { code: "6115.96.6010", desc: "Stockings, socks: knit, of cotton", best: true, reason: "Best match. Polyester is a synthetic fiber and athletic socks are typically knit." },
  { code: "6115.95.6020", desc: "Stockings, socks: synthetic fibers", best: false, reason: "Alternative. The 'cotton' subheading is often used for blended athletic socks." },
  { code: "6115.99.1410", desc: "Stockings, socks: other textile materials", best: false, reason: "Fallback for blends with no dominant material." },
];

const HOW_IT_WORKS = [
  { title: "The model", body: "gpt-4o via OpenAI. We send only the filing data plus the CBP response. We do not send your AR data, banking, billing, or other unrelated tenant data." },
  { title: "The gate", body: "Gated by your team's enable flag. An admin can toggle AI off per-team or per-feature. Rule-based fallback is always available." },
  { title: "Your data", body: "Your data is not used for model training. OpenAI's API tier we use has zero-retention by contract." },
];

const FAQ = [
  { q: "Is the AI required to use MyCargoLens?", a: "No. AI is opt-in per team. The rule-based gate runs on every filing regardless." },
  { q: "How long does AI Coach take to respond?", a: "First token typically 1.5 to 3 seconds. Full numbered fix steps in 6 to 12 seconds. Streams as it generates." },
  { q: "What if the AI gets it wrong?", a: "You're the final reviewer. Every fix step is suggested, not auto-applied. You always click submit." },
  { q: "Does the AI know my templates?", a: "Yes. Pre-flight reads your saved templates to suggest field reuse and flag inconsistencies." },
  { q: "Can I disable AI for sensitive filings?", a: "Yes. Mark any draft as 'AI off' and it bypasses Coach + pre-flight regardless of team setting." },
];

const EASE = [0.22, 1, 0.36, 1] as const;
import { AMBER, EMERALD, GOLD } from "@/lib/colors";

/* ------------------------------------------------------------------------
 * Hero: "streaming intelligence" — a live AI Coach chat exchange that plays
 * out on loop. Two scenarios alternate: a CBP rejection explained with fix
 * steps, then an HTS lookup. Reduced motion renders scenario 1 fully
 * resolved with no timers or loops.
 * ---------------------------------------------------------------------- */

type HeroScenario = {
  question: string;
  questionWidth: number;
  reply: string[];
  steps: string[];
  pillFrom: { label: string; width: number };
  pillTo: { label: string; width: number };
};

const HERO_SCENARIOS: HeroScenario[] = [
  {
    question: "Why did CBP reject INV-4421?",
    questionWidth: 154,
    reply: ["ISF-10 missing the seller's full", "address (S02 field)."],
    steps: ["Open Parties → Seller", "Add street + city", "Resubmit"],
    pillFrom: { label: "Draft", width: 56 },
    pillTo: { label: "Resubmitted · Accepted", width: 132 },
  },
  {
    question: "HTS for wool overcoats?",
    questionWidth: 130,
    reply: ["6202.11.00 · 41¢/kg + 16.3%", "Women's overcoats, wool, not knit — Ch. 62."],
    steps: [],
    pillFrom: { label: "Looking up", width: 76 },
    pillTo: { label: "Classified · Ch. 62", width: 118 },
  },
];

type HeroPhase = "user-in" | "thinking" | "streaming" | "list" | "status" | "hold" | "fade";

const HERO_PHASE_ORDER: HeroPhase[] = [
  "user-in",
  "thinking",
  "streaming",
  "list",
  "status",
  "hold",
  "fade",
];

/** Approx. advance width of ui-monospace at fontSize 8.5 — drives caret x. */
const HERO_CHAR_W = 5.1;
const REPLY_X = 96;
const REPLY_Y = 138; // baseline of first reply line
const REPLY_LINE_H = 15;
const STEP_Y = 180; // baseline of first fix step
const STEP_H = 22;

function HeroAIIllustration() {
  const rawReduce = useReducedMotion();
  // SSR-safe gate (same pattern as CodeStream): server HTML always renders
  // the animated branch's initial state; we flip after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduce = mounted && rawReduce === true;

  const [phaseState, setPhaseState] = useState<HeroPhase>("user-in");
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [cycle, setCycle] = useState(0);

  // Loop state machine. Every transition is a timeout; the streaming phase
  // chains one timeout per character (~30ms). All timers clean up on unmount.
  useEffect(() => {
    if (reduce) return;
    const sc = HERO_SCENARIOS[scenarioIdx];
    const total = sc.reply.join("").length;
    let t: ReturnType<typeof setTimeout> | undefined;
    switch (phaseState) {
      case "user-in":
        t = setTimeout(() => setPhaseState("thinking"), 700);
        break;
      case "thinking":
        t = setTimeout(() => setPhaseState("streaming"), 1300);
        break;
      case "streaming":
        t =
          chars < total
            ? setTimeout(() => setChars((c) => c + 1), 30)
            : setTimeout(() => setPhaseState(sc.steps.length > 0 ? "list" : "status"), 450);
        break;
      case "list":
        t =
          stepCount < sc.steps.length
            ? setTimeout(() => setStepCount((n) => n + 1), 480)
            : setTimeout(() => setPhaseState("status"), 300);
        break;
      case "status":
        t = setTimeout(() => setPhaseState("hold"), 900);
        break;
      case "hold":
        t = setTimeout(() => setPhaseState("fade"), 2500);
        break;
      case "fade":
        t = setTimeout(() => {
          setChars(0);
          setStepCount(0);
          setScenarioIdx((i) => (i + 1) % HERO_SCENARIOS.length);
          setCycle((c) => c + 1);
          setPhaseState("user-in");
        }, 300);
        break;
    }
    return () => {
      if (t !== undefined) clearTimeout(t);
    };
  }, [reduce, phaseState, chars, stepCount, scenarioIdx]);

  // Reduced motion: scenario 1, fully resolved, frozen.
  const s = HERO_SCENARIOS[reduce ? 0 : scenarioIdx];
  const totalChars = s.reply.join("").length;
  const phase: HeroPhase = reduce ? "hold" : phaseState;
  const shownChars = reduce ? totalChars : Math.min(chars, totalChars);
  const shownSteps = reduce ? s.steps.length : stepCount;

  const at = (p: HeroPhase) => HERO_PHASE_ORDER.indexOf(phase) >= HERO_PHASE_ORDER.indexOf(p);
  const statusDone = at("status");

  // Caret position + per-line reveal offsets for the typewriter.
  const lineStarts: number[] = [];
  let caretLine = s.reply.length - 1;
  let caretCol = s.reply[caretLine].length;
  {
    let consumed = 0;
    for (const line of s.reply) {
      lineStarts.push(consumed);
      consumed += line.length;
    }
    let rem = shownChars;
    for (let i = 0; i < s.reply.length; i++) {
      const len = s.reply[i].length;
      if (rem <= len) {
        caretLine = i;
        caretCol = rem;
        break;
      }
      rem -= len;
    }
  }

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
        <pattern id="ai-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" fillOpacity="0.08" stroke="none" />
        </pattern>
        <radialGradient id="ai-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* === Ambience: dot grid + slowly drifting gold glow =============== */}
      <rect x="16" y="6" width="448" height="348" fill="url(#ai-dots)" stroke="none" />
      <motion.ellipse
        cx="240"
        cy="180"
        rx="196"
        ry="152"
        fill="url(#ai-glow)"
        stroke="none"
        animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "240px 180px" }}
      />

      {/* === Chat panel frame (persistent) ================================ */}
      <motion.g
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <rect
          x="78"
          y="28"
          width="324"
          height="304"
          rx="16"
          fill="currentColor"
          fillOpacity="0.03"
          strokeOpacity="0.5"
        />
        <line x1="79" y1="60" x2="401" y2="60" strokeOpacity="0.16" />
        <circle cx="96" cy="44" r="3" fill="currentColor" fillOpacity="0.18" stroke="none" />
        <circle cx="108" cy="44" r="3" fill="currentColor" fillOpacity="0.18" stroke="none" />
        <circle cx="120" cy="44" r="3" fill="currentColor" fillOpacity="0.18" stroke="none" />
        <text
          x="138"
          y="47.5"
          fontSize="8"
          fontFamily="ui-sans-serif, sans-serif"
          fontWeight="600"
          fill="currentColor"
          fillOpacity="0.7"
          stroke="none"
        >
          AI Coach
        </text>
        <text
          x="386"
          y="47.5"
          textAnchor="end"
          fontSize="7"
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.5"
          fill="currentColor"
          fillOpacity="0.65"
          stroke="none"
        >
          gpt-4o · SSE
        </text>
      </motion.g>

      {/* === Conversation (remounts each cycle so entrances replay) ======= */}
      <motion.g
        key={reduce ? "static" : cycle}
        animate={{ opacity: phase === "fade" ? 0 : 1 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        {/* User message — slides in from the right */}
        <motion.g
          initial={reduce ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <rect
            x={386 - s.questionWidth}
            y="74"
            width={s.questionWidth}
            height="26"
            rx="13"
            fill={GOLD}
            fillOpacity="0.13"
            stroke={GOLD}
            strokeOpacity="0.35"
          />
          <text
            x="374"
            y="90.5"
            textAnchor="end"
            fontSize="9"
            fontFamily="ui-sans-serif, sans-serif"
            fill="currentColor"
            fillOpacity="0.8"
            stroke="none"
          >
            {s.question}
          </text>
        </motion.g>

        {/* Bot row label */}
        {at("thinking") && (
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <circle cx="100" cy="115" r="3" fill={GOLD} stroke="none" />
            <text
              x="108"
              y="118"
              fontSize="7"
              fontFamily="ui-monospace, monospace"
              fontWeight="700"
              letterSpacing="1"
              fill="currentColor"
              fillOpacity="0.65"
              stroke="none"
            >
              AI COACH
            </text>
          </motion.g>
        )}

        {/* Thinking dots — pulse in stagger, dissolve into the reply */}
        <AnimatePresence>
          {phase === "thinking" && (
            <motion.g
              key="thinking"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <rect
                x="96"
                y="126"
                width="58"
                height="26"
                rx="13"
                fill="currentColor"
                fillOpacity="0.05"
                strokeOpacity="0.35"
              />
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={112 + i * 13}
                  cy="139"
                  r="2.5"
                  fill="currentColor"
                  stroke="none"
                  animate={{ opacity: [0.2, 0.9, 0.2] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* Streamed reply — SSE typewriter with blinking caret */}
        {at("streaming") && (
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            {s.reply.map((line, i) => (
              <text
                key={i}
                x={REPLY_X}
                y={REPLY_Y + i * REPLY_LINE_H}
                fontSize="8.5"
                fontFamily="ui-monospace, monospace"
                fill="currentColor"
                fillOpacity="0.78"
                stroke="none"
              >
                {line.slice(0, Math.max(0, Math.min(line.length, shownChars - lineStarts[i])))}
              </text>
            ))}
            {phase === "streaming" && (
              <motion.rect
                x={REPLY_X + caretCol * HERO_CHAR_W + 1.5}
                y={REPLY_Y + caretLine * REPLY_LINE_H - 8.5}
                width="2"
                height="11"
                rx="0.5"
                fill={GOLD}
                stroke="none"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              />
            )}
          </motion.g>
        )}

        {/* Numbered fix steps — reveal line by line */}
        {s.steps.slice(0, shownSteps).map((step, i) => {
          const y = STEP_Y + i * STEP_H;
          return (
            <motion.g
              key={step}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <circle
                cx="103"
                cy={y - 3}
                r="7"
                fill={GOLD}
                fillOpacity="0.15"
                stroke={GOLD}
                strokeOpacity="0.8"
                strokeWidth="1.2"
              />
              <text
                x="103"
                y={y - 0.4}
                textAnchor="middle"
                fontSize="7.5"
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight="700"
                fill={GOLD}
                stroke="none"
              >
                {i + 1}
              </text>
              <text
                x="118"
                y={y}
                fontSize="9"
                fontFamily="ui-sans-serif, sans-serif"
                fill="currentColor"
                fillOpacity="0.72"
                stroke="none"
              >
                {step}
              </text>
            </motion.g>
          );
        })}

        {/* Status pill — amber crossfades to emerald with a check draw-on */}
        {at("streaming") && (
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <line x1="96" y1="288" x2="384" y2="288" strokeOpacity="0.12" />
            <motion.g
              animate={{ opacity: statusDone ? 0 : 1 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <rect
                x="96"
                y="299"
                width={s.pillFrom.width}
                height="22"
                rx="11"
                fill={AMBER}
                fillOpacity="0.1"
                stroke={AMBER}
                strokeOpacity="0.45"
              />
              <circle cx="109" cy="310" r="2.5" fill={AMBER} stroke="none" />
              <text
                x="117"
                y="313"
                fontSize="8"
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight="600"
                fill={AMBER}
                stroke="none"
              >
                {s.pillFrom.label}
              </text>
            </motion.g>
            <motion.g
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: statusDone ? 1 : 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <rect
                x="96"
                y="299"
                width={s.pillTo.width}
                height="22"
                rx="11"
                fill={EMERALD}
                fillOpacity="0.1"
                stroke={EMERALD}
                strokeOpacity="0.5"
              />
              <motion.path
                d="M105.5 310.5 l3 3 l6 -6.5"
                stroke={EMERALD}
                strokeWidth="1.8"
                fill="none"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: statusDone ? 1 : 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: statusDone ? 0.15 : 0 }}
              />
              <text
                x="120"
                y="313"
                fontSize="8"
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight="600"
                fill={EMERALD}
                stroke="none"
              >
                {s.pillTo.label}
              </text>
            </motion.g>
          </motion.g>
        )}
      </motion.g>

      {/* === Quiet gold sparkles outside the panel ======================== */}
      {!reduce && (
        <g stroke={GOLD} strokeOpacity="0.8" strokeWidth="1.5">
          <motion.path
            d="M436 84 v10 M441 89 h-10"
            animate={{ opacity: [0.35, 0.9, 0.35] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M48 268 v7 M51.5 271.5 h-7"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          />
        </g>
      )}
    </motion.svg>
  );
}

export function AiClient() {
  return (
    <>
      <PageHero
        label="Platform"
        title="Plain English explains every CBP rejection."
        description="Built on gpt-4o. Reads your filing, your party data, and the CBP response. Streams numbered fix steps. Gated behind your team's enable flag, so you can toggle it off anytime."
        breadcrumbs={[
          { label: "Platform", href: "/features" },
          { label: "AI", href: "/platform/ai" },
        ]}
        illustration={<HeroAIIllustration />}
      />

      <SectionShell
        tone="default"
        eyebrow="The AI features"
        title="One model. Three surfaces."
        className="pb-32 md:pb-40"
      >
        <ul className="grid gap-5 md:grid-cols-3 items-stretch">
          {/* Today's brief — now full of content so it matches the height of
              the cards with streaming chat. Includes a sample brief, the
              rule-based fallback example, and the generation cadence. */}
          <li className="rounded-2xl border border-border/60 bg-card p-5 flex flex-col min-h-[520px]">
            <IconTile icon={Sun} hover="spin" reveal className="size-9 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-2">Today's brief</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              One sentence at the top of your day. Auto-generated when you open
              the Compliance Center. Capped at 140 characters so you can read
              it without scrolling.
            </p>

            <div className="mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Sparkles size={11} className="text-gold-dark dark:text-gold" />
                With AI enabled
              </div>
              <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-[12.5px] text-foreground font-medium leading-snug">
                "Three drafts waiting on you. Run an AI pre-flight before submitting. One rejection is blocking re-file."
              </div>
            </div>

            <div className="mb-auto">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                Rule-based fallback (AI off)
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-[12.5px] text-muted-foreground font-medium leading-snug">
                "5 cards in your queue. 1 needs attention before EOD."
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground/80 pt-3 border-t border-border/40">
              <span className="font-mono tabular-nums">≤140 chars</span>
              <span>Refreshes each login</span>
            </div>
          </li>

          <li className="rounded-2xl border border-border/60 bg-card p-5 flex flex-col min-h-[520px]">
            {/* Pulse — the AI Coach feels alive. Only one of the three AI
                cards gets the continuous breath so it doesn't compete. */}
            <IconTile icon={Bot} hover="pulse" reveal revealDelay={0.08} className="size-9 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-2">AI Coach: rejection mode</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
              When CBP rejects, the Coach reads the error code, your filing, and party data, then streams numbered fix steps.
            </p>
            <CodeStream variant="chat" replayOnView speed={18} text={REJECTION_TEXT} ariaLabel="AI rejection example" className="h-[260px] overflow-hidden" />
          </li>

          <li className="rounded-2xl border border-border/60 bg-card p-5 flex flex-col min-h-[520px]">
            <IconTile icon={Sparkles} hover="wiggle" reveal revealDelay={0.16} className="size-9 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-2">AI Coach: pre-flight mode</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
              Reviews the entire draft for UFLPA risks, PGA flags, HTS issues, and rule-based gates before you submit.
            </p>
            <CodeStream variant="chat" replayOnView speed={18} text={PREFLIGHT_TEXT} ariaLabel="AI pre-flight example" className="h-[260px] overflow-hidden" />
          </li>
        </ul>
      </SectionShell>

      <SectionShell tone="default" title="Describe goods, get the right HTS code.">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 mb-5">
            <Search size={16} className="text-muted-foreground" />
            <span className="flex-1 text-sm text-foreground">polyester athletic socks, women's</span>
            <kbd className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">↵</kbd>
          </div>
          <ul className="space-y-2.5">
            {HTS_SUGGESTIONS.map((s) => (
              <li key={s.code} className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-mono text-[14px] font-semibold tabular-nums text-foreground">{s.code}</span>
                  <span className="flex-1 text-[13px] text-foreground">{s.desc}</span>
                  <SeverityPill tone={s.best ? "amber" : "neutral"}>{s.best ? "Best match" : "Alternative"}</SeverityPill>
                </div>
                <div className="text-[11.5px] text-muted-foreground italic">{s.reason}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-muted-foreground/80 text-center">
            Sources: USITC HTS revision 14, 2026. Last updated 2026-04-12.
          </p>
        </div>
      </SectionShell>

      <SectionShell tone="default" title="How the AI actually works." headingAlign="center">
        <ul className="grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
          {HOW_IT_WORKS.map((c) => (
            <li key={c.title} className="rounded-2xl border border-border/60 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      <SectionShell tone="default" title="Common questions.">
        <div className="mx-auto max-w-3xl">
          <ul className="divide-y divide-border/40">
            {FAQ.map((item) => (
              <li key={item.q} className="py-5">
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      <SectionShell tone="muted" headingAlign="center" title="Want AI on your next filing?">
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
