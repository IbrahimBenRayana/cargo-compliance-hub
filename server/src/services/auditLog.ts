/**
 * Audit Log Service
 * 
 * Writes immutable records to the audit_logs table for all sensitive actions.
 * Used by routes to track: filing CRUD, status changes, auth events, setting changes.
 */

import { prisma } from '../config/database.js';

export interface AuditLogEntry {
  orgId?: string;
  userId?: string;
  action: string;         // e.g. 'filing.created', 'filing.submitted', 'user.login'
  entityType?: string;    // e.g. 'filing', 'user', 'organization'
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: entry.orgId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        oldValue: entry.oldValue ?? undefined,
        newValue: entry.newValue ?? undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit log failures should never crash the app — log and continue
    console.error('[AuditLog] Failed to write audit entry:', entry.action, err);
  }
}

/**
 * Helper: extract IP + user-agent from an Express request.
 */
export function getRequestMeta(req: any): { ipAddress: string; userAgent: string } {
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || '';
  const userAgent = (req.headers['user-agent'] as string) || '';
  return { ipAddress, userAgent };
}
