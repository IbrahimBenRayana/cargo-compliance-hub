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
import {
  notifyFilingAccepted,
  notifyFilingRejected,
  notifyDeadlineApproaching,
  notifyOrgUsers,
} from './notifications.js';

// ─── Job State ─────────────────────────────────────────────

let isStatusPollRunning = false;
let isDeadlineCheckRunning = false;
let lastStatusPoll: Date | null = null;
let lastDeadlineCheck: Date | null = null;
let statusPollStats = { checked: 0, updated: 0, errors: 0 };

// Track which deadline alerts we've already sent (to avoid duplicates)
// Key: `${filingId}_${threshold}h`
const sentDeadlineAlerts = new Set<string>();

// ─── 1. STATUS POLLING JOB ────────────────────────────────

async function pollSubmittedFilings(): Promise<void> {
  if (isStatusPollRunning) {
    console.log('[Jobs:StatusPoll] Skipping — previous run still in progress');
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

    console.log(`[Jobs:StatusPoll] Checking ${submittedFilings.length} submitted filing(s)...`);

    for (const filing of submittedFilings) {
      try {
        const masterBol = filing.masterBol;
        const houseBol = filing.houseBol;
        if (!masterBol && !houseBol) continue;

        // Query CC document-status
        const statusParams: Record<string, string> = {
          manifestType: 'ISF',
          skip: '0',
        };
        if (masterBol) statusParams.masterBOLNumber = masterBol;
        else if (houseBol) statusParams.houseBOLNumber = houseBol;

        const statusResult = await ccClient.getDocumentStatus(statusParams);
        checked++;

        const documents = statusResult.data?.data ?? [];
        const matchingDoc = documents.find((d: any) =>
          (houseBol && d.bol === houseBol) ||
          (masterBol && d.masterBOL === masterBol)
        ) || documents[0];

        // Also check messages for detailed CBP response
        let messages: any[] = [];
        if (houseBol) {
          try {
            const dateFrom = filing.submittedAt
              ? new Date(new Date(filing.submittedAt).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
              : '2025-01-01';
            const dateTo = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

            const msgParams: Record<string, string> = {
              type: 'ISF',
              houseBOLNumber: houseBol,
              skip: '0',
              dateFrom,
              dateTo,
              typeDate: 'createdDate',
            };
            if (masterBol) msgParams.masterBOLNumber = masterBol;

            const msgResult = await ccClient.getMessages(msgParams);
            messages = msgResult.data?.data ?? [];
          } catch { /* non-fatal */ }
        }

        // Determine status
        const ccStatus = matchingDoc?.status?.toUpperCase();
        let newStatus: string | null = null;

        if (ccStatus === 'ACCEPTED' || ccStatus === 'BILL ACCEPTED') {
          newStatus = 'accepted';
        } else if (ccStatus === 'REJECTED' || ccStatus === 'BILL REJECTED') {
          newStatus = 'rejected';
        } else if (ccStatus === 'ON HOLD' || ccStatus === 'HELD') {
          newStatus = 'on_hold';
        }

        // Check messages if document-status didn't yield a result
        if (!newStatus && messages.length > 0) {
          const hasAccepted = messages.some((m: any) =>
            m.description?.includes('ACCEPTED') || m.description?.includes('BILL ACCEPTED')
          );
          const hasRejected = messages.some((m: any) =>
            m.description?.includes('REJECTED') || m.statusCode === 'REJECTED'
          );
          if (hasAccepted && !hasRejected) newStatus = 'accepted';
          else if (hasRejected) newStatus = 'rejected';
        }

        if (newStatus && newStatus !== filing.status) {
          updated++;

          let rejectionReason: string | undefined;
          if (newStatus === 'rejected') {
            const rejectionMsgs = messages
              .filter((m: any) => m.description?.includes('REJECTED') || m.statusCode === 'REJECTED')
              .map((m: any) => m.description)
              .join('; ');
            rejectionReason = rejectionMsgs || matchingDoc?.lastEvent?.codeDescription || 'Rejected by CBP';
          }

          const isfTxnNumber = messages.find((m: any) => m.ISFTransactionNumber)?.ISFTransactionNumber;

          // Update filing status
          await prisma.filing.update({
            where: { id: filing.id },
            data: {
              status: newStatus,
              acceptedAt: newStatus === 'accepted' ? new Date() : undefined,
              rejectedAt: newStatus === 'rejected' ? new Date() : undefined,
              rejectionReason: rejectionReason ?? undefined,
              cbpTransactionId: isfTxnNumber ?? filing.cbpTransactionId ?? undefined,
            },
          });

          // Status history
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

          // Log the API call
          await prisma.submissionLog.create({
            data: {
              orgId: filing.orgId,
              filingId: filing.id,
              userId: filing.createdById,
              method: 'GET',
              url: '/api/document-status [auto-poll]',
              requestPayload: statusParams as any,
              responseStatus: statusResult.status,
              responseBody: statusResult.data as any,
              latencyMs: statusResult.latencyMs,
            },
          });

          // Send notifications
          const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
          if (newStatus === 'accepted') {
            await notifyFilingAccepted(filing.orgId, filing.id, bol);
            console.log(`[Jobs:StatusPoll] ✅ Filing ${bol} ACCEPTED by CBP`);
          } else if (newStatus === 'rejected') {
            await notifyFilingRejected(filing.orgId, filing.id, bol, rejectionReason);
            console.log(`[Jobs:StatusPoll] ❌ Filing ${bol} REJECTED by CBP: ${rejectionReason}`);
          } else if (newStatus === 'on_hold') {
            await notifyOrgUsers(filing.orgId, filing.id, 'filing_on_hold', 'Filing On Hold ⏸️',
              `ISF filing ${bol} has been placed on hold by CBP.`);
            console.log(`[Jobs:StatusPoll] ⏸️ Filing ${bol} placed ON HOLD by CBP`);
          }
        }

        // Small delay between API calls to respect rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        errors++;
        console.warn(`[Jobs:StatusPoll] Error checking filing ${filing.id}:`, err.message);
      }
    }

    const elapsed = Date.now() - startTime;
    statusPollStats = { checked, updated, errors };
    console.log(`[Jobs:StatusPoll] Done in ${elapsed}ms — checked: ${checked}, updated: ${updated}, errors: ${errors}`);
  } catch (err: any) {
    console.error('[Jobs:StatusPoll] Fatal error:', err.message);
  } finally {
    isStatusPollRunning = false;
    lastStatusPoll = new Date();
  }
}

// ─── 2. DEADLINE ALERT JOB ────────────────────────────────

const DEADLINE_THRESHOLDS = [72, 48, 24]; // hours

async function checkDeadlines(): Promise<void> {
  if (isDeadlineCheckRunning) {
    console.log('[Jobs:Deadlines] Skipping — previous run still in progress');
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

      // Find the appropriate threshold
      for (const threshold of DEADLINE_THRESHOLDS) {
        if (hoursRemaining <= threshold) {
          const alertKey = `${filing.id}_${threshold}h`;

          // Skip if we already sent this alert
          if (sentDeadlineAlerts.has(alertKey)) continue;

          const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
          await notifyDeadlineApproaching(filing.orgId, filing.id, bol, threshold);
          sentDeadlineAlerts.add(alertKey);
          alertsSent++;

          console.log(`[Jobs:Deadlines] ⏰ Alert sent: ${bol} — ${Math.round(hoursRemaining)}h remaining (${threshold}h threshold)`);

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
      const alertKey = `${filing.id}_overdue`;
      if (sentDeadlineAlerts.has(alertKey)) continue;

      const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
      await notifyOrgUsers(
        filing.orgId,
        filing.id,
        'deadline_overdue',
        'OVERDUE: Filing deadline passed 🚨',
        `ISF filing ${bol} deadline has PASSED. Submit immediately to avoid CBP penalties ($5,000-$10,000).`
      );
      sentDeadlineAlerts.add(alertKey);
      alertsSent++;

      console.log(`[Jobs:Deadlines] 🚨 OVERDUE: ${bol}`);
    }

    if (alertsSent > 0) {
      console.log(`[Jobs:Deadlines] Sent ${alertsSent} deadline alert(s)`);
    }
  } catch (err: any) {
    console.error('[Jobs:Deadlines] Error:', err.message);
  } finally {
    isDeadlineCheckRunning = false;
    lastDeadlineCheck = new Date();
  }
}

// ─── 3. STALE FILING DETECTION ────────────────────────────

async function checkStaleFilings(): Promise<void> {
  try {
    const staleThreshold = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72h ago

    const staleFilings = await prisma.filing.findMany({
      where: {
        status: 'submitted',
        submittedAt: {
          not: null,
          lt: staleThreshold,
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
      const alertKey = `${filing.id}_stale`;
      if (sentDeadlineAlerts.has(alertKey)) continue;

      const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
      const hoursAgo = Math.round((Date.now() - filing.submittedAt!.getTime()) / (1000 * 60 * 60));

      await notifyOrgUsers(
        filing.orgId,
        filing.id,
        'filing_stale',
        'No CBP Response ⚠️',
        `ISF filing ${bol} was submitted ${hoursAgo}h ago but no CBP response received. Check CustomsCity for status.`
      );
      sentDeadlineAlerts.add(alertKey);

      console.log(`[Jobs:StaleCheck] ⚠️ No response for ${bol} (submitted ${hoursAgo}h ago)`);
    }
  } catch (err: any) {
    console.error('[Jobs:StaleCheck] Error:', err.message);
  }
}

// ─── SCHEDULER ─────────────────────────────────────────────

let statusPollTask: ScheduledTask | null = null;
let deadlineTask: ScheduledTask | null = null;
let staleCheckTask: ScheduledTask | null = null;

export function startBackgroundJobs(): void {
  console.log('[Jobs] Starting background job scheduler...');

  // Status polling: every 5 minutes
  statusPollTask = cron.schedule('*/5 * * * *', () => {
    pollSubmittedFilings().catch(err => console.error('[Jobs:StatusPoll] Unhandled:', err));
  });
  console.log('[Jobs] ✅ Status polling — every 5 minutes');

  // Deadline checks: every hour at :30
  deadlineTask = cron.schedule('30 * * * *', () => {
    checkDeadlines().catch(err => console.error('[Jobs:Deadlines] Unhandled:', err));
  });
  console.log('[Jobs] ✅ Deadline alerts — every hour at :30');

  // Stale filing check: every 6 hours
  staleCheckTask = cron.schedule('0 */6 * * *', () => {
    checkStaleFilings().catch(err => console.error('[Jobs:StaleCheck] Unhandled:', err));
  });
  console.log('[Jobs] ✅ Stale filing check — every 6 hours');

  // Run initial deadline check immediately on startup
  setTimeout(() => {
    checkDeadlines().catch(err => console.error('[Jobs:Deadlines] Initial check error:', err));
  }, 5000);

  console.log('[Jobs] All background jobs scheduled');
}

export function stopBackgroundJobs(): void {
  console.log('[Jobs] Stopping background jobs...');
  statusPollTask?.stop();
  deadlineTask?.stop();
  staleCheckTask?.stop();
  statusPollTask = null;
  deadlineTask = null;
  staleCheckTask = null;
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
      alertsSentCount: sentDeadlineAlerts.size,
    },
  };
}

// Allow manual trigger for testing
export { pollSubmittedFilings, checkDeadlines, checkStaleFilings };
