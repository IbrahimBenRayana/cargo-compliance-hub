import type { FilingCbpActivity } from '@/api/client';

/**
 * When CBP rejects an ISF replace, it keeps the version it accepted before,
 * but the shipment record holds the rejected edits (so they can be fixed and
 * resent). Returns what the user must be told, or null when nothing differs.
 */
export function rejectedChanges(activity: FilingCbpActivity | undefined): { rejectedAt: string | null; reasons: string[] } | null {
  if (!activity || activity.filing.cbpState !== 'ON_FILE') return null;
  const newest = [...activity.transmissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!newest || newest.action !== 'R' || newest.status !== 'REJECTED') return null;
  const reasons = newest.inbound
    .flatMap((m) => m.parsed?.conditions ?? [])
    .map((c) => [c.code, c.narrative].filter(Boolean).join(' '))
    .filter(Boolean);
  return { rejectedAt: newest.respondedAt, reasons: [...new Set(reasons)] };
}
