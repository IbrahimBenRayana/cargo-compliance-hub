"use client";

import Link from "next/link";
import * as React from "react";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Users,
  Ship,
  Boxes,
  Container as ContainerIcon,
  ShieldCheck,
  ClipboardCheck,
  Copy,
  LayoutTemplate,
  Layers,
  Check,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { SeverityPill } from "@/components/ui/severity-pill";
import { CodeStream } from "@/components/ui/code-stream";
import { IsfScene } from "@/components/illustrations/isf-scene";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

const FILE_TYPES = [
  {
    code: "ISF-10",
    title: "Importer Security Filing",
    body: "10 + 2 data elements for ocean cargo importers. Filed 24h before vessel loading at origin port.",
  },
  {
    code: "ISF-5",
    title: "Carrier ISF",
    body: "5 elements for foreign exporters and FROB (freight remaining on board). Same wizard, fewer fields.",
  },
  {
    code: "7501",
    title: "Entry Summary",
    body: "Prefilled from your accepted ISF — importer, consignee, MBOL, carrier, bond all carry over. Edit, sign, submit.",
  },
  {
    code: "3461",
    title: "Entry / Immediate Delivery",
    body: "ABI Documents API. Manifest queries by Master BOL. Release approval, hold notices, exam intent — all in one timeline.",
  },
  {
    code: "In-bond",
    title: "Transportation In-Bond",
    body: "Across-port moves with hand-off tracking and arrival notices.",
  },
];

const STEPS = [
  { key: "importer", label: "Importer", icon: Building2, status: "done" },
  { key: "parties", label: "Parties", icon: Users, status: "done" },
  { key: "shipment", label: "Shipment", icon: Ship, status: "done" },
  { key: "commodities", label: "Commodities", icon: Boxes, status: "active" },
  { key: "containers", label: "Containers", icon: ContainerIcon, status: "pending" },
  { key: "bond", label: "Bond", icon: ShieldCheck, status: "pending" },
  { key: "review", label: "Review", icon: ClipboardCheck, status: "pending" },
] as const;

const MOVE_FASTER = [
  {
    icon: LayoutTemplate,
    title: "Templates",
    body: "Save any filing's parties, ports, bond, and commodity defaults as a reusable template. New filings prefill from your most-used template — no retyping.",
  },
  {
    icon: Copy,
    title: "Duplicate",
    body: "Any draft, accepted, or rejected filing can be cloned in one click. The clone opens as a new draft with everything copied except the MBOL.",
  },
  {
    icon: Layers,
    title: "Bulk submit",
    body: "Select up to 50 drafts at once and submit in parallel. Watch the queue: each one shows its status as CBP processes it.",
  },
];

const RULE_CHECKS: { rule: string; tone: "rose" | "amber" | "emerald"; pill: string }[] = [
  { rule: "Manufacturer party has tax ID", tone: "emerald", pill: "OK" },
  { rule: "Bond is active and unexpired", tone: "emerald", pill: "OK" },
  { rule: "HTS codes are 10 digits", tone: "amber", pill: "Check" },
  { rule: "Buyer != Importer when consignee specified", tone: "emerald", pill: "OK" },
  { rule: "ISF filed at least 24h before vessel loading", tone: "emerald", pill: "OK" },
];

const FAQ = [
  {
    q: "Which filing types do you support?",
    a: "ISF-10, ISF-5, ABI 7501 Entry Summary, ABI 3461 Entry, and In-Bond. Manifest queries by Master BOL are also included.",
  },
  {
    q: "Are filings actually submitted to CBP or to a sandbox?",
    a: "Real CBP via the CustomsCity ABI gateway. Sandbox mode is available for onboarding.",
  },
  {
    q: "How long does an ISF take in the wizard?",
    a: "~90 seconds for the first one. ~30 seconds for follow-ups via templates and duplicate.",
  },
  {
    q: "What happens when CBP rejects?",
    a: "You get a notification in-app and via email. AI Coach opens with a plain-English explanation and numbered fix steps.",
  },
  {
    q: "Can I export the filing as PDF for my files?",
    a: "Yes — every filing has a PDF export at any stage of its lifecycle.",
  },
];

