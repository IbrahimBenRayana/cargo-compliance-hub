"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Layers, Sparkles, Wallet, Zap } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { SeverityPill } from "@/components/ui/severity-pill";

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "hsl(43 96% 56%)";
const EMERALD = "hsl(160 84% 39%)";

/**
 * Pricing hero — three floating tier cards arranged with the middle one
 * scaled up. No bg box; gold glow + bobbing motion.
 */
function PricingHeroIllustration() {
  const tiers = [
    { x: 50, y: 110, w: 110, h: 150, tag: "STARTER", price: "$0", per: "free", scale: 0.92, delay: 0 },
    { x: 184, y: 80, w: 130, h: 200, tag: "GROWER", price: "$49", per: "/mo", scale: 1.0, delay: 0.15, featured: true },
    { x: 338, y: 110, w: 110, h: 150, tag: "SCALE", price: "$149", per: "/mo", scale: 0.92, delay: 0.3 },
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
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="180" rx="210" ry="140" fill="url(#pr-glow)" stroke="none" />

      {tiers.map((t) => (
        <motion.g
          key={t.tag}
          variants={{
            hidden: { opacity: 0, y: 14, scale: t.scale * 0.95 },
            visible: {
              opacity: 1,
              y: 0,
              scale: t.scale,
              transition: { duration: 0.6, ease: EASE, delay: t.delay },
            },
          }}
        >
          <motion.g
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 5 + t.delay, repeat: Infinity, ease: "easeInOut", delay: t.delay }}
          >
            {t.featured && (
              <motion.rect
                x={t.x - 4}
                y={t.y - 4}
                width={t.w + 8}
                height={t.h + 8}
                rx="14"
                stroke={GOLD}
                strokeOpacity="0.4"
                fill="none"
                animate={{ opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              rx="10"
              fill={t.featured ? `${GOLD}14` : "currentColor"}
              fillOpacity={t.featured ? undefined : 0.04}
              stroke={t.featured ? GOLD : "currentColor"}
              strokeOpacity={t.featured ? 0.8 : 0.55}
            />
            <text
              x={t.x + t.w / 2}
              y={t.y + 22}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-sans-serif, sans-serif"
              fontWeight="700"
              letterSpacing="1.2"
              fill={t.featured ? GOLD : "currentColor"}
              fillOpacity={t.featured ? 1 : 0.6}
              stroke="none"
            >
              {t.tag}
            </text>
            <line x1={t.x + 16} y1={t.y + 32} x2={t.x + t.w - 16} y2={t.y + 32} strokeOpacity="0.3" />
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
            {[100, 116, 132].map((dy, i) => (
              <g key={dy}>
                <circle cx={t.x + 18} cy={t.y + dy} r="2" fill={t.featured ? GOLD : EMERALD} stroke="none" />
                <line
                  x1={t.x + 26}
                  y1={t.y + dy}
                  x2={t.x + t.w - 16 - i * 4}
                  y2={t.y + dy}
                  strokeOpacity="0.45"
                />
              </g>
            ))}
          </motion.g>
        </motion.g>
      ))}

      <motion.g
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.5, delay: 1 } },
        }}
      >
        <circle cx="60" cy="316" r="2.5" fill={EMERALD} stroke="none" />
        <text x="72" y="320" fontSize="8.5" fontFamily="ui-monospace, monospace" fontWeight="600" fill="currentColor" fillOpacity="0.55" stroke="none">
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

