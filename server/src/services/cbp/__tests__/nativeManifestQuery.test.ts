/**
 * Native manifest query, the stateful part: who gets the native path, how
 * CBP's tagged reply settles the query, and what happens when none comes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, env, notify, loadOrgCbpConfig } = vi.hoisted(() => ({
  prisma: {
    cbpTransmission: { findUnique: vi.fn(), update: vi.fn() },
    manifestQuery: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
  env: { MANIFEST_QUERY_NATIVE: 'off' as 'off' | 'staff' | 'all', NODE_ENV: 'test' },
  notify: vi.fn(),
  loadOrgCbpConfig: vi.fn(),
}));
vi.mock('../../../config/database.js', () => ({ prisma }));
vi.mock('../../../config/env.js', () => ({ env }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../../notifications.js', () => ({ notify }));
vi.mock('../filerIdentity.js', () => ({ SIGMA_FILER_CODE: 'S7P', loadOrgCbpConfig }));
vi.mock('../transport.js', () => ({ cbpTransport: {}, cbpTrafficConfig: { transport: 'mock', environment: 'CERT' } }));
vi.mock('../sender.js', () => ({ requireCbpSender: vi.fn() }));
vi.mock('../nativeTransmit.js', () => ({ transmitNative: vi.fn() }));

import { awaitManifestAnswer, manifestQueryHandler, usesNativeManifestQuery } from '../nativeManifestQuery.js';

const rec = (...parts: [number, string][]) => {
  const chars = new Array<string>(80).fill(' ');
  for (const [start, text] of parts) for (let i = 0; i < text.length; i++) chars[start - 1 + i] = text[i];
  return chars.join('');
};
const reply = (...inner: string[]) => [
  'A   LGB1S7PSECRET111526     C1'.padEnd(80, ' '),
  'B  2704S7PC1'.padEnd(80, ' '),
  ...inner,
  'Y  2704S7PC1'.padEnd(80, ' '),
  'Z   LGB1S7P      111526'.padEnd(80, ' '),
];
const row = (lines: string[], tag: string | null = 'MCLABC') => ({ id: 'r1', environment: 'CERT', application: 'C1', userDataTag: tag, lines });

const TX = { id: 't1', entityType: 'manifest_query', entityId: 'q1' };
const QUERY = { id: 'q1', orgId: 'o1', userId: 'u1', bolNumber: 'MAEU123456789', bolType: 'BOLNUMBER', status: 'pending' };
const ON_FILE = reply(
  rec([1, 'WR1'], [43, 'MAEU'], [47, 'MAERSK ESSEX'], [67, '432W'], [72, '111526']),
  rec([1, 'WR4'], [16, '123456789'], [52, '00000250'], [65, 'MAEU'], [73, '0'], [75, '1']),
);

beforeEach(() => {
  vi.clearAllMocks();
  env.MANIFEST_QUERY_NATIVE = 'off';
  prisma.cbpTransmission.findUnique.mockResolvedValue(TX);
  prisma.manifestQuery.findUnique.mockResolvedValue(QUERY);
});

describe('usesNativeManifestQuery', () => {
  const staff = { orgId: 'o1', isPlatformAdmin: true };
  const client = { orgId: 'o1', isPlatformAdmin: false };

  it('is off for everyone until switched on', async () => {
    loadOrgCbpConfig.mockResolvedValue(null);
    expect(await usesNativeManifestQuery(staff)).toBe(false);
    expect(await usesNativeManifestQuery(client)).toBe(false);
  });

  it('reaches platform admins only on staff', async () => {
    env.MANIFEST_QUERY_NATIVE = 'staff';
    loadOrgCbpConfig.mockResolvedValue(null);
    expect(await usesNativeManifestQuery(staff)).toBe(true);
    expect(await usesNativeManifestQuery(client)).toBe(false);
  });

  it('follows the org gateway on all: native by default, the gateway for an org kept on it', async () => {
    env.MANIFEST_QUERY_NATIVE = 'all';
    loadOrgCbpConfig.mockResolvedValue(null);
    expect(await usesNativeManifestQuery(client)).toBe(true);
    loadOrgCbpConfig.mockResolvedValue({ gateway: 'NATIVE' });
    expect(await usesNativeManifestQuery(client)).toBe(true);
    loadOrgCbpConfig.mockResolvedValue({ gateway: 'CC' });
    expect(await usesNativeManifestQuery(client)).toBe(false);
  });
});

describe('manifestQueryHandler', () => {
  it('completes the query from the tagged reply and tells the asker', async () => {
    const match = await manifestQueryHandler(row(ON_FILE));
    expect(prisma.cbpTransmission.findUnique).toHaveBeenCalledWith({ where: { userDataTag: 'MCLABC' } });
    expect(prisma.cbpTransmission.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'ACCEPTED', respondedAt: expect.any(Date) },
    });
    const update = prisma.manifestQuery.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'q1' });
    expect(update.data).toMatchObject({ status: 'completed', errorMessage: null, completedAt: expect.any(Date) });
    expect(update.data.response.data.response[0]).toMatchObject({ carrierCode: 'MAEU', conveyanceName: 'MAERSK ESSEX' });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'manifest_query_complete', audience: { orgId: 'o1', userIds: ['u1'] } }));
    expect(match).toMatchObject({ entityType: 'manifest_query', entityId: 'q1', transmissionId: 't1' });
  });

  it('fails the query with CBP\'s words when CBP refuses it', async () => {
    await manifestQueryHandler(row(reply(rec([1, 'WSA'], [16, 'MAEU'], [20, '123456789'], [32, 'X17'], [35, 'FILER NOT AUTHORIZED']))));
    expect(prisma.cbpTransmission.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }));
    expect(prisma.manifestQuery.update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: { status: 'failed', errorMessage: 'CBP answered: X17-FILER NOT AUTHORIZED' },
    });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'manifest_query_failed' }));
  });

  it('still completes a query whose wait had already given up', async () => {
    prisma.manifestQuery.findUnique.mockResolvedValue({ ...QUERY, status: 'timeout' });
    await manifestQueryHandler(row(ON_FILE));
    expect(prisma.manifestQuery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }));
  });

  it('does not overwrite an answer already stored', async () => {
    prisma.manifestQuery.findUnique.mockResolvedValue({ ...QUERY, status: 'completed' });
    const match = await manifestQueryHandler(row(ON_FILE));
    expect(prisma.manifestQuery.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(match).not.toBeNull();
  });

  it('leaves untagged rows and other transmissions to the other handlers', async () => {
    expect(await manifestQueryHandler(row(ON_FILE, null))).toBeNull();
    expect(await manifestQueryHandler(row(ON_FILE, 'SCENARIO 090'))).toBeNull();
    prisma.cbpTransmission.findUnique.mockResolvedValue({ id: 't2', entityType: 'filing', entityId: 'f1' });
    expect(await manifestQueryHandler(row(ON_FILE))).toBeNull();
    expect(prisma.manifestQuery.update).not.toHaveBeenCalled();
  });
});

describe('awaitManifestAnswer', () => {
  it('stops as soon as the query is settled', async () => {
    prisma.manifestQuery.findUnique.mockResolvedValue({ status: 'completed' });
    const pull = vi.fn().mockResolvedValue(undefined);
    await awaitManifestAnswer('q1', pull, 5000);
    expect(pull).toHaveBeenCalledTimes(1);
    expect(prisma.manifestQuery.updateMany).not.toHaveBeenCalled();
  });

  it('marks the query timed out and tells the asker when no reply comes', async () => {
    prisma.manifestQuery.updateMany.mockResolvedValue({ count: 1 });
    await awaitManifestAnswer('q1', vi.fn().mockResolvedValue(undefined), 0);
    expect(prisma.manifestQuery.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: 'pending' },
      data: { status: 'timeout', errorMessage: 'No response from CBP after 0 seconds.' },
    });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'manifest_query_failed' }));
  });

  it('says nothing when the reply won the race with the timeout', async () => {
    prisma.manifestQuery.updateMany.mockResolvedValue({ count: 0 });
    await awaitManifestAnswer('q1', vi.fn(), 0);
    expect(notify).not.toHaveBeenCalled();
  });
});
