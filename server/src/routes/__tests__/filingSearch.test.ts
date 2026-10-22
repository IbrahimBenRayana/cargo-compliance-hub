/**
 * BUG-028: the shipments search box promises "BOL ... or ISF ID", but a
 * house bill (the shipment's own heading) or an ISF transaction number found
 * nothing.
 */
import { describe, it, expect, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({ prisma: { filing: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) } } }));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import router from '../filings.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const list = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === '/' && l.route.methods.get)!.route!.stack.at(-1)!.handle;

describe('GET /filings search', () => {
  it('matches house bills and ISF transaction numbers too', async () => {
    const res = { status() { return this; }, json: vi.fn() };
    await list({ query: { search: 'HLCU2684105560' }, user: { id: 'u1', orgId: 'o1', role: 'admin' } }, res, vi.fn());
    const where = (prisma.filing.findMany.mock.calls[0] as unknown as [{ where: any }])[0].where;
    const fields = where.OR.map((c: Record<string, unknown>) => Object.keys(c)[0]);
    expect(fields).toEqual(expect.arrayContaining(['masterBol', 'houseBol', 'cbpTransactionId', 'importerName']));
    expect(where.orgId).toBe('o1');
  });
});
