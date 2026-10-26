// Single source of truth for release notes, rendered on /changelog.
// Entry fixes per copy/changelog.md §5 (website rebuild, Oct 2026).
// Every entry links the module page it changed ("See it", site-architecture §7.1).

export type EntryKind = "feature" | "improvement" | "fix" | "retired";

export type Entry = {
  /**
   * ISO. Used only to sort entries newest-first. Never rendered and never
   * output as schema (founder rule, Oct 26: no company dates on the site).
   */
  date: string;
  kind: EntryKind;
  title: string;
  body: string;
  /** "See it" link to the page this entry changed. */
  href: string;
};

export const KIND_LABEL: Record<EntryKind, string> = {
  feature: "New",
  improvement: "Improved",
  fix: "Fixed",
  retired: "Retired",
};

const ENTRIES: Entry[] = [
  {
    date: "2026-10-26",
    kind: "feature",
    title: "CBP responses every minute",
    body: "CBP responses are picked up every minute, and any transmission CBP hasn't answered gets flagged. Every request and response is logged on the filing.",
    href: "/platform/inbox",
  },
  {
    date: "2026-08-06",
    kind: "retired",
    title: "Type 86 entries retired",
    body: "CBP discontinued Type 86 (Section 321) entries effective June 24, 2026, so we no longer offer them.",
    href: "/platform/customs-entry",
  },
  {
    date: "2026-07-22",
    kind: "feature",
    title: "Public API v1 for brokers & 3PLs",
    body: "A REST API for teams who'd rather integrate than click. Scoped API keys (prefixed mcl_live_, revocable), ISF and entry read/write, XML upload, and webhooks for status changes.",
    href: "/platform/api",
  },
  {
    date: "2026-07-08",
    kind: "feature",
    title: "Multi-factor authentication",
    body: "Every account can now enroll in MFA: authenticator-app TOTP, email one-time codes as a fallback, and single-use recovery codes for when you lose your device.",
    href: "/security",
  },
  {
    date: "2026-06-29",
    kind: "feature",
    title: "AI assistant with live human handoff",
    body: "A chat assistant that answers questions about your own filings and deep-links you to the exact screen. When you'd rather talk to a person, it hands the conversation to our team live, with full context, so you don't repeat yourself.",
    href: "/platform/inbox",
  },
  {
    date: "2026-05-22",
    kind: "fix",
    title: "HTS codes preserved in full",
    body: "We now keep the full 10-digit HTS code you enter, so duty previews, history search and PDF exports all show the real code.",
    href: "/platform/customs-entry",
  },
  {
    date: "2026-05-21",
    kind: "feature",
    title: "Terminal 49 container tracking: phase 1",
    body: "Containers attached to your filings now poll Terminal 49 for live in-transit status. Surfaces vessel ETAs and port arrivals in the action queue.",
    href: "/platform/compliance",
  },
  {
    date: "2026-05-20",
    kind: "feature",
    title: "ADD/CVD orders synced from the Federal Register",
    body: "New antidumping and countervailing duty orders are pulled from the Federal Register every day and reviewed before they're used in flags. Look them up by HTS code, country or case number.",
    href: "/platform/compliance",
  },
  {
    date: "2026-05-20",
    kind: "feature",
    title: "True score snapshots at every scoring event",
    body: "Every time a filing's compliance score recomputes, we persist a snapshot. Score history sparkline + event ticker on the lifecycle page now shows the full path.",
    href: "/platform/compliance",
  },
  {
    date: "2026-05-19",
    kind: "improvement",
    title: "Notification → Compliance Center deep-link",
    body: "Clicking a notification (in-app or email) now lands you on the exact action-queue card with an amber halo pulse, so you can spot it instantly.",
    href: "/platform/inbox",
  },
  {
    date: "2026-05-18",
    kind: "feature",
    title: "Risk & Watch + Records tabs redesigned",
    body: "Possible UFLPA exposure gets its own list, ranked by severity. A CBP Form 5106 importer-number check. The liquidation pipeline shows the 314-day window with the PSC marker. Urgent entries rise to the top.",
    href: "/platform/compliance",
  },
  {
    date: "2026-05-17",
    kind: "feature",
    title: "AI 1-line \"Today's brief\"",
    body: "A single ≤140-character sentence at the top of the Compliance Center. Generated daily. Rule-based fallback when AI is disabled.",
    href: "/platform/inbox",
  },
  {
    date: "2026-05-15",
    kind: "feature",
    title: "Classification tab + Risk/Records polish",
    body: "HTS suggestions, ADD/CVD lookup and the FTA lookup now sit under one tab. Risk + Records tabs polished for visual consistency.",
    href: "/platform/compliance",
  },
  {
    date: "2026-05-14",
    kind: "feature",
    title: "Card grid + donut score + drafts in queue",
    body: "Compliance Center Overview is now a card grid with per-filing donut scores. Drafts show up in the queue alongside accepted and rejected filings.",
    href: "/platform/inbox",
  },
  {
    date: "2026-05-12",
    kind: "feature",
    title: "Compliance Center rethought as an action inbox",
    body: "Instead of a dashboard, the Compliance Center is now an inbox. Cards ranked by urgency. Today's brief at the top. AI coach on every row.",
    href: "/platform/inbox",
  },
  {
    date: "2026-05-10",
    kind: "feature",
    title: "AI pre-flight for drafts",
    body: "Run an AI review on any draft / submitted / on-hold filing before re-submitting. Points out possible UFLPA exposure, PGA flags, rule-based issues, and suggestions.",
    href: "/platform/pre-filing-checks",
  },
  {
    date: "2026-05-07",
    kind: "feature",
    title: "Compliance Center v1",
    body: "First version of the 4-tab importer hub: Overview, Risk & Watch, Classification, Records. Plus the first AI rejection coach.",
    href: "/platform/inbox",
  },
  {
    date: "2026-05-04",
    kind: "improvement",
    title: "Rejection details as scannable cards",
    body: "CBP rejection responses are now rendered as scannable cards with the error code, suggested fix, and a one-click 'Ask AI Coach' button, instead of raw JSON.",
    href: "/platform/pre-filing-checks",
  },
  {
    date: "2026-05-02",
    kind: "feature",
    title: "6-digit email verification for new team members",
    body: "A 6-digit code sent to your email verifies your account. Single-use, time-limited.",
    href: "/security",
  },
];

/** Every entry, newest first. */
export const CHANGELOG_ENTRIES: Entry[] = [...ENTRIES].sort((a, b) => b.date.localeCompare(a.date));

/** Permalink anchor from the title only (no date): "cbp-responses-every-minute". */
export function entryAnchor(e: Pick<Entry, "title">) {
  return e.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
