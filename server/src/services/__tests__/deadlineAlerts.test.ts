/** checkDeadlines: who gets chased about an ISF that still has to reach CBP. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const HOUR = 3600_000;

interface Row { id: string; orgId: string; status: string; filingDeadline: Date | null; masterBol: string; houseBol: null }
interface Where { status: string | { in: string[] }; filingDeadline: { gte?: Date; lte?: Date; lt?: Date } }

const { rows, prisma, notifications } = vi.hoisted(() => {
  const rows: { current: unknown[] } = { current: [] };
  return {
    rows,
    prisma: { filing: { findMany: vi.fn() } },
    notifications: { notifyDeadlineApproaching: vi.fn(), notifyOrgUsers: vi.fn(), notifyFilingAccepted: vi.fn(), notifyFilingRejected: vi.fn() },
  };
});
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('../notifications.js', () => notifications);
vi.mock('../abi/gateway.js', () => ({ abiGateway: {} }));
vi.mock('../validation.js', () => ({ isValidTransition: vi.fn() }));
vi.mock('../notificationDeliveryWorker.js', () => ({ drainEmailDeliveries: vi.fn() }));
vi.mock('../compliance/scoreSnapshot.js', () => ({ recordScoreSnapshot: vi.fn(), triggerForStatus: vi.fn() }));
vi.mock('../shipmentBilling.js', () => ({ billShipmentForFiling: vi.fn(), sweepUnsettledCharges: vi.fn() }));
vi.mock('../compliance/addCvdSync.js', () => ({ syncFromFederalRegister: vi.fn() }));
vi.mock('../compliance/addCvd.js', () => ({ invalidateAddCvdCache: vi.fn() }));
vi.mock('../abiPolling.js', () => ({ pollSentAbiDocuments: vi.fn() }));
vi.mock('../cbp/inboundJob.js', () => ({ processInbound: vi.fn() }));
vi.mock('../cbp/unanswered.js', () => ({ flagUnansweredTransmissions: vi.fn() }));
vi.mock('../leads.js', () => ({ retryLeadNotifications: vi.fn() }));

import { checkDeadlines } from '../backgroundJobs.js';

const filing = (id: string, status: string, hoursToDeadline: number | null): Row => ({
  id, orgId: 'o1', status, masterBol: `MB-${id}`, houseBol: null,
  filingDeadline: hoursToDeadline === null ? null : new Date(Date.now() + hoursToDeadline * HOUR),
});

beforeEach(() => {
  vi.clearAllMocks();
  // A small in-memory filing table, so these assert which filings are chased
  // rather than the shape of a query.
  prisma.filing.findMany.mockImplementation(async ({ where }: { where: Where }) => (rows.current as Row[]).filter((f) => {
    const statuses = typeof where.status === 'string' ? [where.status] : where.status.in;
    if (!statuses.includes(f.status) || !f.filingDeadline) return false;
    const t = f.filingDeadline.getTime();
    const { gte, lte, lt } = where.filingDeadline;
    return (!gte || t >= gte.getTime()) && (!lte || t <= lte.getTime()) && (!lt || t < lt.getTime());
  }));
});

describe('checkDeadlines', () => {
  it('warns about a rejected ISF whose deadline is approaching', async () => {
    rows.current = [filing('r1', 'rejected', 20)];
    await checkDeadlines();
    expect(notifications.notifyDeadlineApproaching).toHaveBeenCalledWith('o1', 'r1', 'MB-r1', 24);
  });

  it('sends the tightest threshold, never "72h" with 20h left', async () => {
    rows.current = [filing('d1', 'draft', 20), filing('d2', 'draft', 40), filing('d3', 'draft', 60)];
    await checkDeadlines();
    expect(notifications.notifyDeadlineApproaching.mock.calls.map((c) => [c[1], c[3]])).toEqual([['d1', 24], ['d2', 48], ['d3', 72]]);
  });

  it('flags a rejected ISF whose deadline has passed', async () => {
    rows.current = [filing('r1', 'rejected', -5), filing('u1', 'draft', 60)];
    await checkDeadlines();
    expect(notifications.notifyOrgUsers).toHaveBeenCalledWith('o1', 'r1', 'deadline_overdue', expect.any(String), expect.stringContaining('MB-r1'), expect.objectContaining({ dedupeKey: 'r1_overdue' }));
  });

  it('checks for overdue filings even when nothing is coming up', async () => {
    rows.current = [filing('d1', 'draft', -5)];
    await checkDeadlines();
    expect(notifications.notifyOrgUsers).toHaveBeenCalledOnce();
  });

  it('leaves accepted filings alone', async () => {
    rows.current = [filing('a1', 'accepted', 20), filing('a2', 'accepted', -5)];
    await checkDeadlines();
    expect(notifications.notifyDeadlineApproaching).not.toHaveBeenCalled();
    expect(notifications.notifyOrgUsers).not.toHaveBeenCalled();
  });
});
