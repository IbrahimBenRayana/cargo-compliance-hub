"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { ArrowRight, BellRing } from "lucide-react";
import { SectionShell } from "@/components/sections/section-shell";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

type Role = { label: string; tone: Severity };

const ROLES: Role[] = [
  { label: "Owner", tone: "amber" },
  { label: "Admin", tone: "neutral" },
  { label: "Operator", tone: "neutral" },
  { label: "Viewer", tone: "blue" },
];

const AUDIT_LINES = [
  { time: "14:21", actor: "alice@", action: "filed ISF-10 INV-4421" },
  { time: "14:22", actor: "carlos@", action: "reviewed pre-flight" },
  { time: "14:24", actor: "alice@", action: "submitted to CBP" },
] as const;

type Rail = {
  name: string;
  descriptor: string;
};

/**
 * Typographic wordmarks only — federal agency seals and logos are
 * usage-restricted for private companies (implied endorsement), so the
 * names carry the weight instead. One item per agency, auto width, so
 * nothing ever truncates.
 */
const RAILS: Rail[] = [
  { name: "CBP ABI", descriptor: "Direct connection" },
  { name: "CustomsCity", descriptor: "ABI gateway" },
  { name: "Federal Register", descriptor: "Daily ADD/CVD sync" },
  { name: "FDA", descriptor: "PGA partner agency" },
  { name: "USDA-APHIS", descriptor: "PGA partner agency" },
  { name: "EPA", descriptor: "PGA partner agency" },
  { name: "FCC", descriptor: "PGA partner agency" },
  { name: "Stripe", descriptor: "Billing" },
];

/**
 * Teams + rails in one trust beat: who can use it, what gets logged, and
 * the CBP infrastructure it actually runs on.
 */
export function Trust() {
  const marqueeRef = React.useRef<HTMLDivElement | null>(null);
  const marqueeInView = useInView(marqueeRef, { once: true, amount: 0.2 });

  return (
    <SectionShell
      id="trust"
      tone="default"
      headingAlign="center"
      eyebrow="Trust"
      title={
        <span className="block [text-wrap:balance]">
          Built for teams. Built on the rails CBP actually uses.
        </span>
      }
      intro="Invite your team, set roles, log every action — on a direct line to CBP's own infrastructure."
    >
      <TrustGrid />

      {/* Rails marquee */}
      <div
        ref={marqueeRef}
        className="mt-12 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
        aria-label="Integration partners"
      >
        <motion.div
          className="flex w-max gap-4"
          animate={marqueeInView ? { x: ["0%", "-50%"] } : undefined}
          transition={{
            duration: 38,
            ease: "linear",
            repeat: Infinity,
            repeatType: "loop",
          }}
        >
          {[...RAILS, ...RAILS].map((rail, i) => (
            <div
              key={`${rail.name}-${i}`}
              aria-hidden={i >= RAILS.length}
              className="flex shrink-0 flex-col justify-center whitespace-nowrap rounded-2xl border border-border/60 bg-card px-6 py-3.5"
            >
              <div className="text-[15px] font-semibold tracking-tight text-foreground">
                {rail.name}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {rail.descriptor}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          href="/pricing"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          No surprise upgrades. No usage-based gotchas. See pricing
          <ArrowRight
            className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </SectionShell>
  );
}

function TrustGrid() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <div ref={ref} className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
      <Column
        delay={0.05}
        inView={inView}
        heading="Owner · Admin · Operator · Viewer"
        body="4-tier RBAC. Email-verified invites with a 6-digit code. Suspend access in one click."
        visual={<RolesVisual />}
      />
      <Column
        delay={0.15}
        inView={inView}
        heading="Per-user, per-kind opt-in."
        body="In-app bell, email when it matters. Deep-link from notification right into the action card."
        visual={<NotificationsVisual />}
      />
      <Column
        delay={0.25}
        inView={inView}
        heading="Every action logged."
        body="Who filed, who amended, who marked liquidated. Exportable as CSV for your compliance team."
        visual={<AuditVisual />}
      />
    </div>
  );
}

function Column({
  delay,
  inView,
  heading,
  body,
  visual,
}: {
  delay: number;
  inView: boolean;
  heading: string;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.55, ease: EASE_OUT_QUART, delay }}
      className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-6 transition-shadow duration-200 hover:shadow-card-hover"
    >
      <div className="flex h-24 items-center">{visual}</div>
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {heading}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </motion.div>
  );
}

function RolesVisual() {
  return (
    <ul className="flex w-full flex-col gap-1.5" aria-hidden>
      {ROLES.map((role) => (
        <li key={role.label} className="flex items-center gap-2">
          <SeverityPill tone={role.tone}>{role.label}</SeverityPill>
          <span className="h-px flex-1 bg-border/60" />
        </li>
      ))}
    </ul>
  );
}

function NotificationsVisual() {
  return (
    <div className="relative inline-flex" aria-hidden>
      <span className="grid size-14 place-items-center rounded-2xl border border-border/60 bg-background">
        <BellRing className="size-8 text-foreground/80" aria-hidden />
      </span>
      <span className="absolute -right-2 -top-1.5">
        <SeverityPill tone="amber">3</SeverityPill>
      </span>
    </div>
  );
}

function AuditVisual() {
  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-border/60 bg-background/60 p-3"
      aria-hidden
    >
      <ul className="flex flex-col gap-1 font-mono text-[11px] leading-relaxed tabular-nums text-muted-foreground">
        {AUDIT_LINES.map((line) => (
          <li key={line.time} className="flex gap-2 truncate">
            <span className="text-foreground/70">{line.time}</span>
            <span className="text-foreground/90">{line.actor}</span>
            <span className="truncate">{line.action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
