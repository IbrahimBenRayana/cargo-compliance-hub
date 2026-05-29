"use client";

import Link from "next/link";
import * as React from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Check, Layers, Sparkles, Wallet, Zap } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";
const EMERALD = "hsl(160 84% 39%)";

/**
 * Pricing hero — a stylized "shopping decision" composition. Three tier
 * tablets fanned out, the featured Grower tier rising, an animated gold
 * spotlight tracking across it, a counting "$49" big number, a tiny bar
 * chart suggesting filing volume → price, and an arrow nudging toward
 * the recommended pick. More dynamic + sells the "this is the one" feel.
 */
function PricingHeroIllustration() {
  // Animated counting price for the featured tier
  const animatedPrice = useMotionValue(0);
  const displayPrice = useTransform(animatedPrice, (v) => `$${Math.round(v)}`);
  React.useEffect(() => {
    const controls = animate(animatedPrice, 49, {
      duration: 1.4,
      delay: 0.6,
      ease: EASE,
    });
    return controls.stop;
  }, [animatedPrice]);

  const tiers = [
    { x: 36, y: 144, w: 110, h: 156, tag: "STARTER", price: "$0", per: "free", rotate: -6, delay: 0 },
    { x: 178, y: 80, w: 138, h: 222, tag: "GROWER", price: "$49", per: "/mo", rotate: 0, delay: 0.15, featured: true },
    { x: 340, y: 144, w: 110, h: 156, tag: "SCALE", price: "$149", per: "/mo", rotate: 6, delay: 0.3 },
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
        <radialGradient id="pr-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.20" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pr-featured-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.22" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="pr-spotlight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id="pr-grower-clip">
          <rect x="178" y="80" width="138" height="222" rx="12" />
        </clipPath>
      </defs>
      <ellipse cx="240" cy="190" rx="220" ry="150" fill="url(#pr-glow)" stroke="none" />

      {/* Side tablets — STARTER (left) and SCALE (right), slightly tilted */}
      {tiers
        .filter((t) => !t.featured)
        .map((t) => (
          <motion.g
            key={t.tag}
            variants={{
              hidden: { opacity: 0, y: 14, rotate: t.rotate * 1.8 },
              visible: {
                opacity: 1,
                y: 0,
                rotate: t.rotate,
                transition: { duration: 0.65, ease: EASE, delay: t.delay },
              },
            }}
            style={{ transformOrigin: `${t.x + t.w / 2}px ${t.y + t.h / 2}px` }}
          >
            <motion.g
              animate={{ y: [0, -2.5, 0] }}
              transition={{ duration: 5 + t.delay, repeat: Infinity, ease: "easeInOut", delay: t.delay }}
            >
              <rect
                x={t.x}
                y={t.y}
                width={t.w}
                height={t.h}
                rx="12"
                fill="currentColor"
                fillOpacity="0.04"
                strokeOpacity="0.5"
              />
              <text
                x={t.x + t.w / 2}
                y={t.y + 22}
                textAnchor="middle"
                fontSize="9"
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight="700"
                letterSpacing="1.4"
                fill="currentColor"
                fillOpacity="0.55"
                stroke="none"
              >
                {t.tag}
              </text>
              <line x1={t.x + 16} y1={t.y + 32} x2={t.x + t.w - 16} y2={t.y + 32} strokeOpacity="0.25" />
              <text
                x={t.x + t.w / 2}
                y={t.y + 70}
                textAnchor="middle"
                fontSize="22"
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight="700"
                fill="currentColor"
                stroke="none"
              >
                {t.price}
              </text>
              <text
                x={t.x + t.w / 2}
                y={t.y + 86}
                textAnchor="middle"
                fontSize="9"
                fontFamily="ui-sans-serif, sans-serif"
                fontWeight="500"
                fill="currentColor"
                fillOpacity="0.55"
                stroke="none"
              >
                {t.per}
              </text>
              {[104, 120, 136].map((dy, i) => (
                <g key={dy}>
                  <circle cx={t.x + 18} cy={t.y + dy} r="2" fill={EMERALD} stroke="none" />
                  <line
                    x1={t.x + 26}
                    y1={t.y + dy}
                    x2={t.x + t.w - 16 - i * 4}
                    y2={t.y + dy}
                    strokeOpacity="0.35"
                  />
                </g>
              ))}
            </motion.g>
          </motion.g>
        ))}

      {/* === GROWER (featured) — raised, with halo + spotlight + counting price === */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: 24, scale: 0.94 },
          visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE, delay: 0.2 } },
        }}
        style={{ transformOrigin: "247px 191px" }}
      >
        <motion.g
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Outer pulse halo */}
          <motion.rect
            x="170"
            y="72"
            width="154"
            height="238"
            rx="14"
            stroke={GOLD}
            strokeOpacity="0.45"
            fill="none"
            animate={{ opacity: [0.4, 0.85, 0.4] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Card body w/ gold gradient fill */}
          <rect x="178" y="80" width="138" height="222" rx="12" fill="url(#pr-featured-fill)" stroke={GOLD} strokeWidth="2" />

          {/* Animated diagonal spotlight sweeping across the card every ~6s.
              stroke="none" is required: the parent <svg> sets
              stroke="currentColor", which would otherwise render the rect
              edges as a hard dark vertical line that travels with the sweep. */}
          <motion.g clipPath="url(#pr-grower-clip)">
            <motion.rect
              x="-60"
              y="80"
              width="120"
              height="222"
              fill="url(#pr-spotlight)"
              stroke="none"
              animate={{ x: [-60, 360] }}
              transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut", delay: 1 }}
            />
          </motion.g>

          {/* "Most popular" pill */}
          <rect x="200" y="62" width="94" height="20" rx="10" fill={GOLD} />
          <text x="247" y="76" textAnchor="middle" fontSize="9" fontFamily="ui-sans-serif, sans-serif" fontWeight="700" letterSpacing="0.6" fill="hsl(35, 90%, 18%)" stroke="none">
            MOST POPULAR
          </text>

          {/* Tag */}
          <text x="247" y="106" textAnchor="middle" fontSize="10" fontFamily="ui-sans-serif, sans-serif" fontWeight="800" letterSpacing="1.6" fill={GOLD} stroke="none">
            GROWER
          </text>
          <line x1="194" y1="116" x2="300" y2="116" stroke={GOLD} strokeOpacity="0.35" />

          {/* Big counting price */}
          <motion.text
            x="247"
            y="172"
            textAnchor="middle"
            fontSize="36"
            fontFamily="ui-sans-serif, sans-serif"
            fontWeight="800"
            fill="currentColor"
            stroke="none"
          >
            {displayPrice}
          </motion.text>
          <text x="247" y="190" textAnchor="middle" fontSize="10" fontFamily="ui-sans-serif, sans-serif" fontWeight="500" fill="currentColor" fillOpacity="0.55" stroke="none">
            per month
          </text>

          {/* Feature lines */}
          {[208, 226, 244, 262, 280].map((dy, i) => (
            <motion.g
              key={dy}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.9 + i * 0.1 }}
            >
              <circle cx="196" cy={dy} r="2.5" fill={GOLD} stroke="none" />
              <line x1="206" y1={dy} x2={300 - (i % 2) * 14} y2={dy} strokeOpacity="0.45" />
            </motion.g>
          ))}
        </motion.g>
      </motion.g>

      {/* Mini bar chart at top-right suggesting volume → price scaling */}
      <motion.g
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.6, delay: 0.7 } },
        }}
      >
        {[
          { x: 376, h: 8, color: EMERALD },
          { x: 386, h: 14, color: EMERALD },
          { x: 396, h: 22, color: GOLD },
          { x: 406, h: 18, color: EMERALD },
          { x: 416, h: 28, color: GOLD },
          { x: 426, h: 24, color: EMERALD },
          { x: 436, h: 34, color: GOLD },
        ].map((bar, i) => (
          <motion.rect
            key={bar.x}
            x={bar.x}
            y={42 - bar.h + 32}
            width="6"
            height={bar.h}
            rx="1"
            fill={bar.color}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: 0.9 + i * 0.06, ease: EASE }}
            style={{ transformOrigin: `${bar.x + 3}px ${74}px` }}
          />
        ))}
        <text x="404" y="84" textAnchor="middle" fontSize="7" fontFamily="ui-monospace, monospace" fontWeight="600" fill="currentColor" fillOpacity="0.55" stroke="none">
          FILINGS / MO
        </text>
      </motion.g>

      {/* Arrow pointing at the recommended tier */}
      <motion.g
        variants={{
          hidden: { opacity: 0, y: -6 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 1.4 } },
        }}
      >
        <motion.g
          animate={{ y: [0, 3, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M 247 36 L 247 56" stroke={GOLD} strokeWidth="2" />
          <path d="M 240 50 L 247 58 L 254 50" stroke={GOLD} strokeWidth="2" fill="none" />
          <text x="278" y="46" fontSize="9" fontFamily="ui-sans-serif, sans-serif" fontWeight="700" letterSpacing="0.8" fill={GOLD} stroke="none">
            start here
          </text>
        </motion.g>
      </motion.g>

      {/* Footer stamp */}
      <motion.g
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.5, delay: 1.6 } },
        }}
      >
        <circle cx="60" cy="338" r="2.5" fill={EMERALD} stroke="none">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <text x="72" y="342" fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight="600" fill="currentColor" fillOpacity="0.55" stroke="none">
          no credit card · cancel anytime
        </text>
      </motion.g>
    </motion.svg>
  );
}

