"use client";

import { motion } from "framer-motion";
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
  3. Re-submit — the bond carries over`;

const PREFLIGHT_TEXT = `Pre-flight on INV-4502: 1 warning.

HTS 6204.62.40 (women's trousers) has
ADD/CVD watch for Chinese-origin goods.
Confirm origin before submitting — could
trigger an additional duty deposit.`;

const HTS_SUGGESTIONS = [
  { code: "6115.96.6010", desc: "Stockings, socks — Knit — Of cotton", best: true, reason: "Best match — polyester is a synthetic fiber and athletic socks are typically knit." },
  { code: "6115.95.6020", desc: "Stockings, socks — Synthetic fibers", best: false, reason: "Alternative — but 'cotton' subheading often used for blended athletic socks." },
  { code: "6115.99.1410", desc: "Stockings, socks — Other textile materials", best: false, reason: "Fallback for blends with no dominant material." },
];

const HOW_IT_WORKS = [
  { title: "The model", body: "gpt-4o via OpenAI. We send only the filing data plus the CBP response. We do not send your AR data, banking, billing, or other unrelated tenant data." },
  { title: "The gate", body: "Gated by your team's enable flag — admin can toggle AI off per-team or per-feature. Rule-based fallback is always available." },
  { title: "Your data", body: "Your data is not used for model training. OpenAI's API tier we use has zero-retention by contract." },
];

const FAQ = [
  { q: "Is the AI required to use MyCargoLens?", a: "No. AI is opt-in per team. The rule-based gate runs on every filing regardless." },
  { q: "How long does AI Coach take to respond?", a: "First token typically 1.5–3 seconds. Full numbered fix steps in 6–12 seconds. Streams as it generates." },
  { q: "What if the AI gets it wrong?", a: "You're the final reviewer. Every fix step is suggested, not auto-applied. You always click submit." },
  { q: "Does the AI know my templates?", a: "Yes — pre-flight reads your saved templates to suggest field reuse and flag inconsistencies." },
  { q: "Can I disable AI for sensitive filings?", a: "Yes. Mark any draft as 'AI off' and it bypasses Coach + pre-flight regardless of team setting." },
];

const EASE = [0.22, 1, 0.36, 1] as const;
import { GOLD } from "@/lib/colors";

function HeroAIIllustration() {
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
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {/* === Backdrop dot grid ============================================ */}
      <defs>
        <pattern id="ai-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" fillOpacity="0.08" stroke="none" />
        </pattern>
        <radialGradient id="ai-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.18" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="260" cy="180" rx="180" ry="140" fill="url(#ai-glow)" stroke="none" />

      {/* === User message bubble (top right) ============================= */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: 12, x: 12 },
          visible: { opacity: 1, y: 0, x: 0, transition: { duration: 0.6, ease: EASE } },
        }}
      >
        <rect
          x="240"
          y="32"
          width="210"
          height="44"
          rx="14"
          fill={GOLD}
          fillOpacity="0.14"
          stroke={GOLD}
          strokeOpacity="0.35"
        />
        <line x1="258" y1="56" x2="412" y2="56" strokeOpacity="0.55" />
        <circle cx="432" cy="54" r="4" fill={GOLD} stroke="none" />
      </motion.g>

      {/* === Connector line user → bot =================================== */}
      <motion.path
        d="M340 80 Q 270 110 200 130"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeDasharray="4 4"
        variants={{
          hidden: { pathLength: 0 },
          visible: { pathLength: 1, transition: { duration: 0.9, ease: EASE, delay: 0.2 } },
        }}
      />

      {/* === Bot avatar (left middle) ==================================== */}
      <motion.g
        variants={{
          hidden: { opacity: 0, scale: 0.7 },
          visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: EASE, delay: 0.3 } },
        }}
      >
        <circle cx="78" cy="156" r="22" fill="currentColor" fillOpacity="0.04" strokeOpacity="0.55" />
        {/* Bot face — antenna + eyes + smile */}
        <line x1="78" y1="128" x2="78" y2="134" strokeOpacity="0.6" />
        <circle cx="78" cy="125" r="2" fill={GOLD} stroke="none" />
        <circle cx="72" cy="154" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="84" cy="154" r="1.6" fill="currentColor" stroke="none" />
        <path d="M70 162 Q 78 167 86 162" strokeOpacity="0.7" />
        {/* Pulse ring */}
        <motion.circle
          cx="78"
          cy="156"
          r="22"
          stroke={GOLD}
          strokeOpacity="0.4"
          fill="none"
          animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "78px 156px" }}
        />
      </motion.g>

      {/* === Main AI response bubble ===================================== */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: 12 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay: 0.4 } },
        }}
      >
        <rect
          x="116"
          y="118"
          width="320"
          height="180"
          rx="16"
          fill="currentColor"
          fillOpacity="0.03"
          strokeOpacity="0.55"
        />
        {/* Header pill: "AI Coach · streaming" */}
        <rect x="132" y="132" width="92" height="16" rx="4" fill="currentColor" fillOpacity="0.06" stroke="none" />
        <text
          x="142"
          y="143"
          fontSize="8"
          fontFamily="ui-monospace, monospace"
          fontWeight="700"
          letterSpacing="0.8"
          fill="currentColor"
          fillOpacity="0.65"
          stroke="none"
        >
          AI COACH · STREAMING
        </text>

        {/* First "sentence" line */}
        <motion.line
          x1="132"
          y1="172"
          x2="424"
          y2="172"
          strokeOpacity="0.55"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, delay: 1.0, ease: EASE }}
        />
        <motion.line
          x1="132"
          y1="186"
          x2="356"
          y2="186"
          strokeOpacity="0.4"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.0, delay: 1.3, ease: EASE }}
        />

        {/* Numbered fix steps */}
        {[218, 240, 262].map((y, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 1.7 + i * 0.25, ease: EASE }}
          >
            <circle
              cx="142"
              cy={y}
              r="7"
              fill={GOLD}
              fillOpacity="0.16"
              stroke={GOLD}
              strokeWidth="1.5"
            />
            <text
              x="142"
              y={y + 2.6}
              fontSize="8"
              textAnchor="middle"
              fontFamily="ui-sans-serif, sans-serif"
              fontWeight="700"
              fill={GOLD}
              stroke="none"
            >
              {i + 1}
            </text>
            <line x1="158" y1={y} x2={i === 0 ? 392 : i === 1 ? 376 : 410} y2={y} strokeOpacity="0.5" />
          </motion.g>
        ))}

        {/* Streaming caret */}
        <motion.rect
          x="424"
          y="276"
          width="2"
          height="12"
          fill={GOLD}
          stroke="none"
          animate={{ opacity: [1, 0.1, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.g>

      {/* === Floating accent chips (HTS · UFLPA · ADD/CVD) =============== */}
      {[
        { x: 32, y: 60, label: "HTS", delay: 1.4 },
        { x: 20, y: 220, label: "UFLPA", delay: 1.6 },
        { x: 30, y: 296, label: "ADD/CVD", delay: 1.8 },
      ].map((chip) => (
        <motion.g
          key={chip.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: chip.delay, ease: EASE }}
        >
          <motion.g
            animate={{ y: [0, -3, 0] }}
            transition={{
              duration: 5 + chip.delay,
              repeat: Infinity,
              ease: "easeInOut",
              delay: chip.delay,
            }}
          >
            <rect
              x={chip.x}
              y={chip.y}
              width="68"
              height="22"
              rx="6"
              fill="currentColor"
              fillOpacity="0.04"
              strokeOpacity="0.55"
            />
            <circle cx={chip.x + 9} cy={chip.y + 11} r="2.5" fill={GOLD} stroke="none" />
            <text
              x={chip.x + 17}
              y={chip.y + 14}
              fontSize="9"
              fontFamily="ui-sans-serif, sans-serif"
              fontWeight="600"
              fill="currentColor"
              fillOpacity="0.78"
              stroke="none"
            >
              {chip.label}
            </text>
          </motion.g>
        </motion.g>
      ))}

      {/* === Sparkles ==================================================== */}
      <g stroke={GOLD} strokeOpacity="0.85" strokeWidth="1.6">
        <motion.path
          d="M438 64 v10 M443 69 h-10"
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.18, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "438px 69px" }}
        />
        <motion.path
          d="M126 56 v6 M129 59 h-6"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        />
        <motion.path
          d="M448 330 v6 M451 333 h-6"
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
        />
      </g>
    </motion.svg>
  );
}

export function AiClient() {
  return (
    <>
      <PageHero
        label="Platform"
        title="Plain English explains every CBP rejection."
        description="Built on gpt-4o. Reads your filing, your party data, and the CBP response. Streams numbered fix steps. Gated behind your team's enable flag — toggle off anytime."
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
                "Three drafts waiting on you. Run an AI pre-flight before submitting — one rejection blocking re-file."
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
            <h3 className="text-base font-semibold text-foreground mb-2">AI Coach — rejection mode</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
              When CBP rejects, the Coach reads the error code, your filing, and party data — then streams numbered fix steps.
            </p>
            <CodeStream variant="chat" replayOnView speed={18} text={REJECTION_TEXT} ariaLabel="AI rejection example" className="h-[260px] overflow-hidden" />
          </li>

          <li className="rounded-2xl border border-border/60 bg-card p-5 flex flex-col min-h-[520px]">
            <IconTile icon={Sparkles} hover="wiggle" reveal revealDelay={0.16} className="size-9 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-2">AI Coach — pre-flight mode</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
              Reviews the entire draft for UFLPA risks, PGA flags, HTS issues, and rule-based gates before you submit.
            </p>
            <CodeStream variant="chat" replayOnView speed={18} text={PREFLIGHT_TEXT} ariaLabel="AI pre-flight example" className="h-[260px] overflow-hidden" />
          </li>
        </ul>
      </SectionShell>

      <SectionShell tone="muted" eyebrow="HTS Classifier" title="Describe goods, get the right HTS code.">
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

      <SectionShell tone="default" eyebrow="Under the hood" title="How the AI actually works." headingAlign="center">
        <ul className="grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
          {HOW_IT_WORKS.map((c) => (
            <li key={c.title} className="rounded-2xl border border-border/60 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      <SectionShell tone="muted" eyebrow="FAQ" title="Common questions.">
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

      <SectionShell tone="default" headingAlign="center" title="Want AI on your next filing?">
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
