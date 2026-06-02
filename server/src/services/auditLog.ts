/**
 * Audit Log Service
 * 
 * Writes immutable records to the audit_logs table for all sensitive actions.
 * Used by routes to track: filing CRUD, status changes, auth events, setting changes.
 */

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';

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
    logger.error({ err, action: entry.action }, '[AuditLog] Failed to write audit entry');
  }
}

/**
 * Helper: extract IP + user-agent from an Express request.
 */
export function getRequestMeta(req: any): { ipAddress: string; userAgent: string } {
  // Use req.ip (computed by Express against the trust-proxy setting in
  // index.ts) rather than raw X-Forwarded-For. Pre-fix any client could
  // ship an arbitrary XFF header and have that string land in the audit
  // log as their IP — destroying the forensic value. `app.set('trust
  // proxy', 1)` pins the trust boundary to the nginx loopback subnet so
  // req.ip reflects the real upstream client.
  const ipAddress = req.ip || req.socket?.remoteAddress || '';
  const userAgent = (req.headers['user-agent'] as string) || '';
  return { ipAddress, userAgent };
}
