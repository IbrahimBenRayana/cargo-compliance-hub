/**
 * Background Jobs Service
 * 
 * Runs automated tasks on a schedule:
 * 
 * 1. STATUS POLLING — Every 5 min: Checks CustomsCity for CBP responses
 *    on all "submitted" filings, updates status, creates notifications
 * 
 * 2. DEADLINE ALERTS — Every hour: Scans all draft/submitted filings with
 *    approaching deadlines (72h, 48h, 24h) and creates warning notifications
 * 
 * 3. STALE FILING CLEANUP — Every 6 hours: Flags filings that have been
 *    "submitted" for > 72 hours without a CBP response (possible issue)
 */

import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../config/database.js';
import { ccClient } from './customscity.js';
import logger from '../config/logger.js';
import { isValidTransition } from './validation.js';
import {
  notifyFilingAccepted,
  notifyFilingRejected,
  notifyDeadlineApproaching,
  notifyOrgUsers,
} from './notifications.js';
import { drainEmailDeliveries } from './notificationDeliveryWorker.js';
import { recordScoreSnapshot, triggerForStatus } from './compliance/scoreSnapshot.js';
import { syncFromFederalRegister } from './compliance/addCvdSync.js';
import { invalidateAddCvdCache } from './compliance/addCvd.js';
import { CRON, ABI_SENDING_TIMEOUT_MS } from '../config/schedules.js';

// ─── Job State ─────────────────────────────────────────────

let isStatusPollRunning = false;
let isDeadlineCheckRunning = false;
let lastStatusPoll: Date | null = null;
let lastDeadlineCheck: Date | null = null;
let statusPollStats = { checked: 0, updated: 0, errors: 0 };

// Stale-filing dedup is delegated to the dispatcher's persistent dedupeKey
// (Notification.dedupeKey is @unique), so it survives restarts and concurrent
// callers. The previous in-memory Set re-fired the same alert on every restart,
// which produced "No CBP Response" notifications for filings 7+ weeks old.

// ─── 1. STATUS POLLING JOB ────────────────────────────────

