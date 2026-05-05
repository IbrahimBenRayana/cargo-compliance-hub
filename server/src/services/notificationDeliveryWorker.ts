/**
 * Notification Delivery Worker (Phase 6)
 *
 * Drains the `NotificationDelivery` queue. Currently handles `email` only;
 * the schema is general so 'push' or 'sms' can land later as additional
 * cases in the switch.
 *
 *   queued (next_attempt_at <= now)
 *     │
 *     ▼
 *   render → send → outcome
 *     │ success         → status=sent,    sent_at=now
 *     │ retryable error → status=queued,  next_attempt_at += 2^attempts min, attempts++
 *     │ exhausted       → status=failed
 *     └ provider bounce → status=bounced  (set by an external webhook, not here)
 *
 * Backoff schedule (in minutes after each attempt): 1, 2, 4, 8, 16. Capped
 * at MAX_ATTEMPTS = 5 — after that the row is parked in 'failed' and a
 * human (or a future bounce-recovery flow) decides what to do.
 *
 * The worker is in-process and re-entrant: `isRunning` prevents two
 * cron ticks from racing on the same rows. We also `LIMIT 50` per tick
 * so a backlog doesn't lock the DB into one giant transaction.
 */

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { renderNotificationEmail, sendMail } from './email.js';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

let isRunning = false;
let lastDrain: Date | null = null;
let drainStats = { attempted: 0, sent: 0, failed: 0, retried: 0 };

function backoffMinutes(attempts: number): number {
  // attempt 0 just-failed → wait 1 min before retry
  // attempt 1 → 2, 2 → 4, 3 → 8, 4 → 16
  return Math.min(2 ** attempts, 16);
}

function isRetryableError(message: string): boolean {
  // Conservative: retry network/transient SMTP errors. 5xx auth and
  // 5.x.x permanent failures should NOT retry — they'll only burn budget.
  // For now we treat *every* error as retryable up to MAX_ATTEMPTS, which
  // matches "budget is more important than perfect classification" since
  // MAX_ATTEMPTS = 5. A future patch can add explicit non-retry codes.
  return !!message;
}

export async function drainEmailDeliveries(): Promise<void> {
  if (isRunning) {
    logger.debug('[Delivery] Skip — previous drain still running');
    return;
  }
  isRunning = true;
  const start = Date.now();
  let attempted = 0, sent = 0, failed = 0, retried = 0;

  try {
    const now = new Date();
    const due = await prisma.notificationDelivery.findMany({
      where: {
        status:        'queued',
        channel:       'email',
        nextAttemptAt: { lte: now },
        attempts:      { lt: MAX_ATTEMPTS },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take:    BATCH_SIZE,
      include: {
        notification: {
          select: {
            id: true, type: true, title: true, message: true, linkUrl: true,
            severity: true, metadata: true,
          },
        },
      },
    });

    if (due.length === 0) {
      lastDrain = new Date();
      return;
    }

    logger.info({ count: due.length }, '[Delivery] Draining email queue');

    for (const row of due) {
      attempted++;
      const n = row.notification;
      // Defensive: notification missing (cascade-delete race?). Mark failed
      // so we stop trying.
      if (!n) {
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data:  { status: 'failed', lastError: 'Notification record missing' },
        });
        failed++;
        continue;
      }

      try {
        const rendered = renderNotificationEmail({
          type:     n.type,
          title:    n.title,
          message:  n.message,
          linkUrl:  n.linkUrl,
          severity: n.severity as 'info' | 'warning' | 'critical',
          metadata: (n.metadata as Record<string, unknown> | null) ?? null,
        });

        const ok = await sendMail({
          to:      row.recipient,
          subject: rendered.subject,
          html:    rendered.html,
        });

        if (ok) {
          await prisma.notificationDelivery.update({
            where: { id: row.id },
            data:  { status: 'sent', sentAt: new Date(), attempts: row.attempts + 1 },
          });
          sent++;
        } else {
          // sendMail returned false: unknown error, treated as retryable.
          await markRetryOrFailed(row.id, row.attempts, 'sendMail returned false');
          if (row.attempts + 1 >= MAX_ATTEMPTS) failed++; else retried++;
        }
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (isRetryableError(msg)) {
          await markRetryOrFailed(row.id, row.attempts, msg);
          if (row.attempts + 1 >= MAX_ATTEMPTS) failed++; else retried++;
        } else {
          await prisma.notificationDelivery.update({
            where: { id: row.id },
            data:  { status: 'failed', attempts: row.attempts + 1, lastError: msg.slice(0, 500) },
          });
          failed++;
        }
      }
    }

    drainStats = { attempted, sent, failed, retried };
    const elapsed = Date.now() - start;
    logger.info({ elapsed, ...drainStats }, '[Delivery] Drain complete');
  } catch (err: any) {
    logger.error({ err: err.message }, '[Delivery] Fatal error');
  } finally {
    isRunning = false;
    lastDrain = new Date();
  }
}

async function markRetryOrFailed(rowId: string, attempts: number, error: string): Promise<void> {
  const next = attempts + 1;
  if (next >= MAX_ATTEMPTS) {
    await prisma.notificationDelivery.update({
      where: { id: rowId },
      data:  {
        status:    'failed',
        attempts:  next,
        lastError: error.slice(0, 500),
      },
    });
    return;
  }
  const nextAttemptAt = new Date(Date.now() + backoffMinutes(next) * 60_000);
  await prisma.notificationDelivery.update({
    where: { id: rowId },
    data:  {
      attempts:      next,
      lastError:     error.slice(0, 500),
      nextAttemptAt,
    },
  });
}

// ── Public stats accessor for /api/health-style endpoints ────────────
export function getDeliveryStats() {
  return {
    lastDrain,
    isRunning,
    ...drainStats,
  };
}
