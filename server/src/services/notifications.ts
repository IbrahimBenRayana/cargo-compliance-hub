/**
 * Notification Service
 *
 * Architecture (after Phase 2 of the rethink):
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ notifyFilingSubmitted / notifyFilingAccepted / ...          │  ← public API
 *   │   (thin shims — keep their old signatures so callers stay)  │
 *   └────────────┬────────────────────────────────────────────────┘
 *                │
 *                ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │   notify(event)                                              │  ← single dispatcher
 *   │     • resolves audience (roles → user list)                  │
 *   │     • applies kind→severity defaults                          │
 *   │     • idempotent on dedupeKey                                 │
 *   │     • bulk createMany in one round-trip                       │
 *   └────────────┬────────────────────────────────────────────────┘
 *                │
 *                ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │   prisma.notification                                        │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Email delivery still happens inside each helper (fire-and-forget) for
 * now. Phase 6 will fold delivery into a queued NotificationDelivery
 * model with retries; this PR is strictly about the in-app fan-out.
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

// ─── Roles & audience resolution ──────────────────────────────────────
// User.role values in the DB: 'owner' | 'admin' | 'operator' | 'viewer'.
// We treat the union as our role primitive and expose three audience
// tags as the public dispatcher surface.

export type Role = 'owner' | 'admin' | 'operator' | 'viewer';
export type AudienceRole = 'OPERATOR' | 'ADMIN' | 'OWNER';

// Each audience tag expands to the set of DB roles that should receive
// the notification. Operator-class events fan out to operators+up so
// owners and admins also see them; viewers never get action notifications.
const AUDIENCE_ROLES: Record<AudienceRole, Role[]> = {
  OPERATOR: ['operator', 'admin', 'owner'],
  ADMIN:    ['admin', 'owner'],
  OWNER:    ['owner'],
};

export interface AudienceSpec {
  orgId: string;
  /** Send to anyone in the org with one of these audience tags. */
  roles?: AudienceRole[];
  /** Send to specific user ids (typically the actor). */
  userIds?: string[];
  /** Legacy fallback: every active user in the org. Avoid for new triggers — */
  /** prefer `roles: ['OPERATOR', 'ADMIN', 'OWNER']` which excludes viewers. */
  allInOrg?: boolean;
}

async function resolveAudience(spec: AudienceSpec): Promise<string[]> {
  const ids = new Set<string>();

  // Direct user IDs win — actor-only triggers always go through here.
  if (spec.userIds) {
    for (const uid of spec.userIds) ids.add(uid);
  }

  // Role-based fan-out.
  if (spec.roles && spec.roles.length > 0) {
    const roleSet = new Set<Role>();
    for (const tag of spec.roles) {
      for (const r of AUDIENCE_ROLES[tag]) roleSet.add(r);
    }
    const users = await prisma.user.findMany({
      where: { orgId: spec.orgId, isActive: true, role: { in: Array.from(roleSet) } },
      select: { id: true },
    });
    for (const u of users) ids.add(u.id);
  }

  // Legacy: everyone in the org. Only used by deprecated callers; new
  // triggers should specify roles explicitly.
  if (spec.allInOrg) {
    const users = await prisma.user.findMany({
      where: { orgId: spec.orgId, isActive: true },
      select: { id: true },
    });
    for (const u of users) ids.add(u.id);
  }

  return Array.from(ids);
}

// ─── notify() — single dispatcher ────────────────────────────────────

export interface NotifyEvent {
  kind: string;
  severity?: NotificationSeverity;
  audience: AudienceSpec;
  title: string;
  message?: string;
  linkUrl?: string;
  metadata?: Prisma.InputJsonValue;
  filingId?: string | null;
  abiDocumentId?: string | null;
  /** Dedupe is global-unique. Use {filingId}_{discriminator}h or similar. */
  dedupeKey?: string;
}

