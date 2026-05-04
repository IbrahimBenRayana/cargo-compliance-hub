/**
 * Notification Service
 *
 * Creates in-app notifications for users when key events occur:
 *   - Filing submitted / accepted / rejected / amended / cancelled
 *   - Filing deadline approaching (72h, 48h, 24h)
 *   - API connection errors
 *
 * Phase 1 of the notification rethink (2026-05-04):
 *   - Adds `severity` (info | warning | critical) — drives UI tab + toast escalation.
 *   - Adds `linkUrl` — deep link the bell click should follow.
 *   - Adds `metadata` (Json) — structured payload (BOL, hours remaining, etc.).
 *
 * Phase 2 will replace the per-event trigger functions with a single
 * dispatcher and add role-aware audience resolution. For now we just
 * plumb the new fields through so the frontend can rely on them.
 */

import { Prisma, type NotificationSeverity } from '@prisma/client';
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import {
  sendFilingAcceptedEmail,
  sendFilingRejectedEmail,
  sendDeadlineWarningEmail,
  sendFilingSubmittedEmail,
} from './email.js';

// ─── Defaults per notification kind ───────────────────────────────────
// Single source of truth so a kind's severity can never drift between the
// trigger function and the (eventual) email subject prefixer.

const SEVERITY_BY_KIND: Record<string, NotificationSeverity> = {
  filing_submitted: 'info',
  filing_accepted:  'info',
  filing_rejected:  'critical',
  filing_amended:   'info',
  filing_cancelled: 'info',
  filing_on_hold:   'critical',
  filing_stale:     'warning',
  deadline_warning: 'warning',  // overridden to critical when hoursRemaining <= 24
  deadline_overdue: 'critical',
  api_error:        'critical',
};

function severityFor(kind: string, fallback: NotificationSeverity = 'info'): NotificationSeverity {
  return SEVERITY_BY_KIND[kind] ?? fallback;
}

// ─── Public types ─────────────────────────────────────────────────────

export interface CreateNotificationParams {
  userId: string;
  orgId: string;
  filingId?: string;
  abiDocumentId?: string;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  message?: string;
  linkUrl?: string;
  metadata?: Prisma.InputJsonValue;
  /** Optional deduplication key — if a notification with this key already exists it is silently skipped. */
  dedupeKey?: string;
}

// ─── Single-user creator (silent on dedupe collision) ────────────────

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId:        params.userId,
        orgId:         params.orgId,
        filingId:      params.filingId ?? null,
        abiDocumentId: params.abiDocumentId ?? null,
        type:          params.type,
        severity:      params.severity ?? severityFor(params.type),
        title:         params.title,
        message:       params.message ?? null,
        linkUrl:       params.linkUrl ?? null,
        metadata:      params.metadata ?? Prisma.JsonNull,
        dedupeKey:     params.dedupeKey ?? null,
      },
    });
  } catch (err: any) {
    // P2002 = unique constraint violation — dedupe key already exists, skip silently
    if (err?.code === 'P2002') return;
    logger.error({ err, type: params.type }, '[Notifications] Failed to create notification');
  }
}

// ─── Org-wide broadcast ──────────────────────────────────────────────

interface NotifyOrgUsersOptions {
  severity?: NotificationSeverity;
  linkUrl?: string;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
}

export async function notifyOrgUsers(
  orgId: string,
  filingId: string | null,
  type: string,
  title: string,
  message?: string,
  options: NotifyOrgUsersOptions = {},
): Promise<void> {
  try {
    // If a dedupeKey is supplied, skip if already exists in DB (survives restarts)
    if (options.dedupeKey) {
      const existing = await prisma.notification.findFirst({ where: { dedupeKey: options.dedupeKey } });
      if (existing) return;
    }

    const users = await prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true },
    });
    if (users.length === 0) return;

    const severity = options.severity ?? severityFor(type);
    const metadata = options.metadata ?? Prisma.JsonNull;

    // Only the first user record gets the dedupeKey (unique constraint);
    // the rest use null so createMany doesn't conflict.
    await prisma.notification.createMany({
      data: users.map((u, i) => ({
        userId:    u.id,
        orgId,
        filingId,
        type,
        severity,
        title,
        message:   message ?? null,
        linkUrl:   options.linkUrl ?? null,
        metadata,
        dedupeKey: i === 0 ? (options.dedupeKey ?? null) : null,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    logger.error({ err, type }, '[Notifications] Failed to notify org users');
  }
}

// ─── Pre-built notification triggers ─────────────────────────────────
// These remain the public surface for now. Phase 2 will replace them with
// a single `notify(event)` dispatcher; for the time being, every helper
// just calls into the dispatcher primitives above with the right defaults.

const filingLinkUrl = (filingId: string) => `/shipments/${filingId}`;

export async function notifyFilingSubmitted(orgId: string, userId: string, filingId: string, bolNumber: string): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  await createNotification({
    userId,
    orgId,
    filingId,
    type:     'filing_submitted',
    title:    'Filing Submitted',
    message:  `ISF filing ${ref} has been submitted to CBP.`,
    linkUrl:  filingLinkUrl(filingId),
    metadata: { bolNumber: ref },
  });

  // Email
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true } });
    if (user) {
      sendFilingSubmittedEmail({
        to: user.email,
        bolNumber: ref,
        filingId,
        submitterName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      }).catch(() => {});
    }
  } catch {}
}

