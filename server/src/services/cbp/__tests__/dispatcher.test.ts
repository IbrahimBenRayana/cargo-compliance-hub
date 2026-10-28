/**
 * Dispatcher (native go-live D1/D3): stored inbound rows are offered to
 * handlers in order; the first that claims a row records the match.
 * Unclaimed rows are kept as unmatched (dispatched, no entity), and a
 * handler error leaves the row pending for the next run.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: { cbpInboundMessage: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));

import { dispatchPending } from '../dispatcher.js';

const row = (id: string) => ({ id, environment: 'CERT', application: 'SN', userDataTag: 'SCENARIO 090', rawText: 'A\nZ' });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.cbpInboundMessage.update.mockResolvedValue({});
});

describe('dispatchPending', () => {
  it('records the first handler that claims a row', async () => {
    prisma.cbpInboundMessage.findMany.mockResolvedValue([row('r1')]);
    const skip = vi.fn(async () => null);
    const claim = vi.fn(async () => ({ entityType: 'cert_transmission', entityId: 'c1' }));
    const out = await dispatchPending({ environment: 'CERT', handlers: [skip, claim] });
    expect(skip).toHaveBeenCalledWith(expect.objectContaining({ lines: ['A', 'Z'] }));
    expect(prisma.cbpInboundMessage.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ matchedEntityType: 'cert_transmission', matchedEntityId: 'c1', dispatchedAt: expect.any(Date) }),
    });
    expect(out).toEqual({ dispatched: 1, matched: 1, unmatched: 0, failed: 0 });
  });

  it('keeps an unclaimed row as unmatched', async () => {
    prisma.cbpInboundMessage.findMany.mockResolvedValue([row('r1')]);
    const out = await dispatchPending({ environment: 'CERT', handlers: [async () => null] });
    expect(prisma.cbpInboundMessage.update.mock.calls[0][0].data).toMatchObject({ dispatchedAt: expect.any(Date), matchedEntityType: null });
    expect(out.unmatched).toBe(1);
  });

  it('leaves a row pending when a handler throws, recording the error', async () => {
    prisma.cbpInboundMessage.findMany.mockResolvedValue([row('r1')]);
    const out = await dispatchPending({ environment: 'CERT', handlers: [async () => { throw new Error('db blip'); }] });
    const data = prisma.cbpInboundMessage.update.mock.calls[0][0].data;
    expect(data.parseError).toMatch('db blip');
    expect(data.dispatchedAt).toBeUndefined();
    expect(out.failed).toBe(1);
  });

  it('only reads undispatched rows of this environment, oldest first', async () => {
    prisma.cbpInboundMessage.findMany.mockResolvedValue([]);
    await dispatchPending({ environment: 'PROD', handlers: [] });
    expect(prisma.cbpInboundMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { environment: 'PROD', dispatchedAt: null },
      orderBy: { receivedAt: 'asc' },
    }));
  });
});
