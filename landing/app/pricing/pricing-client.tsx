"use client";

import Link from "next/link";
import * as React from "react";
import { motion } from "framer-motion";
import { Check, Layers, Sparkles, Wallet, Zap } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Hero3D } from "@/components/hero3d/Hero3D";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

type Tier = {
  id: string;
  name: string;
  blurb: string;
  price: string;
  per: string;
  priceNote: string;
  cta: string;
  ctaHref: string;
  featured?: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    id: "isf",
    name: "ISF Filing",
    blurb: "Get your importer security filings transmitted on time.",
    price: "$45",
    per: "per shipment filed",
    priceNote: "No monthly fee",
    cta: "Request a demo",
    ctaHref: "/book-a-demo",
    features: [
      "ISF-10 (10+2) & ISF-5 filing",
      "Templates & bulk duplicate",
      "Manifest (MBOL) query",
      "Deadline tracking",
      "Email support",
    ],
  },
  {
    id: "isf-entry",
    name: "ISF + Entry",
    blurb: "Clear the cargo too — ISF plus your ABI entry, billed once per shipment.",
    price: "$180",
    per: "per shipment filed",
    priceNote: "No monthly fee",
    cta: "Request a demo",
    ctaHref: "/book-a-demo",
    featured: true,
    features: [
      "Everything in ISF Filing, plus",
      "ABI Entry Summary (7501)",
      "ABI Cargo Release (3461)",
      "Linked ISF + Entry billed once",
      "Chat support",
    ],
  },
  {
    id: "complete",
    name: "Complete",
    blurb: "The full compliance workflow — filing, tracking, and classification.",
    price: "$280",
    per: "per shipment filed",
    priceNote: "No monthly fee",
    cta: "Request a demo",
    ctaHref: "/book-a-demo",
    features: [
      "Everything in ISF + Entry, plus",
      "Container tracking (Terminal 49)",
      "HTS Classification",
      "Duty Calculator",
      "Priority support",
    ],
  },
];

type CompareRow = {
  feature: string;
  isf: string | boolean;
  isfEntry: string | boolean;
  complete: string | boolean;
};

type CompareGroup = {
  id: string;
  label: string;
  rows: CompareRow[];
};

const COMPARE_GROUPS: CompareGroup[] = [
  {
    id: "pricing",
    label: "Pricing",
    rows: [
      { feature: "Per shipment filed", isf: "$45", isfEntry: "$180", complete: "$280" },
      { feature: "Monthly subscription fee", isf: "None", isfEntry: "None", complete: "None" },
    ],
  },
  {
    id: "filing",
    label: "Filing",
    rows: [
      { feature: "ISF-10 (10+2)", isf: true, isfEntry: true, complete: true },
      { feature: "ISF-5", isf: true, isfEntry: true, complete: true },
      { feature: "Templates & bulk duplicate", isf: true, isfEntry: true, complete: true },
      { feature: "Manifest (MBOL) query", isf: true, isfEntry: true, complete: true },
      { feature: "Deadline tracking", isf: true, isfEntry: true, complete: true },
    ],
  },
  {
    id: "entry",
    label: "Entry",
    rows: [
      { feature: "ABI Entry Summary (7501)", isf: false, isfEntry: true, complete: true },
      { feature: "ABI Cargo Release (3461)", isf: false, isfEntry: true, complete: true },
    ],
  },
  {
    id: "tracking",
    label: "Tracking & classification",
    rows: [
      { feature: "Container tracking (Terminal 49)", isf: false, isfEntry: false, complete: true },
      { feature: "HTS Classification", isf: false, isfEntry: false, complete: true },
      { feature: "Duty Calculator", isf: false, isfEntry: false, complete: true },
    ],
  },
  {
    id: "support",
    label: "Support",
    rows: [
      { feature: "Email support", isf: true, isfEntry: true, complete: true },
      { feature: "Chat support", isf: false, isfEntry: true, complete: true },
      { feature: "Priority support", isf: false, isfEntry: false, complete: true },
    ],
  },
];

