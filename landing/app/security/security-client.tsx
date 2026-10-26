"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ClipboardList,
  Database,
  KeyRound,
  KeySquare,
  Lock,
  Mail,
  Server,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Hero3D } from "@/components/hero3d/Hero3D";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";

const EASE = [0.22, 1, 0.36, 1] as const;

const AUTH_ITEMS = [
  { icon: Smartphone, title: "Multi-factor authentication", body: "Available on every account: authenticator-app TOTP, email one-time codes as a fallback, and single-use recovery codes if you lose your device." },
  { icon: Mail, title: "Email-verified accounts", body: "Accounts are created by invitation, and each user proves their email address before they can file." },
  { icon: KeyRound, title: "Password hashing", body: "bcrypt with cost 12. We never store, log, or transmit raw passwords. Reset flows time-bound, single-use." },
  { icon: ShieldCheck, title: "Session security", body: "Short-lived access tokens held in memory, rotating refresh tokens, and every session ends when a password is reset." },
  { icon: AlertCircle, title: "Brute-force protection", body: "Rate limits on login attempts and multi-factor sign-in with an authenticator app or email code." },
  { icon: KeySquare, title: "Scoped API keys", body: "Public-API access runs on scoped keys (prefixed mcl_live_), separate from user sessions. Revoke a key in one click without touching anyone's login." },
];

const ROLES: { name: string; tone: Severity; body: string }[] = [
  { name: "Owner", tone: "amber", body: "Everything Admin can do, plus billing, integrations, and the ability to delete the team. One owner per team minimum." },
  { name: "Admin", tone: "neutral", body: "Invite + manage users. Configure templates. Toggle AI features per-team. View the audit log." },
  { name: "Operator", tone: "neutral", body: "Create, edit, submit filings. Use AI Coach + pre-flight. Reply to CBP rejections. Cannot manage users or billing." },
  { name: "Viewer", tone: "blue", body: "Read-only access. Export PDFs. Subscribe to notifications. View score history. Cannot edit anything." },
];

const DATA_ITEMS = [
  { icon: Lock, title: "Encryption in transit", body: "TLS on every endpoint, for the app, the public API, and webhooks." },
  { icon: Database, title: "Encrypted secrets", body: "MFA secrets are stored encrypted. API keys are shown once and can be revoked at any time." },
  { icon: Server, title: "US-hosted infrastructure", body: "The app and its PostgreSQL database run on US-hosted VPS infrastructure." },
  { icon: ClipboardList, title: "Backups", body: "Customer data is backed up regularly. Access is limited by role, and actions are recorded in the audit log." },
];

const VENDORS = [
  { name: "OpenAI", role: "AI Coach + pre-flight + HTS classifier", data: "Filing data + CBP response only", region: "US" },
  { name: "Stripe", role: "Billing", data: "Email, plan, invoice events", region: "US" },
  { name: "Contabo", role: "VPS hosting + PostgreSQL", data: "All app data", region: "US" },
  { name: "Microsoft Azure", role: "Transactional email", data: "Recipient email + message body", region: "US" },
];

/** Shared scroll-reveal for card grids: fade + small rise, 60ms stagger.
 * Marketing beat (once, on scroll) — 500ms is intentional; UI interactions
 * elsewhere stay under 300ms. MotionConfig reducedMotion="user" strips the
 * y-transform for reduced-motion users, leaving a plain fade. */
const cardReveal = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.5, ease: EASE, delay: i * 0.06 },
});

const AUDIT_FIELDS = [
  "Who did it (user email + role)",
  "When (UTC timestamp + IP)",
  "What (action + filing ID)",
  "Result (success / error code)",
  "Diff (before/after for edits)",
];

