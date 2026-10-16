/**
 * Exactly-once transmission (native go-live 1.7, audit ENG-12 / BPR-06):
 * the row (wire + correlation tag) exists before anything is sent; a send
 * that provably never left is FAILED (safe to retry); anything that may
 * have reached CBP is UNKNOWN and never retried blindly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: { cbpTransmission: { create: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));

import { transmitNative, correlationTag } from '../nativeTransmit.js';
import { CbpEnvironmentMismatchError } from '../guardedTransport.js';

const base = {
  orgId: 'o1', environment: 'CERT' as const, application: 'SF', action: 'A',
  entityType: 'filing', entityId: 'f1', filerCode: 'S7P',
  buildWire: (tag: string) => ['A1303S7P', `B  1303S7PSF${' '.repeat(47)}${tag}`, 'Z1303S7P'],
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.cbpTransmission.create.mockImplementation(async ({ data }: any) => ({ id: data.id, ...data }));
  prisma.cbpTransmission.update.mockImplementation(async ({ data }: any) => data);
});

describe('correlationTag', () => {
  it('fits the 21-character B-record user data field', () => {
    const tag = correlationTag('0f8fad5b-d9cb-469f-a165-70867728950e');
    expect(tag.length).toBeLessThanOrEqual(21);
    expect(tag).toMatch(/^MCL[0-9A-F]+$/);
  });
});

describe('transmitNative', () => {
  it('stores the row with its wire before sending, then marks it SENT', async () => {
    const order: string[] = [];
    prisma.cbpTransmission.create.mockImplementation(async ({ data }: any) => { order.push('create'); return data; });
    const transport = { send: vi.fn(async () => { order.push('send'); return { messageId: 'm1' }; }) };
    const out = await transmitNative({ ...base, transport });
    expect(order).toEqual(['create', 'send']);
    const created = prisma.cbpTransmission.create.mock.calls[0][0].data;
    expect(created.wireText).toContain(created.userDataTag);
    expect(created.status).toBe('QUEUED');
    expect(prisma.cbpTransmission.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SENT', mqMessageId: 'm1' }),
    }));
    expect(out.status).toBe('SENT');
  });

  it('marks a guard refusal FAILED: nothing left, so a retry is safe', async () => {
    const transport = { send: vi.fn(async () => { throw new CbpEnvironmentMismatchError('wrong qmgr'); }) };
    const out = await transmitNative({ ...base, transport });
    expect(out.status).toBe('FAILED');
  });

  it('marks an unreachable bridge FAILED', async () => {
    const transport = { send: vi.fn(async () => { throw new Error('mq-bridge unreachable at http://mq-bridge:8080: ECONNREFUSED'); }) };
    expect((await transmitNative({ ...base, transport })).status).toBe('FAILED');
  });

  it('marks any other send error UNKNOWN: CBP may have it, never retry blindly', async () => {
    const transport = { send: vi.fn(async () => { throw new Error('MQRC 2009 connection broken'); }) };
    const out = await transmitNative({ ...base, transport });
    expect(out.status).toBe('UNKNOWN');
    expect(out.lastError).toMatch('2009');
  });
});
