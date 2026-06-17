"use client";

import Link from "next/link";
import {
  AlertCircle,
  ClipboardList,
  Database,
  KeyRound,
  Lock,
  Mail,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionShell } from "@/components/sections/section-shell";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";

const AUTH_ITEMS = [
  { icon: Mail, title: "Email-verified accounts", body: "Sign-up requires a 6-digit code sent to your work email. Account isn't usable until verified." },
  { icon: KeyRound, title: "Password hashing", body: "bcrypt with cost 12. We never store, log, or transmit raw passwords. Reset flows time-bound, single-use." },
  { icon: ShieldCheck, title: "Session security", body: "HTTP-only, secure, SameSite=Lax session cookies. Sessions invalidate on password change. Server-side session store." },
  { icon: AlertCircle, title: "Brute-force protection", body: "Per-account rate limits on login attempts. Suspicious activity flagged in the audit log and emailed to admins." },
];

const ROLES: { name: string; tone: Severity; body: string }[] = [
  { name: "Owner", tone: "amber", body: "Everything Admin can do, plus billing, integrations, and the ability to delete the team. One owner per team minimum." },
  { name: "Admin", tone: "neutral", body: "Invite + manage users. Configure templates. Toggle AI features per-team. View the audit log." },
  { name: "Operator", tone: "neutral", body: "Create, edit, submit filings. Use AI Coach + pre-flight. Reply to CBP rejections. Cannot manage users or billing." },
  { name: "Viewer", tone: "blue", body: "Read-only access. Export PDFs. Subscribe to notifications. View score history. Cannot edit anything." },
];

const DATA_ITEMS = [
  { icon: Lock, title: "Encryption in transit", body: "TLS 1.2+ on every endpoint. HSTS preload. Certificate pinning on critical API paths." },
  { icon: Database, title: "Encryption at rest", body: "AES-256 disk encryption on the Postgres primary and all replicas. Backups encrypted with separate keys." },
  { icon: Server, title: "Data residency", body: "All customer data stays in the US. Postgres + object storage hosted in AWS us-east-1 with backups to us-west-2." },
  { icon: ClipboardList, title: "Backups & DR", body: "Continuous WAL streaming + nightly full backups, 30-day retention. Quarterly restore drills documented." },
];

const VENDORS = [
  { name: "CustomsCity", role: "ABI gateway", data: "Filing data, party data, MBOL", region: "US" },
  { name: "OpenAI (gpt-4o-class models)", role: "AI Coach + pre-flight + HTS classifier", data: "Filing data + CBP response only", region: "US (zero-retention API tier)" },
  { name: "Stripe", role: "Billing", data: "Email, plan, invoice events", region: "US" },
  { name: "AWS (us-east-1)", role: "Hosting + Postgres + S3", data: "All app data", region: "US" },
  { name: "Resend", role: "Transactional email", data: "Recipient email + message body", region: "US" },
];

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
      />

      {/* AUTH */}
      <SectionShell tone="default" eyebrow="Authentication" title="How we know it's you.">
        <ul className="grid gap-4 md:grid-cols-2">
          {AUTH_ITEMS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-start gap-3 mb-3">
                <IconTile icon={Icon} hover="lift" reveal className="size-9" />
                <h3 className="text-sm font-semibold text-foreground mt-1">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* RBAC */}
      <SectionShell
        tone="muted"
        eyebrow="Authorization"
        title="Four roles. Same data, different permissions."
        intro="Role assignment is set at invite time. Owners and admins can change roles for any member. Email-verified invites with a 6-digit code; suspend access in one click."
      >
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <li key={r.name} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="opacity-70" />
                <SeverityPill tone={r.tone}>{r.name}</SeverityPill>
              </div>
              <p className="text-[13px] leading-relaxed opacity-80">{r.body}</p>
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* DATA */}
      <SectionShell tone="default" eyebrow="Data" title="Where it lives, how it's protected.">
        <ul className="grid gap-4 md:grid-cols-2">
          {DATA_ITEMS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-start gap-3 mb-3">
                <IconTile icon={Icon} hover="lift" reveal className="size-9" />
                <h3 className="text-sm font-semibold text-foreground mt-1">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </li>
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
        title="Every action, logged forever."
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
            <div className="opacity-60">→ filing.submit · INV-4421 · ISF-10 · success</div>
            <div>2026-05-23T14:22:31Z · carlos@atlasapparel.com · operator · 198.51.100.7</div>
            <div className="opacity-60">→ ai.preflight.run · INV-4421 · 0 critical, 1 warning</div>
            <div>2026-05-23T14:24:55Z · alice@atlasapparel.com · operator · 192.0.2.14</div>
            <div className="opacity-60">→ filing.resubmit · INV-4421 · ISF-10 · accepted</div>
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