export function SecurityClient() {
  return (
    <>
      <PageHero
        label="Trust"
        title="Security at a glance."
        description="Customs data is regulatory data. Here's how we handle yours: the people who can see it, the encryption around it, the vendors who touch it, and the trail it leaves."
        breadcrumbs={[{ label: "Security", href: "/security" }]}
        illustration={<Hero3D scene="security" />}
      />

      {/* AUTH */}
      <SectionShell tone="default" eyebrow="Authentication" title="How we know it's you.">
        <ul className="grid gap-4 md:grid-cols-2">
          {AUTH_ITEMS.map(({ icon: Icon, title, body }, i) => (
            <motion.li key={title} {...cardReveal(i)} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-start gap-3 mb-3">
                <IconTile icon={Icon} hover="lift" reveal className="size-9" />
                <h3 className="text-sm font-semibold text-foreground mt-1">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </motion.li>
          ))}
        </ul>
      </SectionShell>

      {/* RBAC */}
      <SectionShell
        tone="muted"
        eyebrow="Authorization"
        title="Four roles. Same data, different permissions."
        intro="Role assignment is set at invite time. Owners and admins can change roles for any member. Invites arrive as single-use email links; suspend access in one click."
      >
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r, i) => (
            <motion.li key={r.name} {...cardReveal(i)} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="opacity-70" />
                <SeverityPill tone={r.tone}>{r.name}</SeverityPill>
              </div>
              <p className="text-[13px] leading-relaxed opacity-80">{r.body}</p>
            </motion.li>
          ))}
        </ul>
      </SectionShell>

      {/* DATA */}
      <SectionShell tone="default" eyebrow="Data" title="Where it lives, how it's protected.">
        <ul className="grid gap-4 md:grid-cols-2">
          {DATA_ITEMS.map(({ icon: Icon, title, body }, i) => (
            <motion.li key={title} {...cardReveal(i)} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-start gap-3 mb-3">
                <IconTile icon={Icon} hover="lift" reveal className="size-9" />
                <h3 className="text-sm font-semibold text-foreground mt-1">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </motion.li>
          ))}
        </ul>
      </SectionShell>

      {/* VENDORS */}
      <SectionShell
        tone="muted"
        eyebrow="Vendors"
        title="The third parties we use."
        intro="Full transparency. Every external service we send your data to, what data they see, and where it goes."
      >
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60 border-b border-border/60 bg-card/60">
            <div className="md:col-span-2">Vendor</div>
            <div className="md:col-span-3">Role</div>
            <div className="md:col-span-4">What they see</div>
            <div className="md:col-span-3">Region</div>
          </div>
          <ul>
            {VENDORS.map((v) => (
              <li
                key={v.name}
                className="grid md:grid-cols-12 gap-4 px-5 py-4 border-b border-border/40 last:border-b-0 text-[13px]"
              >
                <div className="md:col-span-2 font-semibold">{v.name}</div>
                <div className="md:col-span-3 opacity-80">{v.role}</div>
                <div className="md:col-span-4 opacity-80">{v.data}</div>
                <div className="md:col-span-3 font-mono text-[11.5px] opacity-70">{v.region}</div>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      {/* AUDIT */}
      <SectionShell
        tone="default"
        eyebrow="Audit trail"
        title="Every action, logged for the life of your account."
        intro="Read-only audit log accessible to Owners and Admins. Filterable by user, filing, action, or time. Exportable as CSV for your compliance team."
      >
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">What each log entry contains</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {AUDIT_FIELDS.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck size={14} className="mt-0.5 text-gold-dark dark:text-gold shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-lg border border-border/40 bg-background/60 p-3 font-mono text-[11px] tabular-nums leading-relaxed text-muted-foreground">
            <div>2026-05-23T14:21:08Z · alice@atlasapparel.com · operator · 192.0.2.14</div>
            <div className="opacity-85">→ filing.submit · INV-4421 · ISF-10 · success</div>
            <div>2026-05-23T14:22:31Z · carlos@atlasapparel.com · operator · 198.51.100.7</div>
            <div className="opacity-85">→ ai.preflight.run · INV-4421 · 0 critical, 1 warning</div>
            <div>2026-05-23T14:24:55Z · alice@atlasapparel.com · operator · 192.0.2.14</div>
            <div className="opacity-85">→ filing.resubmit · INV-4421 · ISF-10 · accepted</div>
          </div>
        </div>
      </SectionShell>

      {/* DISCLOSURE */}
      <SectionShell
        tone="muted"
        eyebrow="Disclosure"
        title="Found something? Tell us."
        intro="We treat security reports with priority. Responsible disclosure earns acknowledgement; please don't publish until we've patched."
      >
        <div className="mx-auto max-w-xl rounded-2xl border border-border/60 bg-card p-5 text-center">
          <p className="text-sm opacity-80 mb-3">Report security issues directly to</p>
          <a
            href="mailto:security@mycargolens.com"
            className="font-mono text-base font-semibold underline underline-offset-4"
          >
            security@mycargolens.com
          </a>
          <p className="mt-3 text-[11px] opacity-60">
            PGP key on request. Typical response: within 24h on weekdays.
          </p>
        </div>
      </SectionShell>

      <SectionShell tone="default" headingAlign="center" title="Questions about security?">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="gold" size="lg" asChild>
            <Link href="/contact">Talk to founders</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/book-a-demo">Request a demo</Link>
          </Button>
        </div>
      </SectionShell>
    </>
  );
}