type Tier = {
  id: string;
  name: string;
  blurb: string;
  price: string;
  per: string;
  filingsIncluded: string;
  overage: string;
  cta: string;
  ctaHref: string;
  featured?: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "For your first shipments. Forever free.",
    price: "$0",
    per: "forever",
    filingsIncluded: "2 filings / mo",
    overage: "Upgrade after",
    cta: "Start free",
    ctaHref: "https://app.mycargolens.com/register",
    features: [
      "ISF-10, ISF-5, Entry, In-Bond",
      "AI Coach — rejection mode",
      "Action queue + Today's brief",
      "PDF export at any stage",
      "1 user",
    ],
  },
  {
    id: "grower",
    name: "Grower",
    blurb: "When the volume picks up. Most teams start here.",
    price: "$49",
    per: "per month",
    filingsIncluded: "25 filings / mo",
    overage: "$2 / filing after",
    cta: "Start free trial",
    ctaHref: "https://app.mycargolens.com/register",
    featured: true,
    features: [
      "Everything in Starter, plus",
      "AI Pre-flight on every draft",
      "Templates + duplicate + bulk submit",
      "UFLPA Risk Inbox + PGA flags",
      "ADD/CVD daily sync from Federal Register",
      "Up to 5 users with RBAC",
      "Email notifications",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    blurb: "Brokerages and high-volume importers.",
    price: "$149",
    per: "per month",
    filingsIncluded: "100 filings / mo",
    overage: "$1 / filing after",
    cta: "Start free trial",
    ctaHref: "https://app.mycargolens.com/register",
    features: [
      "Everything in Grower, plus",
      "Liquidation pipeline (314-day clock)",
      "Manifest queries by Master BOL",
      "FTA Preference Calculator (17 programs)",
      "Unlimited users with RBAC",
      "Audit log export (CSV)",
      "Priority support",
    ],
  },
];