const FAQ = [
  {
    q: "How does per-shipment pricing work?",
    a: "No subscription, no monthly fee. You pick a tier — ISF Filing, ISF + Entry, or Complete — which sets your flat per-shipment rate and unlocks that tier's features. You keep a card on file, and you're charged that flat rate for each shipment you file. You only ever pay for what you actually file.",
  },
  {
    q: "What counts as a billable shipment?",
    a: "One charge per shipment you file. A linked ISF and ABI Entry on the same shipment is billed once, not twice — and fixing and resubmitting the same filing never double-charges it. Browsing, drafting, and manifest (MBOL) queries are always free.",
  },
  {
    q: "Can I change tiers?",
    a: "Yes — anytime, from your billing settings. The new per-shipment rate and feature set apply to shipments you file after the change. Your existing data stays exactly where it is.",
  },
  {
    q: "Do I pay anything to get started?",
    a: "No. Signing up is free, and you can browse and draft at no cost. Filing requires picking a tier and adding a card — but you pay from your first filing, and only per shipment. No setup fees, no monthly minimums.",
  },
  {
    q: "How are low-value shipments handled?",
    a: "Low-value shipments file as formal or informal entries on the same rails as your other filings: same inbox, same pre-flight checks. CBP has suspended Type 86 (Section 321) entries, so we do not offer them. If low-value volume is a big part of your business, talk to us about the right setup.",
  },
  {
    q: "Is there an API?",
    a: "Yes — Public API v1, built for brokers and 3PLs who'd rather integrate than click. Scoped, revocable API keys, ISF and entry read/write, XML upload, and webhooks for status changes. Talk to us about API access for your team.",
  },
  {
    q: "What about high volume?",
    a: "For high-volume importers and brokerages, our Enterprise option offers custom per-shipment pricing plus SLAs. Talk to us about terms that fit your numbers.",
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
        // Name the animated properties — never transition-all — and keep the
        // hover response fast (200ms ease-out) so the card feels attentive.
        "group relative rounded-2xl p-7 transition-[transform,border-color,box-shadow] duration-200 ease-out",
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
            {tier.priceNote}
          </span>
          <span className="text-muted-foreground">Pay as you file</span>
        </div>
      </div>

      <Button
        variant={tier.featured ? "gold" : "outline"}
        size="lg"
        className="mb-6 w-full"
        asChild
      >
        <Link href={tier.ctaHref}>{tier.cta}</Link>
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
        title="Priced per shipment. Nothing sneaky."
        description="No subscription. No monthly fee. No minimums. Add a card once, pick a tier, and pay a flat rate per shipment — only when you file. A linked ISF and Entry on the same shipment is billed once, not twice. Signing up is free: browse and draft all you want, and pay nothing until your first filing."
        breadcrumbs={[{ label: "Pricing", href: "/pricing" }]}
        illustration={<Hero3D scene="pricing" />}
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
            { icon: Wallet, text: "No monthly subscription" },
            { icon: Zap, text: "Pay only for what you file" },
            { icon: Layers, text: "ISF + Entry billed once" },
            { icon: Sparkles, text: "No fee to draft" },
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
        eyebrow="Compare every capability"
        title="Side by side."
        intro="Each tier sets your per-shipment rate and unlocks a set of capabilities. Scan for the ones that matter to you."
      >
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card-hover">
          {/* Subtle gold halo behind the featured ISF + Entry column on lg+ */}
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
                          <span className="opacity-85"> / shipment</span>
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
                          <CellValue value={row.isf} />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <CellValue value={row.isfEntry} featured />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <CellValue value={row.complete} />
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
            {FAQ.map((item, i) => (
              <motion.li
                key={item.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                // Stagger only the first viewport batch; the rest reveal on scroll.
                transition={{ duration: 0.45, ease: EASE, delay: i < 4 ? i * 0.05 : 0 }}
                className="py-5"
              >
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      </SectionShell>

      {/* CLOSING — two complementary cards in a single section:
          a prominent gold-accented "Request a demo" + a smaller navy
          "Enterprise" card for high-volume buyers. Avoids the previous
          stacked-CTA look. */}
      <SectionShell tone="muted">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-5">
          {/* Primary — Request a demo */}
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
              See it live
            </span>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              See it live. Pay per shipment.
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              No subscription, no monthly fee. Book a 20-minute demo and we will set you up on the right tier — add a card once and pay only per shipment, as you file. Change tiers anytime.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="gold" size="lg" asChild>
                <Link href="/book-a-demo">Request a demo</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/security">Security &amp; trust</Link>
              </Button>
            </div>
          </div>

          {/* Secondary — Enterprise (dark navy) */}
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
              Enterprise
            </span>
            <h3 className="relative mt-2 text-2xl font-semibold tracking-tight">
              High-volume?
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-white/70">
              Custom per-shipment pricing for high-volume importers and brokerages, with SLAs. Talk to us about volume terms.
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
