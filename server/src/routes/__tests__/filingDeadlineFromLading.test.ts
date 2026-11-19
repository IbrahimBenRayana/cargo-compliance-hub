/** A lading date is enough to set the ISF deadline; the ETD is optional. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    filing: { findFirst: vi.fn(), findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 1 })), update: vi.fn(async () => ({})), create: vi.fn(async (a: { data: unknown }) => ({ id: 'f1', ...(a.data as object) })) },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import router from '../filings.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const handler = (path: string, method: string) =>
  (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === path && l.route.methods[method])!.route!.stack.at(-1)!.handle;

const LADING = '2026-11-09T06:00:00.000Z';
const DEADLINE = '2026-11-08T06:00:00.000Z';
const user = { id: 'u1', orgId: 'o1', role: 'admin' };
const res = () => ({ statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn({ ...prisma, filingStatusHistory: { create: vi.fn() }, consolidation: { create: vi.fn() } } as never));
});

describe('filing deadline from the lading date alone', () => {
  it('POST /consolidation sets it on every house bill', async () => {
    const r = res();
    await handler('/consolidation', 'post')({
      user,
      headers: {},
      body: { filingType: 'ISF-10', masterBol: 'MB1', houseBills: ['HB1', 'HB2'], estimatedLading: LADING },
    }, r, vi.fn());
    expect(prisma.filing.create).toHaveBeenCalledTimes(2);
    const dates = prisma.filing.create.mock.calls.map((c) => ((c as unknown as [{ data: { filingDeadline: Date } }])[0].data.filingDeadline).toISOString());
    expect(dates).toEqual([DEADLINE, DEADLINE]);
  });

  it('PATCH /:id sets it when only the lading date is sent and no ETD exists', async () => {
    prisma.filing.findFirst.mockResolvedValue({ id: 'f1', orgId: 'o1', status: 'draft', filingDeadline: null, estimatedDeparture: null, estimatedLading: null });
    await handler('/:id', 'patch')({ user, headers: {}, params: { id: 'f1' }, body: { estimatedLading: LADING } }, res(), vi.fn());
    const data = (prisma.filing.updateMany.mock.calls[0] as unknown as [{ data: { filingDeadline: Date } }])[0].data;
    expect(data.filingDeadline.toISOString()).toBe(DEADLINE);
  });
});
