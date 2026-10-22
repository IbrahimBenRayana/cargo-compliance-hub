/**
 * BUG-022: a transmission CBP never answers (e.g. a filer code not approved
 * on our queue) must not sit as "Submitted" forever.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn(), notify: vi.fn(), error: vi.fn() }));
vi.mock('../../../config/database.js', () => ({ prisma: { cbpTransmission: { findMany: m.findMany }, notification: { findFirst: m.findFirst } } }));
vi.mock('../../notifications.js', () => ({ notify: m.notify }));
vi.mock('../../../config/logger.js', () => ({ default: { error: m.error, warn: vi.fn(), info: vi.fn() } }));

import { isOverdue, flagUnansweredTransmissions, NO_ANSWER_MINUTES } from '../unanswered.js';

const now = new Date('2026-10-22T17:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe('isOverdue', () => {
  it('is true only for a sent transmission with no answer past the limit', () => {
    expect(isOverdue({ status: 'SENT', sentAt: ago(NO_ANSWER_MINUTES + 1) }, now)).toBe(true);
    expect(isOverdue({ status: 'SENT', sentAt: ago(NO_ANSWER_MINUTES - 1) }, now)).toBe(false);
    expect(isOverdue({ status: 'ACCEPTED', sentAt: ago(500) }, now)).toBe(false);
    expect(isOverdue({ status: 'SENT', sentAt: null }, now)).toBe(false);
  });
});

describe('flagUnansweredTransmissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tells the org once, links the shipment, and alerts operations once', async () => {
    m.findMany.mockResolvedValue([
      { id: 't1', orgId: 'o1', entityType: 'filing', entityId: 'f1', application: 'SF', action: 'A', filerCode: 'QA1', sentAt: ago(130) },
    ]);
    m.findFirst.mockResolvedValue(null);
    expect(await flagUnansweredTransmissions(now)).toBe(1);
    expect(m.notify).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'cbp_no_answer',
      audience: { orgId: 'o1', roles: ['OPERATOR'] },
      linkUrl: '/shipments/f1',
      filingId: 'f1',
      dedupeKey: 'cbp-no-answer:t1',
    }));
    expect(m.notify.mock.calls[0][0].message).toMatch(/QA1/);
    expect(m.error).toHaveBeenCalledTimes(1);
  });

  it('stays quiet about transmissions it already flagged', async () => {
    m.findMany.mockResolvedValue([{ id: 't1', orgId: 'o1', entityType: 'filing', entityId: 'f1', application: 'SF', action: 'A', filerCode: 'S7P', sentAt: ago(130) }]);
    m.findFirst.mockResolvedValue({ id: 'n1' });
    expect(await flagUnansweredTransmissions(now)).toBe(0);
    expect(m.notify).not.toHaveBeenCalled();
    expect(m.error).not.toHaveBeenCalled();
  });

  it('links entries to the entry page', async () => {
    m.findMany.mockResolvedValue([{ id: 't2', orgId: 'o1', entityType: 'abi_document', entityId: 'e1', application: 'AE', action: 'A', filerCode: 'S7P', sentAt: ago(60) }]);
    m.findFirst.mockResolvedValue(null);
    await flagUnansweredTransmissions(now);
    expect(m.notify).toHaveBeenCalledWith(expect.objectContaining({ linkUrl: '/abi-documents/e1', abiDocumentId: 'e1' }));
  });

  it('only looks at transmissions sent before the limit', async () => {
    m.findMany.mockResolvedValue([]);
    await flagUnansweredTransmissions(now);
    const where = m.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('SENT');
    expect(where.sentAt.lt).toEqual(ago(NO_ANSWER_MINUTES));
  });
});
