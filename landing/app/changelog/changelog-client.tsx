"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { SeverityPill } from "@/components/ui/severity-pill";
import { GOLD } from "@/lib/colors";

import {
  CHANGELOG_ENTRIES,
  KIND_LABEL,
  KIND_TONE,
  formatChangelogDate,
} from "@/lib/changelog";

const EASE = [0.22, 1, 0.36, 1] as const;


export function ChangelogClient() {
  return (
    <>
      <PageHero
        label="Changelog"
        title="What shipped, when."
        description="Hand-curated release notes, reverse chronological. We ship every weekday — these are the ones worth telling you about."
        breadcrumbs={[{ label: "Changelog", href: "/changelog" }]}
        illustration={<ChangelogHeroIllustration />}
      />

      <SectionShell tone="default">
        <ol className="space-y-10">
          {CHANGELOG_ENTRIES.map((entry) => (
            <li key={entry.date + entry.title} className="grid gap-6 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-3">
                <div className="sticky top-24">
                  <time className="font-mono text-[12.5px] font-semibold tabular-nums text-muted-foreground">
                    {formatChangelogDate(entry.date)}
                  </time>
                  <div className="mt-2">
                    <SeverityPill tone={KIND_TONE[entry.kind]}>{KIND_LABEL[entry.kind]}</SeverityPill>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-9">
                <article className="rounded-2xl border border-border/60 bg-card p-6">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground mb-3">
                    {entry.title}
                  </h2>
                  <p className="text-[14.5px] text-muted-foreground leading-relaxed mb-4">
                    {entry.body}
                  </p>
                  {entry.link && (
                    <Link
                      href={entry.link.href}
                      className="text-sm font-semibold text-foreground hover:text-gold transition-colors"
                    >
                      → {entry.link.label}
                    </Link>
                  )}
                </article>
              </div>
            </li>
          ))}
        </ol>
      </SectionShell>

      <SectionShell tone="muted" headingAlign="center" title="Try it out yourself.">
        <p className="mx-auto max-w-xl text-center text-base leading-relaxed mb-8 opacity-80">
          Book a walkthrough and we&apos;ll get you provisioned. Drafts are free — you only
          pay per shipment when we file for you. See the inbox we&apos;re building from the inside.
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

/* ============================================================================
 * Hero illustration — "The ship stream"
 *
 * A vertical release timeline that never stops: the spine draws in, four
 * release nodes pop on, the newest one pulses ("SHIPPING NOW"), and every
 * ~5s a fresh release slides in at the top while the oldest exits below —
 * the visual argument for "we ship every weekday".
 * ==========================================================================*/

type FeedKind = "new" | "improved" | "fix";
type FeedEntry = { date: string; title: string; kind: FeedKind };

// The four launch nodes (index 0 = newest, at the top of the stream).
const FEED_INITIAL: FeedEntry[] = [
  { date: "JUL 13", title: "Live status strip", kind: "new" },
  { date: "JUL 8", title: "MFA for every account", kind: "new" },
  { date: "JUL 8", title: "Platform pages redesign", kind: "improved" },
  { date: "JUL 3", title: "Homepage rework", kind: "improved" },
];

// Deterministic pool cycled by index for the endless feed. No randomness —
// content is a pure function of stream position (SSR-safe).
const FEED_POOL: FeedEntry[] = [
  { date: "JUL 14", title: "Email OTP fallback", kind: "new" },
  { date: "JUL 15", title: "Scroll-linked automation hero", kind: "improved" },
  { date: "JUL 15", title: "Per-route canonicals", kind: "fix" },
  { date: "JUL 16", title: "Magnetic CTAs", kind: "improved" },
  { date: "JUL 17", title: "AI chat handoff", kind: "new" },
  { date: "JUL 17", title: "Rails marquee", kind: "improved" },
  { date: "JUL 18", title: "Case-insensitive login", kind: "fix" },
];

// Stream position p: larger = newer. p <= 0 maps into FEED_INITIAL,
// p > 0 cycles the pool forever.
function feedItemAt(p: number): FeedEntry {
  if (p <= 0) return FEED_INITIAL[-p];
  return FEED_POOL[(p - 1) % FEED_POOL.length];
}

const SPINE_X = 110;
const SLOT_Y = [80, 140, 200, 260, 320]; // slot 4 = exit slot (fades out)
const CARD_X = 132;
const CARD_W = 290;

const FEED_PILL: Record<FeedKind, { label: string; w: number; gold: boolean }> = {
  new: { label: "NEW", w: 34, gold: true },
  improved: { label: "IMPROVED", w: 58, gold: false },
  fix: { label: "FIX", w: 30, gold: false },
};

/** One node's contents in local coords (y=0 is the slot centerline). */
function FeedNodeBody({ item, top }: { item: FeedEntry; top: boolean }) {
  const pill = FEED_PILL[item.kind];
  const pillX = CARD_X + CARD_W - 12 - pill.w;
  return (
    <>
      {/* Node dot on the spine + tick into the card */}
      <circle cx={SPINE_X} cy={0} r={4} fill="currentColor" fillOpacity={0.85} stroke="none" />
      <line x1={SPINE_X + 6} y1={0} x2={CARD_X} y2={0} strokeOpacity={0.25} strokeWidth={1} />

      {/* Entry card */}
      <rect
        x={CARD_X}
        y={-20}
        width={CARD_W}
        height={40}
        rx={9}
        fill="currentColor"
        fillOpacity={0.04}
        strokeOpacity={0.22}
        strokeWidth={1}
      />
      <text
        x={CARD_X + 14}
        y={-4.5}
        fontSize={8}
        letterSpacing={0.8}
        fill="currentColor"
        fillOpacity={0.65}
        stroke="none"
        style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
      >
        {item.date}
      </text>
      <text
        x={CARD_X + 14}
        y={10.5}
        fontSize={9.5}
        fontWeight={600}
        fill="currentColor"
        fillOpacity={0.9}
        stroke="none"
      >
        {item.title}
      </text>

      {/* Kind pill */}
      <rect
        x={pillX}
        y={-7}
        width={pill.w}
        height={14}
        rx={7}
        fill={pill.gold ? GOLD : "currentColor"}
        fillOpacity={pill.gold ? 0.14 : 0.06}
        stroke={pill.gold ? GOLD : "currentColor"}
        strokeOpacity={pill.gold ? 0.4 : 0.3}
        strokeWidth={1}
      />
      <text
        x={pillX + pill.w / 2}
        y={2.8}
        textAnchor="middle"
        fontSize={7}
        fontWeight={600}
        letterSpacing={0.8}
        fill={pill.gold ? GOLD : "currentColor"}
        fillOpacity={pill.gold ? 1 : 0.7}
        stroke="none"
      >
        {pill.label}
      </text>

      {/* Live treatment on the top node: gold core + caption left of the spine */}
      {top && (
        <>
          <circle cx={SPINE_X} cy={0} r={2.4} fill={GOLD} stroke="none" />
          {/* fill via text-* classes so light mode gets the darker gold
              (bright gold at 7px vanishes on the light background). */}
          <text
            x={SPINE_X - 14}
            y={2.8}
            textAnchor="end"
            fontSize={7}
            fontWeight={600}
            letterSpacing={1}
            fill="currentColor"
            stroke="none"
            className="text-gold-dark dark:text-gold"
          >
            SHIPPING NOW
          </text>
        </>
      )}
    </>
  );
}

function ChangelogHeroIllustration() {
  const reduced = useReducedMotion();
  // Number of releases that have arrived since mount; drives which stream
  // positions occupy which slots. Advanced by interval, never by Date.now().
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setOffset((o) => o + 1), 5000);
    return () => clearInterval(id);
  }, [reduced]);

  const svgProps = {
    viewBox: "0 0 480 360",
    className: "w-full max-w-md h-auto text-foreground/90",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  const glow = (
    <>
      <defs>
        <radialGradient id="chl-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.15" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="190" rx="210" ry="150" fill="url(#chl-glow)" stroke="none" />
    </>
  );

  // Reduced motion: the four launch nodes, static. No pulse, no timers.
  if (reduced) {
    return (
      <svg {...svgProps} aria-hidden>
        {glow}
        <line x1={SPINE_X} y1={60} x2={SPINE_X} y2={320} strokeOpacity={0.25} />
        {FEED_INITIAL.map((item, s) => (
          <g key={item.title} transform={`translate(0, ${SLOT_Y[s]})`}>
            <FeedNodeBody item={item} top={s === 0} />
          </g>
        ))}
      </svg>
    );
  }

  return (
    <motion.svg {...svgProps} aria-hidden>
      {glow}

      {/* Timeline spine draws downward */}
      <motion.line
        x1={SPINE_X}
        y1={60}
        x2={SPINE_X}
        y2={320}
        strokeOpacity={0.25}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
      />

      {/* Slots 0..4; the node in slot s holds stream position offset - s.
          Keys are the stream position (content identity), so React reuses
          elements across ticks and framer tweens the y between slots. */}
      {SLOT_Y.map((slotY, s) => {
        const p = offset - s;
        if (p < -(FEED_INITIAL.length - 1)) return null; // below the launch set
        const item = feedItemAt(p);
        const isArrival = p > 0; // mounted mid-loop, slides in from above
        return (
          <motion.g
            key={p}
            initial={
              isArrival
                ? { y: SLOT_Y[0] - 52, opacity: 0 }
                : { y: slotY + 10, opacity: 0 }
            }
            animate={{ y: slotY, opacity: s === 4 ? 0 : 1 }}
            transition={{
              duration: 0.7,
              ease: EASE,
              delay: offset === 0 ? 0.5 + s * 0.2 : 0,
            }}
          >
            <FeedNodeBody item={item} top={s === 0} />

            {/* Radar ping on the live node only */}
            {s === 0 && (
              <motion.circle
                cx={SPINE_X}
                cy={0}
                r={7}
                stroke={GOLD}
                strokeWidth={1.2}
                fill="none"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: offset === 0 ? 1.4 : 0.4,
                }}
              />
            )}
          </motion.g>
        );
      })}
    </motion.svg>
  );
}