export async function notify(event: NotifyEvent): Promise<void> {
  try {
    // Idempotency check: if we've already sent this dedupeKey, no-op.
    if (event.dedupeKey) {
      const existing = await prisma.notification.findFirst({
        where: { dedupeKey: event.dedupeKey },
        select: { id: true },
      });
      if (existing) return;
    }

    const userIds = await resolveAudience(event.audience);
    if (userIds.length === 0) return;

    const severity = event.severity ?? severityFor(event.kind);
    const metadata = event.metadata ?? Prisma.JsonNull;

    // First user gets the dedupeKey (unique constraint); rest get null
    // so the createMany doesn't conflict.
    await prisma.notification.createMany({
      data: userIds.map((userId, i) => ({
        userId,
        orgId:         event.audience.orgId,
        filingId:      event.filingId ?? null,
        abiDocumentId: event.abiDocumentId ?? null,
        type:          event.kind,
        severity,
        title:         event.title,
        message:       event.message ?? null,
        linkUrl:       event.linkUrl ?? null,
        metadata,
        dedupeKey:     i === 0 ? (event.dedupeKey ?? null) : null,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    logger.error({ err, kind: event.kind }, '[Notifications] Dispatcher failed');
  }
}

// ─── Backwards-compat wrappers (kept so existing call sites compile) ─

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
  dedupeKey?: string;
}

/** Single-user notification. Use `notify({ audience: { orgId, userIds: [...] }, ... })` for new code. */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  await notify({
    kind:          params.type,
    severity:      params.severity,
    audience:      { orgId: params.orgId, userIds: [params.userId] },
    title:         params.title,
    message:       params.message,
    linkUrl:       params.linkUrl,
    metadata:      params.metadata,
    filingId:      params.filingId ?? null,
    abiDocumentId: params.abiDocumentId ?? null,
    dedupeKey:     params.dedupeKey,
  });
}

interface NotifyOrgUsersOptions {
  severity?: NotificationSeverity;
  linkUrl?: string;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
}

/** Org-wide broadcast (legacy — fans out to every active user, including viewers). */
/** Prefer `notify({ audience: { orgId, roles: ['OPERATOR', 'ADMIN', 'OWNER'] } })` for new triggers. */
export async function notifyOrgUsers(
  orgId: string,
  filingId: string | null,
  type: string,
  title: string,
  message?: string,
  options: NotifyOrgUsersOptions = {},
): Promise<void> {
  await notify({
    kind:      type,
    severity:  options.severity,
    audience:  { orgId, allInOrg: true },
    title,
    message,
    linkUrl:   options.linkUrl,
    metadata:  options.metadata,
    filingId,
    dedupeKey: options.dedupeKey,
  });
}

// ─── Pre-built triggers (public API — keep their signatures stable) ──
// All seven now route through notify() with explicit role audiences.

const filingLink = (filingId: string) => `/shipments/${filingId}`;

export async function notifyFilingSubmitted(orgId: string, userId: string, filingId: string, bolNumber: string): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  await notify({
    kind:     'filing_submitted',
    audience: { orgId, userIds: [userId] },
    title:    'Filing Submitted',
    message:  `ISF filing ${ref} has been submitted to CBP.`,
    linkUrl:  filingLink(filingId),
    metadata: { bolNumber: ref },
    filingId,
  });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });
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
  await notify({
    kind:     'filing_accepted',
    audience: { orgId, roles: ['OPERATOR', 'ADMIN', 'OWNER'] },
    title:    'Filing Accepted',
    message:  `ISF filing ${ref} has been accepted by CBP.`,
    linkUrl:  filingLink(filingId),
    metadata: { bolNumber: ref },
    filingId,
  });

  try {
    const users = await prisma.user.findMany({
      where: { orgId, isActive: true, role: { in: ['operator', 'admin', 'owner'] } },
      select: { email: true },
    });
    const filing = await prisma.filing.findUnique({
      where: { id: filingId },
      select: { cbpTransactionId: true },
    });
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
  await notify({
    kind:     'filing_rejected',
    audience: { orgId, roles: ['OPERATOR', 'ADMIN', 'OWNER'] },
    title:    'Filing Rejected',
    message:  `ISF filing ${ref} was rejected by CBP.${reason ? ` Reason: ${reason}` : ''}`,
    linkUrl:  filingLink(filingId),
    metadata: { bolNumber: ref, reason: reason ?? null },
    filingId,
  });

  try {
    const users = await prisma.user.findMany({
      where: { orgId, isActive: true, role: { in: ['operator', 'admin', 'owner'] } },
      select: { email: true },
    });
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
  await notify({
    kind:     'filing_amended',
    audience: { orgId, userIds: [userId] },
    title:    'Filing Amendment Submitted',
    message:  `Amendment for ISF filing ${ref} has been submitted.`,
    linkUrl:  filingLink(filingId),
    metadata: { bolNumber: ref },
    filingId,
  });
}

export async function notifyFilingCancelled(orgId: string, userId: string, filingId: string, bolNumber: string): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  await notify({
    kind:     'filing_cancelled',
    audience: { orgId, userIds: [userId] },
    title:    'Filing Cancelled',
    message:  `ISF filing ${ref} has been cancelled.`,
    linkUrl:  filingLink(filingId),
    metadata: { bolNumber: ref },
    filingId,
  });
}

export async function notifyDeadlineApproaching(orgId: string, filingId: string, bolNumber: string, hoursRemaining: number): Promise<void> {
  const ref = bolNumber || filingId.slice(0, 8);
  // 24h or less → critical; 48h/72h → warning. Matches operational urgency.
  const severity: NotificationSeverity = hoursRemaining <= 24 ? 'critical' : 'warning';

  await notify({
    kind:      'deadline_warning',
    severity,
    audience:  { orgId, roles: ['OPERATOR', 'ADMIN', 'OWNER'] },
    title:     `Deadline in ${hoursRemaining}h`,
    message:   `ISF filing ${ref} deadline is in ${hoursRemaining} hours. Submit soon to avoid penalties.`,
    linkUrl:   filingLink(filingId),
    metadata:  { bolNumber: ref, hoursRemaining },
    filingId,
    dedupeKey: `${filingId}_deadline_${hoursRemaining}h`,
  });

  try {
    const users = await prisma.user.findMany({
      where: { orgId, isActive: true, role: { in: ['operator', 'admin', 'owner'] } },
      select: { email: true },
    });
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
  await notify({
    kind:     'api_error',
    audience: { orgId, userIds: [userId] },
    title:    'API Connection Error',
    message,
  });
}
