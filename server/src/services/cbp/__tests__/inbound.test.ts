/**
 * At-least-once inbound (native go-live D1/D2): every CBP message is stored
 * before it is removed from the queue. A message is acked only after its row
 * exists; a re-delivered message is recognised by (environment, MsgId) and
 * acked again without a second row; a DB failure acks nothing it didn't store.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({ prisma: { cbpInboundMessage: { create: vi.fn() } } }));
vi.mock('../../../config/database.js', () => ({ prisma }));

import { pullInbound, envelopeKeys } from '../inbound.js';

const ID1 = 'a'.repeat(48);
const ID2 = 'b'.repeat(48);
const SN = [
  'A1303S7PBCFX2J100926     SN',
  'B  1303S7PSN                                               SCENARIO 090',
  'SF9002   ISF ACCEPTED',
  'Y  1303S7PSN00003',
  'Z1303S7P      100926',
];

function fakeTransport(messages: { msgId: string; lines: string[] }[]) {
  return {
    browse: vi.fn(async () => messages),
    ack: vi.fn(async (ids: string[]) => ({ acked: ids, missing: [] as string[] })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.cbpInboundMessage.create.mockResolvedValue({});
});

describe('envelopeKeys', () => {
  it('reads the application id and the B-record user data', () => {
    expect(envelopeKeys(SN)).toEqual({ application: 'SN', userDataTag: 'SCENARIO 090' });
  });

  it('tolerates a malformed batch', () => {
    expect(envelopeKeys(['garbage'])).toEqual({ application: undefined, userDataTag: undefined });
  });
});

describe('pullInbound', () => {
  it('stores every message, then acks exactly those ids', async () => {
    const t = fakeTransport([{ msgId: ID1, lines: SN }, { msgId: ID2, lines: SN }]);
    const out = await pullInbound({ transport: t, environment: 'CERT' });
    expect(prisma.cbpInboundMessage.create).toHaveBeenCalledTimes(2);
    expect(prisma.cbpInboundMessage.create.mock.calls[0][0].data).toMatchObject({
      environment: 'CERT', mqMessageId: ID1, application: 'SN', userDataTag: 'SCENARIO 090', rawText: SN.join('\n'),
    });
    expect(t.ack).toHaveBeenCalledWith([ID1, ID2]);
    expect(out).toMatchObject({ received: 2, stored: 2, duplicates: 0, acked: 2 });
  });

  it('acks a re-delivered message without storing it twice', async () => {
    prisma.cbpInboundMessage.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    const t = fakeTransport([{ msgId: ID1, lines: SN }]);
    const out = await pullInbound({ transport: t, environment: 'CERT' });
    expect(t.ack).toHaveBeenCalledWith([ID1]);
    expect(out).toMatchObject({ stored: 0, duplicates: 1, acked: 1 });
  });

  it('never acks a message it could not store', async () => {
    prisma.cbpInboundMessage.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('db down'));
    const t = fakeTransport([{ msgId: ID1, lines: SN }, { msgId: ID2, lines: SN }]);
    await expect(pullInbound({ transport: t, environment: 'CERT' })).rejects.toThrow('db down');
    expect(t.ack).toHaveBeenCalledWith([ID1]);
  });

  it('does nothing when the queue is empty', async () => {
    const t = fakeTransport([]);
    const out = await pullInbound({ transport: t, environment: 'CERT' });
    expect(t.ack).not.toHaveBeenCalled();
    expect(out.received).toBe(0);
  });
});