async function pollSubmittedFilings(): Promise<void> {
  if (isStatusPollRunning) {
    logger.debug('[Jobs:StatusPoll] Skipping — previous run still in progress');
    return;
  }

  isStatusPollRunning = true;
  const startTime = Date.now();
  let checked = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Get all submitted filings across all organizations
    const submittedFilings = await prisma.filing.findMany({
      where: {
        status: 'submitted',
      },
      include: {
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true } },
      },
      orderBy: { submittedAt: 'asc' },
      take: 50, // Process max 50 per cycle to avoid overloading CC API
    });

    if (submittedFilings.length === 0) {
      isStatusPollRunning = false;
      lastStatusPoll = new Date();
      return;
    }

    logger.info({ count: submittedFilings.length }, '[Jobs:StatusPoll] Checking submitted filings');

    // Process in concurrent batches of 5 to respect CC API rate limits
    const CONCURRENCY = 5;
    for (let i = 0; i < submittedFilings.length; i += CONCURRENCY) {
      const batch = submittedFilings.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(async (filing) => {
        try {
          const masterBol = filing.masterBol;
          const houseBol = filing.houseBol;
          if (!masterBol && !houseBol) return;

          const statusParams: Record<string, string> = { manifestType: 'ISF', skip: '0' };
          if (masterBol) statusParams.masterBOLNumber = masterBol;
          else if (houseBol) statusParams.houseBOLNumber = houseBol;

          const statusResult = await ccClient.getDocumentStatus(statusParams);
          checked++;

          const documents = statusResult.data?.data ?? [];
          const matchingDoc = documents.find((d: any) =>
            (houseBol && d.bol === houseBol) || (masterBol && d.masterBOL === masterBol)
          ) || documents[0];

          let messages: any[] = [];
          if (houseBol) {
            try {
              const dateFrom = filing.submittedAt
                ? new Date(new Date(filing.submittedAt).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                : '2025-01-01';
              const dateTo = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
              const msgParams: Record<string, string> = {
                type: 'ISF', houseBOLNumber: houseBol, skip: '0', dateFrom, dateTo, typeDate: 'createdDate',
              };
              if (masterBol) msgParams.masterBOLNumber = masterBol;
              const msgResult = await ccClient.getMessages(msgParams);
              messages = msgResult.data?.data ?? [];
            } catch (err: any) {
              // Non-fatal — we may have created the filing before CC
              // accepted any messages. Still log a breadcrumb so a
              // pattern of failures becomes visible.
              logger.warn({ err: err?.message, houseBol }, '[Jobs:StatusPoll] CC getMessages failed (non-fatal)');
            }
          }

          const ccStatus = matchingDoc?.status?.toUpperCase();
          let newStatus: string | null = null;
          if (ccStatus === 'ACCEPTED' || ccStatus === 'BILL ACCEPTED') newStatus = 'accepted';
          else if (ccStatus === 'REJECTED' || ccStatus === 'BILL REJECTED') newStatus = 'rejected';
          else if (ccStatus === 'ON HOLD' || ccStatus === 'HELD') newStatus = 'on_hold';

          if (!newStatus && messages.length > 0) {
            const hasAccepted = messages.some((m: any) => m.description?.includes('ACCEPTED') || m.description?.includes('BILL ACCEPTED'));
            const hasRejected = messages.some((m: any) => m.description?.includes('REJECTED') || m.statusCode === 'REJECTED');
            if (hasAccepted && !hasRejected) newStatus = 'accepted';
            else if (hasRejected) newStatus = 'rejected';
          }

          if (newStatus && newStatus !== filing.status && isValidTransition(filing.status, newStatus)) {
            updated++;

            let rejectionReason: string | undefined;
            if (newStatus === 'rejected') {
              rejectionReason = messages
                .filter((m: any) => m.description?.includes('REJECTED') || m.statusCode === 'REJECTED')
                .map((m: any) => m.description).join('; ')
                || matchingDoc?.lastEvent?.codeDescription || 'Rejected by CBP';
            }

            const isfTxnNumber = messages.find((m: any) => m.ISFTransactionNumber)?.ISFTransactionNumber;

            // Atomic per-filing write: filing + history + submissionLog land
            // together in one transaction so a crash mid-update can't leave
            // the filing in a new state with no history row to explain it.
            // The updateMany predicate (status='submitted') ensures a
            // concurrent worker that won the race affects 0 rows — we then
            // return null and short-circuit without firing duplicate
            // notifications. recordScoreSnapshot and notify* run AFTER the
            // tx commits so they don't extend the lock window.
            const committed = await prisma.$transaction(async (tx) => {
              const claimed = await tx.filing.updateMany({
                where: { id: filing.id, status: 'submitted' },
                data: {
                  status: newStatus,
                  acceptedAt: newStatus === 'accepted' ? new Date() : undefined,
                  // Clear rejection metadata when CBP accepts — otherwise the
                  // "previous rejection" panel keeps surfacing stale text on
                  // accepted filings. History stays in FilingStatusHistory.
                  rejectedAt: newStatus === 'accepted' ? null
                    : newStatus === 'rejected' ? new Date()
                    : undefined,
                  rejectionReason: newStatus === 'accepted' ? null
                    : newStatus === 'rejected' ? (rejectionReason ?? undefined)
                    : undefined,
                  cbpTransactionId: isfTxnNumber ?? filing.cbpTransactionId ?? undefined,
                },
              });
              if (claimed.count === 0) return false; // another worker won

              await tx.filingStatusHistory.create({
                data: {
                  filingId: filing.id,
                  status: newStatus,
                  message: newStatus === 'accepted'
                    ? `CBP accepted the ISF filing${isfTxnNumber ? ` (ISF Txn: ${isfTxnNumber})` : ''} [auto-poll]`
                    : newStatus === 'rejected'
                    ? `CBP rejected: ${rejectionReason} [auto-poll]`
                    : `CBP placed filing on hold [auto-poll]`,
                  ccResponse: { documentStatus: matchingDoc, messages } as any,
                  changedById: filing.createdById,
                },
              });

              await tx.submissionLog.create({
                data: {
                  orgId: filing.orgId, filingId: filing.id, userId: filing.createdById,
                  method: 'GET', url: '/api/document-status [auto-poll]',
                  requestPayload: statusParams as any,
                  responseStatus: statusResult.status,
                  responseBody: statusResult.data as any,
                  latencyMs: statusResult.latencyMs,
                },
              });

              return true;
            });

            if (!committed) {
              // Another worker already advanced this filing — skip the
              // side effects so we don't double-notify the org.
              return;
            }

            await recordScoreSnapshot(filing.id, triggerForStatus(newStatus));

            const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
            if (newStatus === 'accepted') {
              await notifyFilingAccepted(filing.orgId, filing.id, bol);
              logger.info({ bol }, '[Jobs:StatusPoll] Filing ACCEPTED by CBP');
            } else if (newStatus === 'rejected') {
              await notifyFilingRejected(filing.orgId, filing.id, bol, rejectionReason);
              logger.info({ bol, rejectionReason }, '[Jobs:StatusPoll] Filing REJECTED by CBP');
            } else if (newStatus === 'on_hold') {
              await notifyOrgUsers(filing.orgId, filing.id, 'filing_on_hold', 'Filing On Hold ⏸️',
                `ISF filing ${bol} has been placed on hold by CBP.`);
              logger.info({ bol }, '[Jobs:StatusPoll] Filing placed ON HOLD by CBP');
            }
          }
        } catch (err: any) {
          errors++;
          logger.warn({ filingId: filing.id, err: err.message }, '[Jobs:StatusPoll] Error checking filing');
        }
      }));
    }

    const elapsed = Date.now() - startTime;
    statusPollStats = { checked, updated, errors };
    logger.info({ elapsed, checked, updated, errors }, '[Jobs:StatusPoll] Done');
  } catch (err: any) {
    logger.error({ err: err.message }, '[Jobs:StatusPoll] Fatal error');
  } finally {
    isStatusPollRunning = false;
    lastStatusPoll = new Date();
  }
}