export function FilingsClient() {
  const stepsRef = React.useRef<HTMLDivElement>(null);
  const stepsInView = useInView(stepsRef, { once: true, amount: 0.2 });

  return (
    <>
      <PageHero
        label="Platform"
        title="One wizard. Every shipment type."
        description="ISF-10, ISF-5, Entry Summary, Entry, In-bond — all in the same flow. Save reusable templates. Duplicate any filing as a new draft. Bulk-submit dozens at once. Every draft gets a rule-based validation gate plus an optional AI pre-flight review."
        breadcrumbs={[
          { label: "Platform", href: "/features" },
          { label: "Filings", href: "/platform/filings" },
        ]}
        illustration={<IsfScene className="w-full max-w-md h-auto text-foreground/90" />}
      />

      {/* (b) Filing types */}
      <SectionShell
        tone="default"
        eyebrow="Filing types"
        title="Five filings, one workflow."
        intro="Every CBP filing surface we support lives in the same wizard. Switch types without learning a new screen."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FILE_TYPES.map((ft) => (
            <li
              key={ft.code}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <span className="inline-flex items-center rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 text-[11px] font-mono font-semibold tabular-nums text-foreground">
                {ft.code}
              </span>
              <h3 className="mt-3 text-base font-semibold text-foreground">{ft.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{ft.body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* (c) Wizard step-tracker */}
      <SectionShell
        tone="muted"
        eyebrow="The wizard"
        title="Same 7 steps for every filing type."
        intro="Importer → Parties → Shipment → Commodities → Containers → Bond → Review. Skip what doesn't apply; everything carries forward."
      >
        <div ref={stepsRef}>
          <ol className="grid grid-cols-7 gap-1.5 mb-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const done = step.status === "done";
              const active = step.status === "active";
              return (
                <li key={step.key} className="flex flex-col items-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={stepsInView ? { scale: 1, opacity: 1 } : undefined}
                    transition={{ duration: 0.4, delay: 0.2 + i * 0.06, ease: EASE_OUT_QUART }}
                    className={cn(
                      "relative size-10 rounded-full flex items-center justify-center border transition-colors",
                      done && "bg-gold/20 border-gold/40 text-gold-dark dark:text-gold",
                      active && "bg-gold border-gold text-yellow-950 shadow-gold",
                      !done && !active && "bg-card border-border/60 text-muted-foreground",
                    )}
                  >
                    {done ? <Check size={16} /> : <Icon size={15} />}
                    {active && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full border-2 border-gold"
                        animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </motion.div>
                  <span
                    className={cn(
                      "mt-2 text-[10px] font-medium tabular-nums",
                      done && "text-foreground",
                      active && "text-foreground font-semibold",
                      !done && !active && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Two-column explainer block */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <h4 className="text-sm font-semibold text-foreground mb-2">
                Commodities <span className="ml-1.5 text-muted-foreground font-normal">— active step</span>
              </h4>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                Add line items by HTS code or by description (AI suggests the code). Each line
                shows ADD/CVD watch indicators, PGA agency flags, and FTA program eligibility
                inline as you type.
              </p>
              <ul className="space-y-2 text-[12px] text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                  <span>HTS autocomplete with USITC revision 14 data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                  <span>ADD/CVD watch synced daily from the Federal Register</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                  <span>PGA flags (FDA, USDA-APHIS, EPA, FCC) inline per HTS</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <h4 className="text-sm font-semibold text-foreground mb-2">
                Bond <span className="ml-1.5 text-muted-foreground font-normal">— up next</span>
              </h4>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                For ISF, choose bond type and enter the bond holder ID (IOR tax ID). For ABI
                Entry, enter the surety code and bond number. Active bonds prefill — no retyping.
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                <div className="rounded-lg border border-border/50 bg-background/60 p-2.5">
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">
                    Bond type
                  </div>
                  <div className="font-mono tabular-nums text-foreground">8 — Continuous</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/60 p-2.5">
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">
                    Holder ID
                  </div>
                  <div className="font-mono tabular-nums text-foreground">12-3456789</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* (d) Move faster */}
      <SectionShell
        tone="default"
        eyebrow="Move faster"
        title="Templates, duplicate, bulk submit."
        intro="The three accelerators every ops team asks for after the first filing."
      >
        <ul className="grid gap-5 sm:grid-cols-3">
          {MOVE_FASTER.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-border/60 bg-card p-5"
            >
              <div className="grid size-9 place-items-center rounded-xl bg-gold/15 text-gold-dark dark:text-gold mb-4">
                <Icon size={18} />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* (e) Validation gate + AI pre-flight */}
      <SectionShell
        tone="muted"
        eyebrow="Catch issues before CBP does"
        title="Two gates between a draft and CBP."
        intro="A deterministic rule-based check runs on every filing. An AI pre-flight is one click away."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Rule-based gate</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Deterministic. Runs on every save and submit. Blocks the submit on critical
              failures; warns on the rest.
            </p>
            <ul className="space-y-2">
              {RULE_CHECKS.map((r) => (
                <li
                  key={r.rule}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2"
                >
                  <span className="flex-1 text-[12.5px] text-foreground">{r.rule}</span>
                  <SeverityPill tone={r.tone}>{r.pill}</SeverityPill>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">AI pre-flight (optional)</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Reviews the whole draft for things the rules can't catch. Streams its findings.
            </p>
            <CodeStream
              variant="chat"
              replayOnView
              speed={16}
              text={`Pre-flight on INV-4502: 1 warning.

HTS 6204.62.40 (women's trousers) has
ADD/CVD watch for Chinese-origin goods.
Confirm origin before submitting — could
trigger an additional duty deposit.`}
              ariaLabel="AI pre-flight example"
              className="min-h-[180px]"
            />
          </div>
        </div>
      </SectionShell>

      {/* (f) FAQ */}
      <SectionShell
        tone="default"
        eyebrow="FAQ"
        title="Common questions."
      >
        <div className="mx-auto max-w-3xl">
          <ul className="divide-y divide-border/60">
            {FAQ.map((item) => (
              <li key={item.q} className="py-5">
                <h3 className="text-sm font-semibold text-foreground mb-1.5">
                  {item.q}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      {/* (g) CTA */}
      <SectionShell tone="muted" headingAlign="center" title="Ready to file your first?">
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
