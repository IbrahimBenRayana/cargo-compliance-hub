"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Globe, Sun } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { Container } from "@/components/ui/container";
import { SeverityPill } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

// Inline brand SVGs — lucide-react v1 removed all brand icons.
const GithubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const socialLinks = [
  { label: "GitHub", href: "https://github.com", Icon: GithubIcon },
  { label: "Twitter / X", href: "https://twitter.com", Icon: XIcon },
  { label: "LinkedIn", href: "https://linkedin.com", Icon: LinkedInIcon },
];

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
  return (
    <div className="flex flex-col items-start gap-2 font-mono text-[11px] tracking-wide text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
      <span className="inline-flex items-center gap-2">
        <span className="relative flex size-2">
          <span
            aria-hidden
            className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping"
          />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="tabular-nums">Last CBP ping: 14s ago</span>
      </span>
      <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">
        ·
      </span>
      <span className="tabular-nums">ADD/CVD: synced 04:02 UTC</span>
      <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">
        ·
      </span>
      <span className="tabular-nums">Open incidents: 0</span>
    </div>
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
                aria-label="System status — all systems operational"
              >
                <SeverityPill tone="emerald">
                  <span className="relative mr-1.5 flex size-1.5">
                    <span
                      aria-hidden
                      className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping"
                    />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  All systems operational
                </SeverityPill>
              </Link>
              <div className="flex items-center gap-3 pt-1">
                {socialLinks.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Icon />
                  </a>
                ))}
              </div>
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
              aria-label="System status — all systems operational"
            >
              <SeverityPill tone="emerald">
                <span className="relative mr-1.5 flex size-1.5">
                  <span
                    aria-hidden
                    className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping"
                  />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                All systems operational
              </SeverityPill>
            </Link>
            <div className="mb-8 flex items-center gap-3">
              {socialLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Icon />
                </a>
              ))}
            </div>

            <div className="border-t border-border/60">
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
