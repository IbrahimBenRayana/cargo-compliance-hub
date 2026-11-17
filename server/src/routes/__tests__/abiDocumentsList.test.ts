/** GET /abi-documents and /abi-documents/facets: the Entries page's tabs count on the server. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prisma } = vi.hoisted(() => ({ prisma: { abiDocument: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() } } }));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import router from '../abiDocuments.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const handler = (path: string) =>
  (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === path && l.route.methods.get)!.route!.stack.at(-1)!.handle;

function call(path: string, query: Record<string, string>) {
  const res = {
    statusCode: 200, headers: {} as Record<string, string>, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    set(name: string, value: string) { this.headers[name] = value; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return Promise.resolve(handler(path)({ query, user: { id: 'u1', orgId: 'o1', role: 'admin' } }, res, vi.fn())).then(() => res);
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.abiDocument.findMany.mockResolvedValue([]);
  prisma.abiDocument.count.mockResolvedValue(0);
  prisma.abiDocument.groupBy.mockResolvedValue([]);
});

describe('GET /abi-documents', () => {
  it('still filters by one status', async () => {
    await call('/', { status: 'DRAFT' });
    expect(prisma.abiDocument.findMany.mock.calls[0][0].where).toEqual({ orgId: 'o1', status: 'DRAFT' });
  });

  it('takes several statuses, so Sent can cover entries still sending', async () => {
    await call('/', { status: 'SENDING,SENT' });
    expect(prisma.abiDocument.findMany.mock.calls[0][0].where.status).toEqual({ in: ['SENDING', 'SENT'] });
  });

  it('refuses a status that does not exist', async () => {
    expect((await call('/', { status: 'RELEASED' })).statusCode).toBe(400);
  });
});

describe('GET /abi-documents/facets', () => {
  it('counts every status under the search, whichever tab is open', async () => {
    prisma.abiDocument.groupBy.mockResolvedValue([{ status: 'DRAFT', _count: { _all: 4 } }, { status: 'ACCEPTED', _count: { _all: 9 } }]);
    const res = await call('/facets', { status: 'DRAFT', mbolNumber: 'MAEU' });
    const where = prisma.abiDocument.groupBy.mock.calls[0][0].where;
    expect(where.orgId).toBe('o1');
    expect(where.status).toBeUndefined();
    expect(where.mbolNumber).toEqual({ contains: 'MAEU', mode: 'insensitive' });
    expect(res.body).toEqual({ status: { DRAFT: 4, ACCEPTED: 9 } });
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });
});