// ─── 2. DEADLINE ALERT JOB ────────────────────────────────

const DEADLINE_THRESHOLDS = [72, 48, 24]; // hours

async function checkDeadlines(): Promise<void> {
  if (isDeadlineCheckRunning) {
    logger.debug('[Jobs:Deadlines] Skipping — previous run still in progress');
    return;
  }

  isDeadlineCheckRunning = true;

  try {
    // Find all draft and submitted filings with deadlines in the next 72 hours
    const now = new Date();
    const cutoff72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const filingsWithDeadlines = await prisma.filing.findMany({
      where: {
        status: { in: ['draft', 'submitted'] },
        filingDeadline: {
          not: null,
          lte: cutoff72h, // Deadline is within 72 hours
          gte: now,       // Deadline hasn't passed yet
        },
      },
      select: {
        id: true,
        orgId: true,
        masterBol: true,
        houseBol: true,
        filingDeadline: true,
        status: true,
      },
    });

    if (filingsWithDeadlines.length === 0) {
      isDeadlineCheckRunning = false;
      lastDeadlineCheck = new Date();
      return;
    }

    let alertsSent = 0;

    for (const filing of filingsWithDeadlines) {
      const hoursRemaining = (filing.filingDeadline!.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Find the appropriate threshold — dedup is handled inside notifyDeadlineApproaching via DB
      for (const threshold of DEADLINE_THRESHOLDS) {
        if (hoursRemaining <= threshold) {
          const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
          await notifyDeadlineApproaching(filing.orgId, filing.id, bol, threshold);
          alertsSent++;

          logger.info({ bol, hoursRemaining: Math.round(hoursRemaining), threshold }, '[Jobs:Deadlines] Deadline alert sent');

          // Only send the most relevant threshold (don't spam with 72h + 48h + 24h at once)
          break;
        }
      }
    }

    // Also check for OVERDUE filings (deadline passed but still draft)
    const overdueFilings = await prisma.filing.findMany({
      where: {
        status: 'draft',
        filingDeadline: {
          not: null,
          lt: now, // Deadline has passed
        },
      },
      select: {
        id: true,
        orgId: true,
        masterBol: true,
        houseBol: true,
        filingDeadline: true,
      },
    });

    for (const filing of overdueFilings) {
      const dedupeKey = `${filing.id}_overdue`;
      const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
      await notifyOrgUsers(
        filing.orgId,
        filing.id,
        'deadline_overdue',
        'Filing deadline overdue',
        `ISF filing ${bol} deadline has PASSED. Submit immediately to avoid CBP penalties ($5,000-$10,000).`,
        { dedupeKey, linkUrl: `/shipments/${filing.id}`, metadata: { bolNumber: bol } },
      );
      alertsSent++;

      logger.warn({ bol }, '[Jobs:Deadlines] OVERDUE filing');
    }

    if (alertsSent > 0) {
      logger.info({ alertsSent }, '[Jobs:Deadlines] Deadline alerts sent');
    }
  } catch (err: any) {
    logger.error({ err: err.message }, '[Jobs:Deadlines] Error');
  } finally {
    isDeadlineCheckRunning = false;
    lastDeadlineCheck = new Date();
  }
}

// ─── 3. STALE FILING DETECTION ────────────────────────────

async function checkStaleFilings(): Promise<void> {
  try {
    // Alert window: submitted between 14 days and 72 hours ago. The lower bound
    // (72h) is the "CBP should have responded by now" threshold; the upper bound
    // (14d) is the "user has clearly given up — stop nagging them" cap. Older
    // filings either got resolved offline or were abandoned; either way more
    // automated nags don't help.
    const now = Date.now();
    const staleThreshold  = new Date(now - 72 * 60 * 60 * 1000);
    const maxAgeThreshold = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const staleFilings = await prisma.filing.findMany({
      where: {
        status: 'submitted',
        submittedAt: {
          not: null,
          lt:  staleThreshold,
          gte: maxAgeThreshold,
        },
      },
      select: {
        id: true,
        orgId: true,
        masterBol: true,
        houseBol: true,
        submittedAt: true,
      },
    });

    for (const filing of staleFilings) {
      const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
      const hoursAgo = Math.round((now - filing.submittedAt!.getTime()) / (1000 * 60 * 60));

      // dedupeKey is globally @unique on Notification, so notify() short-circuits
      // on the second-and-Nth call for the same filing — no matter the restart,
      // no matter the concurrent caller. One "stale" alert per filing, ever.
      await notifyOrgUsers(
        filing.orgId,
        filing.id,
        'filing_stale',
        'No CBP Response',
        `ISF filing ${bol} was submitted ${hoursAgo}h ago but no CBP response received. Please check the filing status.`,
        { dedupeKey: `${filing.id}_stale` },
      );

      logger.warn({ bol, hoursAgo }, '[Jobs:StaleCheck] No CBP response for filing');
    }
  } catch (err: any) {
    logger.error({ err: err.message }, '[Jobs:StaleCheck] Error');
  }
}

// ─── ABI DOCUMENT REAPER ───────────────────────────────────
// audit Phase 7.3: if the server is killed between the DRAFT→SENDING
// claim and the final SENT update, the document gets stuck SENDING
// indefinitely — the dashboard shows in-flight rows that never resolve
// and a retry from the UI sees status=SENDING so it short-circuits.
// Every 5 minutes we scan for docs that have been SENDING for >15
// minutes and reconcile: if CC has an entry number for the document
// id we promote SENDING→SENT; otherwise we roll back to DRAFT so the
// user can retry. The 15-minute threshold is comfortably larger than
// any legitimate CC round-trip (typical 2-3s, p99 well under a minute).
let isAbiReaperRunning = false;
async function reapStuckAbiDocuments(): Promise<void> {
  if (isAbiReaperRunning) return; // re-entrant guard
  isAbiReaperRunning = true;
  try {
    const cutoff = new Date(Date.now() - ABI_SENDING_TIMEOUT_MS);
    const stuck = await prisma.abiDocument.findMany({
      where: { status: 'SENDING', sentAt: { lt: cutoff } },
      select: { id: true, orgId: true, ccDocumentId: true, sentAt: true },
    });
    if (stuck.length === 0) return;

    logger.warn({ count: stuck.length }, '[Jobs:AbiReaper] Found documents stuck in SENDING');

    for (const doc of stuck) {
      // Roll back to DRAFT so the user can retry. We deliberately don't
      // try to reach CC for reconciliation — the audit's recommendation
      // is to keep the reaper simple and let the user (or the next /send
      // call) drive the retry. Anything more interesting (auto-promote
      // to SENT when CC has an entry number) can layer on later.
      const claimed = await prisma.abiDocument.updateMany({
        where: { id: doc.id, status: 'SENDING', sentAt: { lt: cutoff } },
        data: {
          status: 'DRAFT',
          sentAt: null,
          lastError: 'Send timed out — automatic rollback by reaper. Please retry.',
        },
      });
      if (claimed.count === 0) {
        // Another path raced us and resolved the doc — fine, skip.
        continue;
      }
      logger.info({ docId: doc.id, orgId: doc.orgId }, '[Jobs:AbiReaper] Rolled SENDING back to DRAFT');
    }
  } catch (err: any) {
    logger.error({ err: err.message }, '[Jobs:AbiReaper] Failed');
  } finally {
    isAbiReaperRunning = false;
  }
}

// ─── SCHEDULER ─────────────────────────────────────────────

let statusPollTask: ScheduledTask | null = null;
let deadlineTask: ScheduledTask | null = null;
let staleCheckTask: ScheduledTask | null = null;
let deliveryDrainTask: ScheduledTask | null = null;
let addCvdSyncTask: ScheduledTask | null = null;
let abiReaperTask: ScheduledTask | null = null;

export function startBackgroundJobs(): void {
  logger.info('[Jobs] Starting background job scheduler');

  // All cron expressions are UTC-anchored — without `{ timezone: 'UTC' }`
  // node-cron uses the host's local TZ, which means a DST shift or VPS
  // re-imaged in a different region silently moves "04:00 UTC" by hours.
  // (Cross-replica advisory locking is tracked in audit Phase 7; the
  // in-process re-entrancy flags below cover the current single-VPS deploy.)
  const cronOpts = { timezone: 'UTC' } as const;

  statusPollTask = cron.schedule(CRON.STATUS_POLL, () => {
    pollSubmittedFilings().catch(err => logger.error({ err }, '[Jobs:StatusPoll] Unhandled'));
  }, cronOpts);
  logger.info('[Jobs] Status polling scheduled — every 5 minutes (UTC)');

  deadlineTask = cron.schedule(CRON.DEADLINE_ALERTS, () => {
    checkDeadlines().catch(err => logger.error({ err }, '[Jobs:Deadlines] Unhandled'));
  }, cronOpts);
  logger.info('[Jobs] Deadline alerts scheduled — every hour at :30 (UTC)');

  staleCheckTask = cron.schedule(CRON.STALE_CHECK, () => {
    checkStaleFilings().catch(err => logger.error({ err }, '[Jobs:StaleCheck] Unhandled'));
  }, cronOpts);
  logger.info('[Jobs] Stale filing check scheduled — every 6 hours (UTC)');

  // Phase 6: drain the email delivery queue every 30s. The worker is
  // re-entrant (skips if a previous tick is still running) so this
  // cadence is safe even if a single batch takes longer than 30s.
  deliveryDrainTask = cron.schedule(CRON.EMAIL_DELIVERY_DRAIN, () => {
    drainEmailDeliveries().catch(err => logger.error({ err }, '[Jobs:Delivery] Unhandled'));
  }, cronOpts);
  logger.info('[Jobs] Email delivery drain scheduled — every 30 seconds (UTC)');

  // Daily ADD/CVD sync from the Federal Register. New candidates land
  // with status='pending' for admin review. Runs at 04:00 UTC so it
  // happens during the lowest-traffic window for North American users.
  addCvdSyncTask = cron.schedule(CRON.ADD_CVD_SYNC, () => {
    syncFromFederalRegister()
      .then((result) => {
        if (result.inserted > 0) invalidateAddCvdCache();
        logger.info({ result }, '[Jobs:AddCvdSync] Done');
      })
      .catch(err => logger.error({ err }, '[Jobs:AddCvdSync] Unhandled'));
  }, cronOpts);
  logger.info('[Jobs] ADD/CVD Federal Register sync scheduled — daily at 04:00 UTC');

  // ABI document reaper — every 5 minutes, rolls SENDING-for-15-minutes
  // documents back to DRAFT so the dashboard never carries a permanently
  // in-flight row. See reapStuckAbiDocuments above for the rationale.
  abiReaperTask = cron.schedule(CRON.ABI_REAPER, () => {
    reapStuckAbiDocuments().catch(err => logger.error({ err }, '[Jobs:AbiReaper] Unhandled'));
  }, cronOpts);
  logger.info('[Jobs] ABI document reaper scheduled — every 5 minutes (UTC)');

  setTimeout(() => {
    checkDeadlines().catch(err => logger.error({ err }, '[Jobs:Deadlines] Initial check error'));
  }, 5000);

  logger.info('[Jobs] All background jobs scheduled');
}

export function stopBackgroundJobs(): void {
  logger.info('[Jobs] Stopping background jobs');
  statusPollTask?.stop();
  deadlineTask?.stop();
  staleCheckTask?.stop();
  deliveryDrainTask?.stop();
  addCvdSyncTask?.stop();
  abiReaperTask?.stop();
  statusPollTask = null;
  deadlineTask = null;
  staleCheckTask = null;
  deliveryDrainTask = null;
  addCvdSyncTask = null;
  abiReaperTask = null;
}

/**
 * Wait until any in-progress job cycles finish before shutdown.
 * Polls every 200ms; gives up after 8s to respect the 10s force-exit window.
 */
export function waitForJobsToFinish(): Promise<void> {
  return new Promise((resolve) => {
    const maxWait = 8_000;
    const interval = 200;
    let elapsed = 0;

    const check = () => {
      if (!isStatusPollRunning && !isDeadlineCheckRunning) {
        resolve();
        return;
      }
      elapsed += interval;
      if (elapsed >= maxWait) {
        logger.warn('[Jobs] Shutdown wait exceeded — forcing stop with jobs still running');
        resolve();
        return;
      }
      setTimeout(check, interval);
    };

    check();
  });
}

// ─── Job Status Endpoint Data ──────────────────────────────

export function getJobStatus() {
  return {
    statusPoll: {
      running: isStatusPollRunning,
      lastRun: lastStatusPoll?.toISOString() ?? null,
      stats: statusPollStats,
    },
    deadlineCheck: {
      running: isDeadlineCheckRunning,
      lastRun: lastDeadlineCheck?.toISOString() ?? null,
    },
  };
}

// Allow manual trigger for testing
export { pollSubmittedFilings, checkDeadlines, checkStaleFilings };
