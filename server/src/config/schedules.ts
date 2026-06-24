/**
 * Centralised cron schedules + polling thresholds for background jobs.
 *
 * Why this module exists: cadence values were previously scattered as inline
 * literals across backgroundJobs.ts (six different cron strings) and a few
 * route helpers. Operators tuning a window or auditing what runs when had
 * to grep the codebase to find them. Grouping them here makes the schedule
 * a single legible table.
 *
 * All cron expressions are UTC-anchored — the consumer must pass
 * `{ timezone: 'UTC' }` to node-cron, otherwise host TZ leaks in.
 */

/** node-cron expression strings — keep grouped so the schedule reads as a table. */
export const CRON = {
  /** Every 5 minutes — poll CC for CBP responses on submitted filings. */
  STATUS_POLL: '*/5 * * * *',
  /** Hourly at :30 — deadline-alert sweep. */
  DEADLINE_ALERTS: '30 * * * *',
  /** Every 6 hours — flag stale filings the user hasn't touched. */
  STALE_CHECK: '0 */6 * * *',
  /** Every 30 seconds — drain queued email deliveries. */
  EMAIL_DELIVERY_DRAIN: '*/30 * * * * *',
  /** Daily at 04:00 UTC — sync ADD/CVD candidates from Federal Register. */
  ADD_CVD_SYNC: '0 4 * * *',
  /** Every 5 minutes — reap ABI documents stuck in SENDING > 15 min. */
  ABI_REAPER: '*/5 * * * *',
  /** Hourly at :15 — retry per-shipment charges that failed (delinquent orgs). */
  CHARGE_RETRY: '15 * * * *',
} as const;

/**
 * Reaper threshold for ABI documents stuck in SENDING. Comfortably larger
 * than any legitimate CC round-trip (typical 2-3 s, p99 well under a minute).
 */
export const ABI_SENDING_TIMEOUT_MS = 15 * 60 * 1000;

/** CC poll-for-completion cadence used by abiDocuments + manifestQuery. */
export const CC_POLL_INTERVAL_MS = 3000;