const COMPARE_ROWS: {
  feature: string;
  starter: string | boolean;
  grower: string | boolean;
  scale: string | boolean;
}[] = [
  { feature: "Monthly filings included", starter: "2", grower: "25", scale: "100" },
  { feature: "Overage rate", starter: "—", grower: "$2/filing", scale: "$1/filing" },
  { feature: "ISF-10 / ISF-5 / Entry / In-Bond", starter: true, grower: true, scale: true },
  { feature: "AI Coach (rejection mode)", starter: true, grower: true, scale: true },
  { feature: "AI Pre-flight (before submit)", starter: false, grower: true, scale: true },
  { feature: "Action queue + Today's brief", starter: true, grower: true, scale: true },
  { feature: "Templates + bulk submit", starter: false, grower: true, scale: true },
  { feature: "UFLPA Risk Inbox", starter: false, grower: true, scale: true },
  { feature: "ADD/CVD daily sync (Fed Register)", starter: false, grower: true, scale: true },
  { feature: "FTA Preference Calculator (17)", starter: false, grower: false, scale: true },
  { feature: "Liquidation pipeline (314-day clock)", starter: false, grower: false, scale: true },
  { feature: "Manifest queries by MBOL", starter: false, grower: false, scale: true },
  { feature: "Users", starter: "1", grower: "Up to 5", scale: "Unlimited" },
  { feature: "Email notifications", starter: false, grower: true, scale: true },
  { feature: "Audit log export (CSV)", starter: false, grower: false, scale: true },
  { feature: "Priority support", starter: false, grower: false, scale: true },
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

function TierCard({ tier }: { tier: Tier }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: EASE }}
      className={
        tier.featured
          ? "relative rounded-2xl border-2 border-gold bg-card p-6 shadow-gold ring-1 ring-gold/20"
          : "rounded-2xl border border-border/60 bg-card p-6"
      }
    >
      {tier.featured && (
        <div className="absolute -top-3 left-6">
          <SeverityPill tone="amber">Most popular</SeverityPill>
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-1">{tier.name}</h3>
      <p className="text-sm text-muted-foreground mb-5">{tier.blurb}</p>

      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-4xl font-semibold tabular-nums text-foreground">{tier.price}</span>
        <span className="text-sm text-muted-foreground">{tier.per}</span>
      </div>
      <div className="text-[12px] font-mono tabular-nums text-muted-foreground mb-5">
        {tier.filingsIncluded} <span className="opacity-60">· {tier.overage}</span>
      </div>

      <Button
        variant={tier.featured ? "gold" : "outline"}
        size="lg"
        className="w-full mb-6"
        asChild
      >
        <a href={tier.ctaHref}>{tier.cta}</a>
      </Button>

      <ul className="space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-foreground/85">
            <Check size={14} strokeWidth={2.5} className="mt-0.5 text-gold-dark dark:text-gold shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </motion.li>
  );
}

function CellValue({ value }: { value: string | boolean }) {
  if (value === true)
    return <Check size={15} strokeWidth={2.5} className="mx-auto text-gold-dark dark:text-gold" />;
  if (value === false)
    return <span className="mx-auto block w-fit text-muted-foreground/40">—</span>;
  return <span className="font-mono text-[12px] tabular-nums">{value}</span>;
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
          {TIERS.map((t) => (
            <TierCard key={t.id} tier={t} />
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
      <SectionShell tone="muted" eyebrow="Compare every feature" title="Side by side.">
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left p-4 font-semibold opacity-80">Feature</th>
                {TIERS.map((t) => (
                  <th key={t.id} className="text-center p-4 font-semibold">
                    <div>{t.name}</div>
                    <div className="text-[11px] font-mono font-normal opacity-60 tabular-nums">
                      {t.price}
                      {t.per !== "forever" && <span className="opacity-60"> {t.per}</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={row.feature} className={i % 2 ? "bg-background/40" : ""}>
                  <td className="p-3 px-4 opacity-85">{row.feature}</td>
                  <td className="p-3 px-4 text-center"><CellValue value={row.starter} /></td>
                  <td className="p-3 px-4 text-center bg-gold/5"><CellValue value={row.grower} /></td>
                  <td className="p-3 px-4 text-center"><CellValue value={row.scale} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* SCALE+ STRIP */}
      <SectionShell tone="muted" eyebrow="Scale+" title="Custom volume for high-volume teams.">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/60 bg-card p-6 text-center">
          <p className="text-base leading-relaxed mb-5 opacity-90">
            250+ filings per month or 25+ users? We have a custom volume tier with annual contract
            pricing, dedicated support, and SSO.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="gold" size="lg" asChild>
              <Link href="/contact">Talk to founders</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/security">Security & trust</Link>
            </Button>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        tone="default"
        headingAlign="center"
        title="Start with the free plan. Upgrade when you need."
      >
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
