"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Compass,
  Eye,
  Layers,
  Lock,
  Ship,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Hero3D } from "@/components/hero3d/Hero3D";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { SeverityPill } from "@/components/ui/severity-pill";

const EASE = [0.22, 1, 0.36, 1] as const;

const PRINCIPLES = [
  {
    icon: Eye,
    title: "Calm by default",
    body: "If a screen makes an importer's Monday morning more stressful, we did the job wrong. Cards over dashboards. Inboxes over feeds. Quiet over loud.",
  },
  {
    icon: Zap,
    title: "Honest pricing",
    body: "No per-feature gotchas. No \"talk to sales\" walls. No hidden filings markup. No monthly fee — sign up free and pay a flat rate per shipment you file.",
  },
  {
    icon: Lock,
    title: "Ops-first, always",
    body: "Built for the person who's actually filing — not the buyer, not the IT department, not the lawyer. If an operator can't do it in one click, it's broken.",
  },
];

const STORY_BEATS = [
  {
    when: "The pain",
    title: "Customs software hadn't been touched since 1998.",
    body: "ABI terminals. CSV exports. PDF confirmations faxed back. Twelve browser tabs to file one shipment. Then a CBP rejection three days later you can't read. We watched ops teams chase the same workflow with spreadsheets and email — and lose. It's not their fault. The tools were that bad.",
  },
  {
    when: "The shift",
    title: "We rebuilt customs as an inbox.",
    body: "Action queue ranked by urgency. AI Coach that translates CBP error codes into plain English. Templates and one-click duplicate so repeat filings start mostly filled in. ADD/CVD synced from the Federal Register every morning. 314-day liquidation clock tracked on every entry. The plumbing runs itself — you read your inbox.",
  },
  {
    when: "Today",
    title: "Same product, three angles.",
    body: "Ops managers, customs brokerages, and freight forwarders use MyCargoLens differently. Same data, same plumbing — different surfaces. Email-verified team accounts with proper RBAC. Built on the rails CBP actually uses (CustomsCity ABI, Federal Register, FDA/USDA-APHIS/EPA/FCC).",
  },
];

const NUMBERS = [
  { value: "ISF + Entry", label: "in one workspace", icon: Sparkles },
  { value: "314d", label: "liquidation clock per entry", icon: Layers },
  { value: "5 min", label: "CBP polling cadence", icon: Wrench },
  { value: "17", label: "FTA programs supported", icon: Compass },
];

export function AboutClient() {
  return (
    <>
      <PageHero
        label="About"
        title="We're making CBP compliance feel like email — not a phone tree."
        description="MyCargoLens started because customs work had been left behind by the rest of B2B software for two decades. Importers deserved better. We're building it."
        breadcrumbs={[{ label: "About", href: "/about" }]}
        illustration={<Hero3D scene="about" />}
      />

      {/* STORY — three beats */}
      <SectionShell tone="default" eyebrow="Our story" title="From spreadsheets to a calm inbox.">
        <ol className="space-y-12 md:space-y-16">
          {STORY_BEATS.map((beat, i) => (
            <motion.li
              key={beat.when}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
              className="grid gap-6 lg:grid-cols-12 lg:gap-10"
            >
              <div className="lg:col-span-3">
                <SeverityPill tone="amber" className="mb-2">{beat.when}</SeverityPill>
              </div>
              <div className="lg:col-span-9">
                <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-3 leading-tight">
                  {beat.title}
                </h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">{beat.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </SectionShell>

      {/* PRINCIPLES */}
      <SectionShell
        tone="muted"
        eyebrow="What we believe"
        title="Three principles, every shipping decision."
        intro="When something's on the fence, these are how we break ties."
      >
        <ul className="grid gap-5 md:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, body }, idx) => (
            <li key={title} className="rounded-2xl border border-border/60 bg-card p-6">
              <IconTile icon={Icon} hover="lift" reveal revealDelay={idx * 0.06} className="mb-4" />
              <h3 className="text-base font-semibold mb-2">{title}</h3>
              <p className="text-sm opacity-80 leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* NUMBERS strip */}
      <SectionShell tone="default" eyebrow="By the numbers" title="What we ship to.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUMBERS.map(({ value, label, icon: Icon }, idx) => (
            <li key={label} className="rounded-2xl border border-border/60 bg-card p-5">
              <IconTile icon={Icon} hover="lift" reveal revealDelay={idx * 0.06} className="size-9 mb-3" />
              <div className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mt-1">{label}</div>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* TEAM callout */}
      <SectionShell tone="muted" eyebrow="The team" title="Built by people who've actually filed.">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/60 bg-card p-6 text-center">
          <div className="grid size-12 place-items-center mx-auto rounded-xl bg-gold/15 text-gold-dark dark:text-gold mb-4">
            <Ship size={20} />
          </div>
          <p className="text-base leading-relaxed mb-4 opacity-90">
            We’re a small team based in the US, building MyCargoLens from a mix of ops, software,
            and customs experience. We file our own ISFs to dogfood every release.
          </p>
          <p className="text-sm opacity-65">
            Want to chat? <Link href="/contact" className="font-semibold underline underline-offset-4 transition-colors duration-200 hover:text-gold-dark dark:hover:text-gold">Talk to founders →</Link>
          </p>
        </div>
      </SectionShell>

      <SectionShell tone="default" headingAlign="center" title="Try the product we'd want to use.">
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
