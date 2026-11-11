/**
 * GET /filings and GET /filings/facets: the Shipments page pages through
 * every shipment on the server instead of filtering the newest 100.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    filing: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import router from '../filings.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const handler = (path: string) =>
  (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === path && l.route.methods.get)!.route!.stack.at(-1)!.handle;

function call(path: string, query: Record<string, string>) {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    set(name: string, value: string) { this.headers[name] = value; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return Promise.resolve(handler(path)({ query, user: { id: 'u1', orgId: 'o1', role: 'admin' } }, res, vi.fn())).then(() => res);
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'f1', status: 'draft', consolidationId: null, estimatedDeparture: null, estimatedLading: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  prisma.filing.findMany.mockResolvedValue([]);
  prisma.filing.count.mockResolvedValue(0);
  prisma.filing.groupBy.mockResolvedValue([]);
  prisma.$queryRaw.mockResolvedValue([]);
});

describe('GET /filings', () => {
  it('answers 400 for a column it cannot sort by, instead of failing inside the database', async () => {
    const res = await call('/', { sortBy: 'passwordHash' });
    expect(res.statusCode).toBe(400);
    expect(prisma.filing.findMany).not.toHaveBeenCalled();
  });

  it('filters by several statuses and pages on the server', async () => {
    prisma.filing.count.mockResolvedValue(57);
    const res = await call('/', { status: 'submitted,pending_cbp', page: '3', limit: '25', sortBy: 'masterBol', sortOrder: 'asc' });
    const args = prisma.filing.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ orgId: 'o1', status: { in: ['submitted', 'pending_cbp'] } });
    expect(args).toMatchObject({ skip: 50, take: 25, orderBy: { masterBol: 'asc' } });
    expect(res.body.pagination).toEqual({ total: 57, page: 3, limit: 25, totalPages: 3 });
  });

  it('gives each row its cutoff and the size of its consolidation', async () => {
    prisma.filing.findMany.mockResolvedValue([
      row({ id: 'a', consolidationId: 'c1', estimatedDeparture: new Date('2026-11-21T00:00:00.000Z') }),
      row({ id: 'b' }),
    ]);
    prisma.filing.groupBy.mockResolvedValue([{ consolidationId: 'c1', _count: { _all: 4 } }]);
    const res = await call('/', {});
    expect(res.body.data[0]).toMatchObject({ id: 'a', consolidationSize: 4, cutoff: { basis: 'ETD_ESTIMATE' } });
    expect(res.body.data[1]).toMatchObject({ id: 'b', consolidationSize: null, cutoff: null });
    expect(prisma.filing.groupBy.mock.calls[0][0].where).toEqual({ orgId: 'o1', consolidationId: { in: ['c1'] } });
  });

  it('does not count consolidations when the page has none', async () => {
    prisma.filing.findMany.mockResolvedValue([row()]);
    await call('/', {});
    expect(prisma.filing.groupBy).not.toHaveBeenCalled();
  });
});

describe('GET /filings/facets', () => {
  it('counts every status under the other filters, so the tabs stay true while one is open', async () => {
    prisma.filing.groupBy.mockResolvedValue([
      { status: 'draft', _count: { _all: 12 } },
      { status: 'accepted', _count: { _all: 280 } },
    ]);
    const res = await call('/facets', { status: 'draft', search: 'HLCU' });
    const where = prisma.filing.groupBy.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(where.OR).toBeDefined();
    expect(res.body.status).toEqual({ draft: 12, accepted: 280 });
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });

  it('lists the origins the organisation actually ships from', async () => {
    prisma.$queryRaw.mockResolvedValue([{ code: 'CN', count: 40 }, { code: 'VN', count: 3 }]);
    const res = await call('/facets', {});
    expect(res.body.origins).toEqual([{ code: 'CN', count: 40 }, { code: 'VN', count: 3 }]);
    expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual(['o1']);
  });

  it('answers 400 for a filter it does not understand', async () => {
    const res = await call('/facets', { status: 'cleared' });
    expect(res.statusCode).toBe(400);
  });
});