export async function notifyFilingAccepted(orgId: string, filingId: string, bolNumber: string): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  await notifyOrgUsers(
    orgId,
    filingId,
    'filing_accepted',
    'Filing Accepted',
    `ISF filing ${ref} has been accepted by CBP.`,
    {
      linkUrl:  filingLinkUrl(filingId),
      metadata: { bolNumber: ref },
    },
  );

  // Email
  try {
    const users = await prisma.user.findMany({ where: { orgId, isActive: true }, select: { email: true } });
    const filing = await prisma.filing.findUnique({ where: { id: filingId }, select: { cbpTransactionId: true } });
    if (users.length > 0) {
      sendFilingAcceptedEmail({
        to: users.map(u => u.email),
        bolNumber: ref,
        filingId,
        cbpTransactionId: filing?.cbpTransactionId ?? undefined,
      }).catch(() => {});
    }
  } catch {}
}

export async function notifyFilingRejected(orgId: string, filingId: string, bolNumber: string, reason?: string): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  await notifyOrgUsers(
    orgId,
    filingId,
    'filing_rejected',
    'Filing Rejected',
    `ISF filing ${ref} was rejected by CBP.${reason ? ` Reason: ${reason}` : ''}`,
    {
      linkUrl:  filingLinkUrl(filingId),
      metadata: { bolNumber: ref, reason: reason ?? null },
    },
  );

  // Email
  try {
    const users = await prisma.user.findMany({ where: { orgId, isActive: true }, select: { email: true } });
    if (users.length > 0) {
      sendFilingRejectedEmail({
        to: users.map(u => u.email),
        bolNumber: ref,
        filingId,
        reason,
      }).catch(() => {});
    }
  } catch {}
}

export async function notifyFilingAmended(orgId: string, userId: string, filingId: string, bolNumber: string): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  await createNotification({
    userId,
    orgId,
    filingId,
    type:     'filing_amended',
    title:    'Filing Amendment Submitted',
    message:  `Amendment for ISF filing ${ref} has been submitted.`,
    linkUrl:  filingLinkUrl(filingId),
    metadata: { bolNumber: ref },
  });
}

export async function notifyFilingCancelled(orgId: string, userId: string, filingId: string, bolNumber: string): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  await createNotification({
    userId,
    orgId,
    filingId,
    type:     'filing_cancelled',
    title:    'Filing Cancelled',
    message:  `ISF filing ${ref} has been cancelled.`,
    linkUrl:  filingLinkUrl(filingId),
    metadata: { bolNumber: ref },
  });
}

export async function notifyDeadlineApproaching(orgId: string, filingId: string, bolNumber: string, hoursRemaining: number): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  // 24h or less → critical; 48h/72h → warning. Matches operational urgency.
  const severity: NotificationSeverity = hoursRemaining <= 24 ? 'critical' : 'warning';

  await notifyOrgUsers(
    orgId,
    filingId,
    'deadline_warning',
    `Deadline in ${hoursRemaining}h`,
    `ISF filing ${ref} deadline is in ${hoursRemaining} hours. Submit soon to avoid penalties.`,
    {
      severity,
      dedupeKey: `${filingId}_deadline_${hoursRemaining}h`,
      linkUrl:   filingLinkUrl(filingId),
      metadata:  { bolNumber: ref, hoursRemaining },
    },
  );

  // Email
  try {
    const users = await prisma.user.findMany({ where: { orgId, isActive: true }, select: { email: true } });
    if (users.length > 0) {
      sendDeadlineWarningEmail({
        to: users.map(u => u.email),
        bolNumber: ref,
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
    type:    'api_error',
    title:   'API Connection Error',
    message,
  });
}
