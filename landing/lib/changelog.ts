// Single source of truth for release notes, rendered on /changelog.
// Entry fixes per copy/changelog.md §5 (website rebuild, Oct 2026).
// Every entry links the module page it changed ("See it", site-architecture §7.1).

export type EntryKind = "feature" | "improvement" | "fix" | "retired";

export type Entry = {
  /**
   * ISO, the day the change reached production. Sorts entries newest-first,
   * and the newest one is /changelog's lastModified in sitemap.ts. Never
   * rendered and never output as schema (founder rule, Oct 26: no company
   * dates on the site).
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
    date: "2026-11-25",
    kind: "improvement",
    title: "Rejected changes keep the accepted version on screen",
    body: "When CBP rejects a change to a filing it already holds, the filing keeps showing the version CBP accepted, and the alert tells you the change was rejected. On entries your edits are saved, and Reopen rejected changes puts them back so you can fix and resend.",
    href: "/platform/customs-entry",
  },
  {
    date: "2026-11-25",
    kind: "improvement",
    title: "Deadline alerts for rejected ISFs",
    body: "A rejected ISF still has a deadline, so it now gets the deadline alerts and a place in the inbox. An ISF past its cutoff stays in the inbox, marked as passed.",
    href: "/platform/isf-filing",
  },
  {
    date: "2026-11-25",
    kind: "improvement",
    title: "AI pre-flight review built on the rule check",
    body: "The will-reject and warning sections of the AI pre-flight review now come from the same rule check that runs before submit. Agency (PGA) hints were checked against CBP's agency tariff flag reference and are worded as things to confirm for your product.",
    href: "/platform/pre-filing-checks",
  },
  {
    date: "2026-11-25",
    kind: "improvement",
    title: "Rejection webhooks say what was rejected",
    body: "When CBP rejects a change to a filing it already holds, filing.rejected and entry.rejected carry action (REPLACE or DELETE) and onFile: true, which means the earlier version stays on file. Both fields are additive and documented in the OpenAPI file.",
    href: "/platform/api",
  },
  {
    date: "2026-11-17",
    kind: "improvement",
    title: "Redesigned filing screens",
    body: "Shipment detail, the ISF and entry wizards, the entries list, the duty calculator, logs, settings and team pages have a new layout.",
    href: "/platform",
  },
  {
    date: "2026-11-17",
    kind: "fix",
    title: "Port pickers rebuilt from CBP's Schedule D and Schedule K",
    body: "Port fields in the ISF and entry wizards now use CBP's own codes and names: 516 US ports from Schedule D and 2,146 foreign ports from Schedule K. They replace a list that had wrong names against some codes.",
    href: "/platform/isf-filing",
  },
  {
    date: "2026-10-28",
    kind: "feature",
    title: "ISF price on the website: $45 per accepted ISF",
    body: "ISF-10 and ISF-5 cost $45 per accepted ISF, with no monthly fee. Your card is charged when CBP accepts the filing, and drafts, rejected filings and amendments cost nothing.",
    href: "/pricing",
  },
  {
    date: "2026-10-28",
    kind: "feature",
    title: "Entry types 03 and 11, with trade programs per line",
    body: "Entry summaries now cover consumption entries with AD/CVD cases (type 03) and informal entries (type 11) alongside type 01. Each line can carry a trade program claim such as USMCA and the Chapter 99 numbers that apply to it.",
    href: "/platform/customs-entry",
  },
  {
    date: "2026-10-28",
    kind: "feature",
    title: "CSV import for invoice lines and a duty estimate on review",
    body: "Fill in the CSV template to import an entry's invoice lines in one go. Each row is checked and errors point to the row. The review step shows estimated duties and fees before you send.",
    href: "/platform/customs-entry",
  },
  {
    date: "2026-10-28",
    kind: "improvement",
    title: "ISF deadline from the lading date, and several manufacturers",
    body: "Enter the estimated lading date and the ISF gets its exact deadline, 24 hours before lading. An ISF-10 can list several manufacturers, each with its own HTS lines.",
    href: "/platform/isf-filing",
  },
  {
    date: "2026-10-28",
    kind: "improvement",
    title: "PSC deadline at 300 days from entry",
    body: "The inbox and the liquidation timeline put the post-summary correction (PSC) deadline at 300 days from the date of entry, CBP's regular PSC window.",
    href: "/platform/compliance",
  },
  {
    date: "2026-10-28",
    kind: "feature",
    title: "Password reset by email",
    body: "Request a reset link from the sign-in page. The link works once and expires after an hour.",
    href: "/security",
  },
  {
    date: "2026-10-28",
    kind: "improvement",
    title: "Stricter roles, and API keys tied to their creator",
    body: "Viewers are read-only everywhere, and only owners and admins can change the plan or the card. Creating an API key or a webhook requires a verified email and MFA, key creation and revocation go in the audit trail, and removing a team member revokes their keys.",
    href: "/security",
  },
  {
    date: "2026-10-28",
    kind: "improvement",
    title: "Phone and tablet layouts, and accessibility fixes",
    body: "Lists, filters and row actions work at phone and tablet widths without sideways scrolling. Status badges meet 4.5:1 contrast, and icon buttons, filters and progress bars have names for screen readers.",
    href: "/platform",
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

/** Permalink anchor from the title only (no date): "type-86-entries-retired". */
export function entryAnchor(e: Pick<Entry, "title">) {
  return e.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
