"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Globe, Sun } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { Container } from "@/components/ui/container";
import { SeverityPill, type Severity } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";
import {
  useSystemStatus,
  formatSecondsAgo,
  formatUtcTime,
} from "@/lib/systemStatus";


const platformLinks = [
  { label: "Filings", href: "/platform/filings" },
  { label: "Compliance Center", href: "/platform/compliance" },
  { label: "AI", href: "/platform/ai" },
  { label: "Lifecycle", href: "/platform/lifecycle" },
  { label: "Automation", href: "/platform/automation" },
  { label: "All features", href: "/features" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Solutions", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

const resourcesLinks = [
  { label: "Security", href: "/security" },
  { label: "Changelog", href: "/changelog" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
];

type LinkItem = { label: string; href: string };

// ──────────────────────────────────────────────────────────────────────────
// Desktop column — title + flat list of links.
// ──────────────────────────────────────────────────────────────────────────

function FooterColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: LinkItem[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile accordion section — collapses each link group.
// ──────────────────────────────────────────────────────────────────────────

function MobileAccordion({
  title,
  links,
}: {
  title: string;
  links: LinkItem[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="space-y-3 pb-5">
          {links.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Status ticker — animated ping dot + live-feel system metrics.
// ──────────────────────────────────────────────────────────────────────────

function StatusTicker() {
  const status = useSystemStatus();

  // Fallback strings while the initial fetch is in flight or if the endpoint
  // is unreachable. These are neutral wording that doesn't imply a specific
  // freshness — the live values overwrite once the fetch resolves.
  const cbpText = status
    ? `Last CBP ping: ${formatSecondsAgo(status.cbp.lastPingSecondsAgo) ?? "—"}`
    : "Last CBP ping: —";
  const addCvdText = status
    ? `ADD/CVD: synced ${formatUtcTime(status.addCvd.lastSyncedIso) ?? "—"}`
    : "ADD/CVD: syncing…";
  const incidentText = status
    ? `Open incidents: ${status.openIncidents}`
    : "Open incidents: —";

  // Dot color mirrors CBP-poll health. Amber if the poll is stale (missed
  // one cycle), emerald otherwise. Falls back to emerald pre-fetch so the
  // strip doesn't render "degraded" before we know.
  const cbpDotClass = status && !status.cbp.healthy
    ? "bg-amber-500"
    : "bg-emerald-500";
  const cbpPingClass = status && !status.cbp.healthy
    ? "bg-amber-500/60"
    : "bg-emerald-500/60";

  return (
    <div
      className="flex flex-col items-start gap-2 font-mono text-[11px] tracking-wide text-muted-foreground sm:flex-row sm:items-center sm:gap-4"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2">
        <span className="relative flex size-2">
          <span
            aria-hidden
            className={cn(
              "absolute inline-flex size-full rounded-full motion-safe:animate-ping",
              cbpPingClass,
            )}
          />
          <span className={cn("relative inline-flex size-2 rounded-full", cbpDotClass)} />
        </span>
        <span className="tabular-nums">{cbpText}</span>
      </span>
      <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">
        ·
      </span>
      <span className="tabular-nums">{addCvdText}</span>
      <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">
        ·
      </span>
      <span className="tabular-nums">{incidentText}</span>
    </div>
  );
}

/**
 * Emerald pill when everything's healthy, amber when at least one signal
 * is stale or incidents are open. Renders the same shape as the previous
 * hard-coded pill so accordion / spacing layouts don't shift.
 */
function SystemStatusBadge() {
  const status = useSystemStatus();

  const operational = status?.allSystemsOperational ?? true;
  const tone: Severity = operational ? "emerald" : "amber";
  const dotBg = operational ? "bg-emerald-500" : "bg-amber-500";
  const dotPing = operational ? "bg-emerald-500/60" : "bg-amber-500/60";
  const label = operational ? "All systems operational" : "Degraded — see status";

  return (
    <SeverityPill tone={tone}>
      <span className="relative mr-1.5 flex size-1.5">
        <span
          aria-hidden
          className={cn(
            "absolute inline-flex size-full rounded-full motion-safe:animate-ping",
            dotPing,
          )}
        />
        <span className={cn("relative inline-flex size-1.5 rounded-full", dotBg)} />
      </span>
      {label}
    </SeverityPill>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-border/60 bg-secondary/20">
      {/* Top gold hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(43 96% 56% / 0.45) 35%, hsl(43 96% 56% / 0.45) 65%, transparent 100%)",
        }}
      />

      <Container>
        <div className="py-20 lg:py-28">
          {/* ── Desktop / tablet grid ─────────────────────────────── */}
          <div className="hidden grid-cols-12 gap-10 md:grid">
            {/* Brand — 4 cols */}
            <div className="col-span-12 lg:col-span-4">
              <Link
                href="/"
                className="mb-5 inline-block transition-opacity hover:opacity-90"
              >
                <Wordmark />
              </Link>
              <p className="mb-6 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Calm customs compliance for ops teams.
              </p>
              <Link
                href="/security"
                className="mb-6 inline-flex"
                aria-label="System status"
              >
                <SystemStatusBadge />
              </Link>
            </div>

            {/* Platform — 3 cols */}
            <FooterColumn
              className="col-span-4 lg:col-span-3"
              title="Platform"
              links={platformLinks}
            />

            {/* Company — 3 cols */}
            <FooterColumn
              className="col-span-4 lg:col-span-3"
              title="Company"
              links={companyLinks}
            />

            {/* Resources — 2 cols */}
            <FooterColumn
              className="col-span-4 lg:col-span-2"
              title="Resources"
              links={resourcesLinks}
            />
          </div>

          {/* ── Mobile — brand + accordion ───────────────────────── */}
          <div className="md:hidden">
            <Link
              href="/"
              className="mb-4 inline-block transition-opacity hover:opacity-90"
            >
              <Wordmark />
            </Link>
            <p className="mb-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Calm customs compliance for ops teams.
            </p>
            <Link
              href="/security"
              className="mb-5 inline-flex"
              aria-label="System status"
            >
              <SystemStatusBadge />
            </Link>
            <div className="mt-8 border-t border-border/60">
              <MobileAccordion title="Platform" links={platformLinks} />
              <MobileAccordion title="Company" links={companyLinks} />
              <MobileAccordion title="Resources" links={resourcesLinks} />
            </div>
          </div>
        </div>

        {/* Status ticker */}
        <div className="border-t border-border/60 py-5">
          <StatusTicker />
        </div>

        {/* Bottom row — copyright + locale/theme */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-border/60 py-5 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 MyCargoLens. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              aria-label="Change language"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-2 py-1 transition-colors hover:text-foreground"
            >
              <Globe className="size-3.5" aria-hidden />
              <span>English (US)</span>
            </button>
            <button
              type="button"
              aria-label="Toggle theme"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-2 py-1 transition-colors hover:text-foreground"
            >
              <Sun className="size-3.5" aria-hidden />
              <span>Light</span>
            </button>
          </div>
        </div>
      </Container>
    </footer>
  );
}
