/**
 * Filing score snapshots.
 *
 * Captures the compliance score at every scoring event so we can build a
 * true trajectory (validation-driven) for each filing instead of the
 * status-band approximation derived from FilingStatusHistory.
 *
 * Snapshots are append-only. The /filings/:id/score-history endpoint
 * reads them when present; for filings that pre-date this feature it
 * falls back to the status-history derivation.
 *
 * Call sites: every filings.ts handler that transitions status calls
 * `recordScoreSnapshot(filingId, trigger)` after the status update is
 * committed. We absorb failures (fire-and-forget) — losing a snapshot
 * row is annoying but must not break the user's flow.
 */

import { prisma } from '../../config/database.js';
import { validateFiling } from '../validation.js';
import logger from '../../config/logger.js';

export type SnapshotTrigger =
  | 'created'
  | 'submitted'
  | 'rejected'
  | 'accepted'
  | 'amended'
  | 'cancelled'
  | 'on_hold'
  | 'manual';

/** Map a filing status string to the matching snapshot trigger. Callers
 *  pass the status they just wrote so the trigger label mirrors it; the
 *  fallback 'manual' covers any out-of-band recompute path. */
export function triggerForStatus(status: string): SnapshotTrigger {
  switch (status) {
    case 'draft':     return 'created';
    case 'submitted': return 'submitted';
    case 'rejected':  return 'rejected';
    case 'accepted':  return 'accepted';
    case 'amended':   return 'amended';
    case 'cancelled': return 'cancelled';
    case 'on_hold':   return 'on_hold';
    default:          return 'manual';
  }
}

/** Status-status filings score the same way the action-queue endpoint does:
 *  accepted/amended → 100, everything else → 100 − (8·critical + 2·warning + 0.5·info)
 *  clipped to [10, 100]. Mirrors scoreFiling() in routes/compliance.ts. */
function scoreFor(status: string, c: number, w: number, i: number): number {
  if (status === 'accepted' || status === 'amended') return 100;
  if (c === 0 && w === 0 && i === 0) return 100;
  const penalty = c * 8 + w * 2 + i * 0.5;
  return Math.max(10, Math.min(100, Math.round(100 - penalty)));
}

/**
 * Compute and persist the current snapshot for a filing.
 *
 * Reads the filing fresh from the DB (don't trust caller state for
 * status post-transition) and runs validateFiling to capture the
 * error breakdown that drove the score. Idempotent only in spirit —
 * back-to-back calls for the same trigger DO create two rows, which
 * is intentional: every scoring event deserves a record.
 */
export async function recordScoreSnapshot(filingId: string, trigger: SnapshotTrigger): Promise<void> {
  try {
    const f = await prisma.filing.findUnique({ where: { id: filingId } });
    if (!f) return;

    const v = validateFiling(f as any);
    const score = scoreFor(f.status, v.criticalCount, v.warningCount, v.infoCount);

    await prisma.filingScoreSnapshot.create({
      data: {
        filingId,
        score,
        status:        f.status,
        criticalCount: v.criticalCount,
        warningCount:  v.warningCount,
        infoCount:     v.infoCount,
        triggerEvent:  trigger,
      },
    });
  } catch (err) {
    // Snapshot writes are non-critical. Log + swallow so the caller's
    // status transition isn't affected.
    logger.warn({ err, filingId, trigger }, '[scoreSnapshot] failed to record');
  }
}