type CompareRow = {
  feature: string;
  starter: string | boolean;
  grower: string | boolean;
  scale: string | boolean;
};

type CompareGroup = {
  id: string;
  label: string;
  rows: CompareRow[];
};

const COMPARE_GROUPS: CompareGroup[] = [
  {
    id: "limits",
    label: "Limits & billing",
    rows: [
      { feature: "Monthly filings included", starter: "2", grower: "25", scale: "100" },
      { feature: "Overage rate", starter: "—", grower: "$2/filing", scale: "$1/filing" },
      { feature: "Users", starter: "1", grower: "Up to 5", scale: "Unlimited" },
    ],
  },
  {
    id: "filings",
    label: "Filing types",
    rows: [
      { feature: "ISF-10 / ISF-5 / Entry / In-Bond", starter: true, grower: true, scale: true },
      { feature: "Templates + bulk submit", starter: false, grower: true, scale: true },
      { feature: "Manifest queries by MBOL", starter: false, grower: false, scale: true },
    ],
  },
  {
    id: "ai",
    label: "AI",
    rows: [
      { feature: "AI Coach (rejection mode)", starter: true, grower: true, scale: true },
      { feature: "AI Pre-flight (before submit)", starter: false, grower: true, scale: true },
      { feature: "Today's AI brief", starter: true, grower: true, scale: true },
    ],
  },
  {
    id: "compliance",
    label: "Compliance Center",
    rows: [
      { feature: "Action queue + Today's brief", starter: true, grower: true, scale: true },
      { feature: "UFLPA Risk Inbox", starter: false, grower: true, scale: true },
      { feature: "ADD/CVD daily sync (Fed Register)", starter: false, grower: true, scale: true },
      { feature: "FTA Preference Calculator (17)", starter: false, grower: false, scale: true },
      { feature: "Liquidation pipeline (314-day clock)", starter: false, grower: false, scale: true },
    ],
  },
  {
    id: "ops",
    label: "Team & operations",
    rows: [
      { feature: "Email notifications", starter: false, grower: true, scale: true },
      { feature: "Audit log export (CSV)", starter: false, grower: false, scale: true },
      { feature: "Priority support", starter: false, grower: false, scale: true },
    ],
  },
];

