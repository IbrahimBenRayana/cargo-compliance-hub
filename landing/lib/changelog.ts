// Single source of truth for release notes. Rendered in full on
// /changelog and as the "What's new" rail in the nav's Platform menu.
import type { Severity } from "@/components/ui/severity-pill";

export type EntryKind = "feature" | "improvement" | "fix" | "infra";

export type Entry = {
  date: string; // ISO
  kind: EntryKind;
  title: string;
  body: string;
  link?: { label: string; href: string };
};

export const KIND_TONE: Record<EntryKind, Severity> = {
  feature: "amber",
  improvement: "emerald",
  fix: "blue",
  infra: "neutral",
};

export const KIND_LABEL: Record<EntryKind, string> = {
  feature: "New",
  improvement: "Improved",
  fix: "Fixed",
  infra: "Infra",
};

export const CHANGELOG_ENTRIES: Entry[] = [
  {
    date: "2026-05-22",
    kind: "fix",
    title: "HTS codes preserved in full",
    body: "The DB now keeps the full 10-digit HTS you enter. We only truncate to 6 digits at the CustomsCity ABI boundary — so duty-calc previews, history search, and PDF exports all show the real code.",
    link: { label: "Filings", href: "/platform/filings" },
  },
  {
    date: "2026-05-21",
    kind: "feature",
    title: "Terminal 49 container tracking — phase 1",
    body: "Containers attached to your filings now poll Terminal 49 for live in-transit status. Surfaces vessel ETAs and port arrivals in the action queue.",
    link: { label: "Lifecycle", href: "/platform/lifecycle" },
  },
  {
    date: "2026-05-20",
    kind: "feature",
    title: "ADD/CVD orders synced from the Federal Register",
    body: "The full Antidumping & Countervailing Duty docket from the Federal Register now syncs daily at 04:00 UTC into our DB. Look up by HTS, country, or case number.",
    link: { label: "Compliance Center · Classification", href: "/platform/compliance#classification" },
  },
  {
    date: "2026-05-20",
    kind: "feature",
    title: "True score snapshots at every scoring event",
    body: "Every time a filing's compliance score recomputes, we persist a snapshot. Score history sparkline + event ticker on the lifecycle page now shows the full path.",
    link: { label: "Lifecycle", href: "/platform/lifecycle" },
  },
  {
    date: "2026-05-19",
    kind: "improvement",
    title: "Notification → Compliance Center deep-link",
    body: "Clicking a notification (in-app or email) now lands you on the exact action-queue card with an amber halo pulse, so you can spot it instantly.",
    link: { label: "Automation", href: "/platform/automation" },
  },
  {
    date: "2026-05-18",
    kind: "feature",
    title: "Risk & Watch + Records tabs redesigned",
    body: "UFLPA Risk Inbox with severity rails. 5106 EIN self-check. Liquidation Pipeline with 314-day window and PSC marker at day 270. Urgent entries rise to the top.",
    link: { label: "Compliance Center · Risk & Watch", href: "/platform/compliance#risk" },
  },
  {
    date: "2026-05-17",
    kind: "feature",
    title: "AI 1-line \"Today's brief\"",
    body: "A single ≤140-character sentence at the top of the Compliance Center. Auto-generated each login. Rule-based fallback when AI is disabled.",
    link: { label: "AI", href: "/platform/ai" },
  },
  {
    date: "2026-05-15",
    kind: "feature",
    title: "Classification tab + Risk/Records polish",
    body: "HTS Classifier, ADD/CVD Lookup, and FTA Preference Calculator (17 programs) all live under one tab. Risk + Records tabs polished for visual consistency.",
    link: { label: "Compliance Center · Classification", href: "/platform/compliance#classification" },
  },
  {
    date: "2026-05-14",
    kind: "feature",
    title: "Card grid + donut score + drafts in queue",
    body: "Compliance Center Overview is now a card grid with per-filing donut scores. Drafts show up in the queue alongside accepted and rejected filings.",
    link: { label: "Compliance Center · Overview", href: "/platform/compliance#overview" },
  },
  {
    date: "2026-05-12",
    kind: "feature",
    title: "Compliance Center rethought as an action inbox",
    body: "Instead of a dashboard, the Compliance Center is now an inbox. Cards ranked by urgency. Today's brief at the top. AI coach on every row.",
    link: { label: "Compliance Center", href: "/platform/compliance" },
  },
  {
    date: "2026-05-10",
    kind: "feature",
    title: "AI pre-flight for drafts",
    body: "Run an AI review on any draft / submitted / on-hold filing before re-submitting. Surfaces UFLPA risks, PGA flags, rule-based issues, and suggestions.",
    link: { label: "AI · Pre-flight mode", href: "/platform/ai" },
  },
  {
    date: "2026-05-07",
    kind: "feature",
    title: "Compliance Center v1",
    body: "First version of the 4-tab importer hub: Overview, Risk & Watch, Classification, Records. Plus the first AI rejection coach.",
    link: { label: "Compliance Center", href: "/platform/compliance" },
  },
  {
    date: "2026-05-04",
    kind: "improvement",
    title: "Rejection details as scannable cards",
    body: "CBP rejection responses are now rendered as scannable cards with the error code, suggested fix, and a one-click 'Ask AI Coach' button — instead of raw JSON.",
    link: { label: "Lifecycle · Rejections", href: "/platform/lifecycle" },
  },
  {
    date: "2026-05-02",
    kind: "feature",
    title: "6-digit email verification on sign-up",
    body: "Big-tech pattern: a 6-digit code sent to your email gets your account verified. Single-use, time-limited.",
    link: { label: "Security", href: "/security" },
  },
  {
    date: "2026-04-28",
    kind: "improvement",
    title: "Plan-limit + celebration modals redesigned",
    body: "Calmer, more Stripe-flavored modal styling for plan-limit hits and successful first-filing celebrations.",
    link: { label: "Pricing", href: "/pricing" },
  },
];

export function formatChangelogDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
