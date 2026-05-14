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
            } catch { /* non-fatal */ }
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

            await prisma.filing.update({
              where: { id: filing.id },
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

            await prisma.filingStatusHistory.create({
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

            await prisma.submissionLog.create({
              data: {
                orgId: filing.orgId, filingId: filing.id, userId: filing.createdById,
                method: 'GET', url: '/api/document-status [auto-poll]',
                requestPayload: statusParams as any,
                responseStatus: statusResult.status,
                responseBody: statusResult.data as any,
                latencyMs: statusResult.latencyMs,
              },
            });

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

// ─── SCHEDULER ─────────────────────────────────────────────

let statusPollTask: ScheduledTask | null = null;
let deadlineTask: ScheduledTask | null = null;
let staleCheckTask: ScheduledTask | null = null;
let deliveryDrainTask: ScheduledTask | null = null;

export function startBackgroundJobs(): void {
  logger.info('[Jobs] Starting background job scheduler');

  statusPollTask = cron.schedule('*/5 * * * *', () => {
    pollSubmittedFilings().catch(err => logger.error({ err }, '[Jobs:StatusPoll] Unhandled'));
  });
  logger.info('[Jobs] Status polling scheduled — every 5 minutes');

  deadlineTask = cron.schedule('30 * * * *', () => {
    checkDeadlines().catch(err => logger.error({ err }, '[Jobs:Deadlines] Unhandled'));
  });
  logger.info('[Jobs] Deadline alerts scheduled — every hour at :30');

  staleCheckTask = cron.schedule('0 */6 * * *', () => {
    checkStaleFilings().catch(err => logger.error({ err }, '[Jobs:StaleCheck] Unhandled'));
  });
  logger.info('[Jobs] Stale filing check scheduled — every 6 hours');

  // Phase 6: drain the email delivery queue every 30s. The worker is
  // re-entrant (skips if a previous tick is still running) so this
  // cadence is safe even if a single batch takes longer than 30s.
  deliveryDrainTask = cron.schedule('*/30 * * * * *', () => {
    drainEmailDeliveries().catch(err => logger.error({ err }, '[Jobs:Delivery] Unhandled'));
  });
  logger.info('[Jobs] Email delivery drain scheduled — every 30 seconds');

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
  statusPollTask = null;
  deadlineTask = null;
  staleCheckTask = null;
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