const FAQ = [
  {
    q: "What counts as a \"filing\"?",
    a: "Any successful submission to CBP — ISF-10, ISF-5, Entry Summary (7501), Entry (3461), or In-Bond. Rejected re-submits of the same filing don't count again. Manifest queries are free.",
  },
  {
    q: "What happens if I hit my plan limit mid-month?",
    a: "A calm plan-limit modal appears. You can either keep going at the overage rate or upgrade. We never block a filing — your shipments don't wait for billing.",
  },
  {
    q: "Can I downgrade?",
    a: "Anytime. Downgrades take effect at the next billing cycle. Your existing data stays exactly where it is.",
  },
  {
    q: "Is there a setup fee?",
    a: "No. No setup fee, no onboarding fee, no per-user fee (within plan limits), no implementation contract.",
  },
  {
    q: "Do you offer enterprise pricing for high-volume brokerages?",
    a: "Yes — for 250+ filings/month or 25+ users, talk to us about Scale+. Same product, custom volume terms.",
  },
];

function TierCard({ tier, index }: { tier: Tier; index: number }) {
  // The featured tier gets a subtle radial gradient + thicker accent +
  // an animated topline that sweeps once on entry.
  return (
    <motion.li
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: EASE, delay: index * 0.08 }}
      className={cn(
        "group relative rounded-2xl p-7 transition-all duration-300",
        // overflow-visible (default) lets the "Most popular" badge sit
        // above the top edge. We bound the internal gradient layer to
        // the card's rounded box with its own overflow-hidden span.
        tier.featured
          ? "border-2 border-gold bg-card ring-1 ring-gold/15 shadow-gold lg:-mt-4 lg:mb-4 lg:scale-[1.03]"
          : "border border-border/60 bg-card hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-card-hover",
      )}
    >
      {/* Featured tier: subtle radial gradient + animated top accent line.
          Both effects live inside a clipped wrapper so they respect the
          card's rounded corners; the badge sits OUTSIDE that wrapper so
          it can sit above the top edge. */}
      {tier.featured && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
          >
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 100% 80% at 50% 0%, hsl(43 96% 56% / 0.10) 0%, transparent 70%)",
              }}
            />
            <motion.span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.3 }}
            />
          </span>
          {/* Opaque pill — sits on top of the card's gold border, so its
              background must be fully solid (not translucent) so the border
              underneath isn't visible through it. */}
          <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
            <span className="inline-flex items-center justify-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10.5px] font-semibold text-amber-800 ring-1 ring-amber-500/40 shadow-card-hover dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-400/40">
              <Sparkles size={11} className="-ml-0.5" />
              <span>Most popular</span>
            </span>
          </div>
        </>
      )}

      {/* Header */}
      <div className="mb-5">
        <h3
          className={cn(
            "mb-1.5 text-xl font-semibold tracking-tight",
            tier.featured && "text-foreground",
          )}
        >
          {tier.name}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{tier.blurb}</p>
      </div>

      {/* Price block */}
      <div
        className={cn(
          "mb-6 rounded-xl border px-4 py-4",
          tier.featured
            ? "border-gold/30 bg-gold/[0.06]"
            : "border-border/50 bg-background/40",
        )}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[44px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {tier.price}
          </span>
          <span className="text-sm text-muted-foreground">{tier.per}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11.5px] font-mono tabular-nums">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-semibold",
              tier.featured
                ? "bg-gold/15 text-gold-dark dark:text-gold"
                : "bg-secondary text-foreground/75",
            )}
          >
            {tier.filingsIncluded}
          </span>
          <span className="text-muted-foreground/70">{tier.overage}</span>
        </div>
      </div>

      <Button
        variant={tier.featured ? "gold" : "outline"}
        size="lg"
        className="mb-6 w-full"
        asChild
      >
        <a href={tier.ctaHref}>{tier.cta}</a>
      </Button>

      {/* Feature list */}
      <ul className="space-y-2.5">
        {tier.features.map((f, i) => (
          <motion.li
            key={f}
            initial={{ opacity: 0, x: -4 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.04 }}
            className="flex items-start gap-2.5 text-[13px] text-foreground/85"
          >
            <span
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                tier.featured ? "bg-gold/20 text-gold-dark dark:text-gold" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
              )}
            >
              <Check size={10} strokeWidth={3} />
            </span>
            <span className="leading-snug">{f}</span>
          </motion.li>
        ))}
      </ul>
    </motion.li>
  );
}

