/**
 * Notification Service
 * 
 * Creates in-app notifications for users when key events occur:
 * - Filing accepted / rejected by CBP
 * - Filing submitted successfully
 * - Filing deadline approaching (72h, 48h, 24h)
 * - Amendment required
 * - API connection errors
 */

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import {
  sendFilingAcceptedEmail,
  sendFilingRejectedEmail,
  sendDeadlineWarningEmail,
  sendFilingSubmittedEmail,
} from './email.js';

export interface CreateNotificationParams {
  userId: string;
  orgId: string;
  filingId?: string;
  type: string;
  title: string;
  message?: string;
  /** Optional deduplication key — if a notification with this key already exists it is silently skipped. */
  dedupeKey?: string;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        orgId: params.orgId,
        filingId: params.filingId ?? null,
        type: params.type,
        title: params.title,
        message: params.message ?? null,
        dedupeKey: params.dedupeKey ?? null,
      },
    });
  } catch (err: any) {
    // P2002 = unique constraint violation — dedupe key already exists, skip silently
    if (err?.code === 'P2002') return;
    logger.error({ err, type: params.type }, '[Notifications] Failed to create notification');
  }
}

/**
 * Notify all users in an organization about a filing event.
 */
export async function notifyOrgUsers(
  orgId: string,
  filingId: string,
  type: string,
  title: string,
  message?: string,
  dedupeKey?: string
): Promise<void> {
  try {
    // If a dedupeKey is supplied, skip if already exists in DB (survives restarts)
    if (dedupeKey) {
      const existing = await prisma.notification.findFirst({ where: { dedupeKey } });
      if (existing) return;
    }

    const users = await prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true },
    });

    // Only the first user record gets the dedupeKey (unique constraint);
    // the rest use null so createMany doesn't conflict.
    await prisma.notification.createMany({
      data: users.map((u, i) => ({
        userId: u.id,
        orgId,
        filingId,
        type,
        title,
        message: message ?? null,
        dedupeKey: i === 0 ? (dedupeKey ?? null) : null,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    logger.error({ err, type }, '[Notifications] Failed to notify org users');
  }
}

// ─── Pre-built notification triggers ───────────────────────

export async function notifyFilingSubmitted(orgId: string, userId: string, filingId: string, bolNumber: string): Promise<void> {
  await createNotification({
    userId,
    orgId,
    filingId,
    type: 'filing_submitted',
    title: 'Filing Submitted',
    message: `ISF filing ${bolNumber || filingId.slice(0, 8)} has been submitted to CBP.`,
  });

  // Send email notification
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true } });
    if (user) {
      sendFilingSubmittedEmail({
        to: user.email,
        bolNumber: bolNumber || filingId.slice(0, 8),
        filingId,
        submitterName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      }).catch(() => {});
    }
  } catch {}
}

export async function notifyFilingAccepted(orgId: string, filingId: string, bolNumber: string): Promise<void> {
  await notifyOrgUsers(
    orgId,
    filingId,
    'filing_accepted',
    'Filing Accepted ✅',
    `ISF filing ${bolNumber || filingId.slice(0, 8)} has been accepted by CBP.`
  );

  // Send email to all org users
  try {
    const users = await prisma.user.findMany({ where: { orgId, isActive: true }, select: { email: true } });
    const filing = await prisma.filing.findUnique({ where: { id: filingId }, select: { cbpTransactionId: true } });
    if (users.length > 0) {
      sendFilingAcceptedEmail({
        to: users.map(u => u.email),
        bolNumber: bolNumber || filingId.slice(0, 8),
        filingId,
        cbpTransactionId: filing?.cbpTransactionId ?? undefined,
      }).catch(() => {});
    }
  } catch {}
}

export async function notifyFilingRejected(orgId: string, filingId: string, bolNumber: string, reason?: string): Promise<void> {
  await notifyOrgUsers(
    orgId,
    filingId,
    'filing_rejected',
    'Filing Rejected ❌',
    `ISF filing ${bolNumber || filingId.slice(0, 8)} was rejected by CBP.${reason ? ` Reason: ${reason}` : ''}`
  );

  // Send email to all org users
  try {
    const users = await prisma.user.findMany({ where: { orgId, isActive: true }, select: { email: true } });
    if (users.length > 0) {
      sendFilingRejectedEmail({
        to: users.map(u => u.email),
        bolNumber: bolNumber || filingId.slice(0, 8),
        filingId,
        reason,
      }).catch(() => {});
    }
  } catch {}
}

export async function notifyFilingAmended(orgId: string, userId: string, filingId: string, bolNumber: string): Promise<void> {
  await createNotification({
    userId,
    orgId,
    filingId,
    type: 'filing_amended',
    title: 'Filing Amendment Submitted',
    message: `Amendment for ISF filing ${bolNumber || filingId.slice(0, 8)} has been submitted.`,
  });
}

export async function notifyFilingCancelled(orgId: string, userId: string, filingId: string, bolNumber: string): Promise<void> {
  await createNotification({
    userId,
    orgId,
    filingId,
    type: 'filing_cancelled',
    title: 'Filing Cancelled',
    message: `ISF filing ${bolNumber || filingId.slice(0, 8)} has been cancelled.`,
  });
}

export async function notifyDeadlineApproaching(orgId: string, filingId: string, bolNumber: string, hoursRemaining: number): Promise<void> {
  const dedupeKey = `${filingId}_deadline_${hoursRemaining}h`;
  await notifyOrgUsers(
    orgId,
    filingId,
    'deadline_warning',
    `Deadline in ${hoursRemaining}h ⏰`,
    `ISF filing ${bolNumber || filingId.slice(0, 8)} deadline is in ${hoursRemaining} hours. Submit soon to avoid penalties.`,
    dedupeKey
  );

  // Send email to all org users
  try {
    const users = await prisma.user.findMany({ where: { orgId, isActive: true }, select: { email: true } });
    if (users.length > 0) {
      sendDeadlineWarningEmail({
        to: users.map(u => u.email),
        bolNumber: bolNumber || filingId.slice(0, 8),
        filingId,
        hoursRemaining,
      }).catch(() => {});
    }
  } catch {}
}

export async function notifyApiError(orgId: string, userId: string, message: string): Promise<void> {
  await createNotification({
    userId,
    orgId,
    type: 'api_error',
    title: 'API Connection Error 🔴',
    message,
  });
}