function CellValue({
  value,
  featured = false,
}: {
  value: string | boolean;
  featured?: boolean;
}) {
  if (value === true) {
    return (
      <span
        className={cn(
          "mx-auto grid size-6 place-items-center rounded-full",
          featured
            ? "bg-gold/20 text-gold-dark ring-1 ring-gold/30 dark:text-gold"
            : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        )}
      >
        <Check size={12} strokeWidth={3} />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="mx-auto block w-fit text-muted-foreground/35" aria-label="not included">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "font-mono text-[12px] tabular-nums",
        featured && "font-semibold text-foreground",
      )}
    >
      {value}
    </span>
  );
}

export function PricingPageClient() {
  return (
    <>
      <PageHero
        label="Pricing"
        title="Priced by filings. Nothing sneaky."
        description="Start free with 2 filings per month. Upgrade when you need more volume. No per-feature gotchas, no setup fees, no long-term contracts. Cancel anytime."
        breadcrumbs={[{ label: "Pricing", href: "/pricing" }]}
        illustration={<PricingHeroIllustration />}
      />

      {/* TIER CARDS */}
      <SectionShell tone="default">
        <ul className="grid gap-6 md:grid-cols-3 items-start">
          {TIERS.map((t, i) => (
            <TierCard key={t.id} tier={t} index={i} />
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
          {[
            { icon: Wallet, text: "No credit card required" },
            { icon: Zap, text: "Cancel any time" },
            { icon: Sparkles, text: "Transparent overage pricing" },
            { icon: Layers, text: "Free forever Starter" },
          ].map(({ icon: Icon, text }) => (
            <span
              key={text}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-xs font-medium text-foreground/80 shadow-sm"
            >
              <Icon size={12} className="text-gold-dark dark:text-gold" />
              {text}
            </span>
          ))}
        </div>
      </SectionShell>

      {/* COMPARISON */}
      <SectionShell
        tone="muted"
        eyebrow="Compare every feature"
        title="Side by side."
        intro="Grouped by category so you can scan for the capabilities that matter to you."
      >
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card-hover">
          {/* Subtle gold halo behind the Grower column on lg+ */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[33.333%] -translate-x-1/2 lg:block"
            style={{
              background:
                "linear-gradient(180deg, hsl(43 96% 56% / 0.06) 0%, transparent 70%)",
            }}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
                  <th className="sticky left-0 z-10 bg-card/80 p-5 text-left">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-50">
                      Feature
                    </span>
                  </th>
                  {TIERS.map((t) => (
                    <th key={t.id} className="p-5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-[0.18em]",
                            t.featured ? "text-gold-dark dark:text-gold" : "opacity-55",
                          )}
                        >
                          {t.name}
                          {t.featured && (
                            <span className="ml-1.5 inline-flex translate-y-[-1px] items-center align-middle">
                              <Sparkles size={10} />
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[11.5px] tabular-nums",
                            t.featured ? "font-semibold" : "opacity-65",
                          )}
                        >
                          {t.price}
                          {t.per !== "forever" && (
                            <span className="opacity-60"> {t.per}</span>
                          )}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_GROUPS.map((group) => (
                  <React.Fragment key={group.id}>
                    {/* Group header row */}
                    <tr className="bg-secondary/40">
                      <th
                        colSpan={4}
                        className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.18em] opacity-55"
                      >
                        {group.label}
                      </th>
                    </tr>
                    {/* Group rows */}
                    {group.rows.map((row) => (
                      <tr
                        key={row.feature}
                        className="group/row border-t border-border/40 transition-colors hover:bg-secondary/30"
                      >
                        <td className="px-5 py-3 text-[13px] opacity-90 group-hover/row:opacity-100">
                          {row.feature}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <CellValue value={row.starter} />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <CellValue value={row.grower} featured />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <CellValue value={row.scale} />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionShell>

      {/* FAQ */}
      <SectionShell tone="default" eyebrow="FAQ" title="Pricing questions.">
        <div className="mx-auto max-w-3xl">
          <ul className="divide-y divide-border/60">
            {FAQ.map((item) => (
              <li key={item.q} className="py-5">
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      {/* CLOSING — two complementary cards in a single section:
          a prominent gold-accented "Start free" + a smaller navy "Scale+"
          for high-volume buyers. Avoids the previous stacked-CTA look. */}
      <SectionShell tone="muted">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-5">
          {/* Primary — Start free */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-gold/40 bg-card p-8 md:col-span-3">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 30% 100%, hsl(43 96% 56% / 0.10) 0%, transparent 70%)",
              }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-dark dark:text-gold">
              Start free
            </span>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              Two filings a month, no card.
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Stay on Starter forever, or upgrade the moment volume picks up. Cancel anytime.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="gold" size="lg" asChild>
                <a href="https://app.mycargolens.com/register">Start free</a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/security">Security &amp; trust</Link>
              </Button>
            </div>
          </div>

          {/* Secondary — Scale+ (dark navy) */}
          <div className="relative overflow-hidden rounded-2xl bg-[hsl(222_47%_11%)] p-8 text-white md:col-span-2">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 50% at 100% 0%, hsl(43 96% 56% / 0.12) 0%, transparent 70%)",
              }}
            />
            <span className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
              Scale+
            </span>
            <h3 className="relative mt-2 text-2xl font-semibold tracking-tight">
              High-volume?
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-white/70">
              250+ filings/mo or 25+ users. Annual contracts, SSO, dedicated support.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="relative mt-5 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href="/contact">Talk to founders</Link>
            </Button>
          </div>
        </div>
      </SectionShell>
    </>
  );
}
