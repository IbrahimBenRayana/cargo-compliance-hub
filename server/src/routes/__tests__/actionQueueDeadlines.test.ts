/** GET /compliance/action-queue: the deadline items a filer must not lose sight of. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const HOUR = 3600_000;

const { prisma } = vi.hoisted(() => ({
  prisma: { filing: { findMany: vi.fn() }, abiDocument: { findMany: vi.fn(async () => []) } },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import router from '../compliance.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const queue = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === '/action-queue')!.route!.stack.at(-1)!.handle;

const filing = (over: Record<string, unknown>) => ({
  id: 'f1', filingType: 'ISF', status: 'draft', masterBol: 'MB1', houseBol: null,
  createdAt: new Date(Date.now() - 24 * HOUR), submittedAt: null, acceptedAt: null, rejectedAt: null, rejectionReason: null,
  estimatedDeparture: null, estimatedLading: null, manufacturer: null, seller: null, buyer: null, shipToParty: null, consigneeAddress: null, commodities: [],
  ...over,
});
/** Lading at `hours` + 24 puts the ISF cutoff `hours` from now. */
const cutoffIn = (hours: number) => ({ estimatedLading: new Date(Date.now() + (hours + 24) * HOUR) });

async function deadlineItems() {
  const res = { status() { return this; }, json: vi.fn() };
  await queue({ user: { id: 'u1', orgId: 'o1', role: 'operator' } }, res, vi.fn());
  const body = res.json.mock.calls[0][0] as { actionQueue: Array<{ id: string; kind: string; severity: string; title: string; context: string }> };
  return body.actionQueue.filter((i) => i.kind === 'deadline');
}

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /action-queue deadline items', () => {
  it('includes a rejected ISF that is running out of time', async () => {
    prisma.filing.findMany.mockResolvedValue([filing({ status: 'rejected', ...cutoffIn(10) })]);
    expect((await deadlineItems()).map((i) => i.id)).toEqual(['deadline:f1']);
  });

  it('keeps an overdue draft after the first day, as critical', async () => {
    prisma.filing.findMany.mockResolvedValue([filing(cutoffIn(-24 * 5))]);
    const [item] = await deadlineItems();
    expect(item).toMatchObject({ severity: 'critical', title: 'ISF deadline passed — MB1' });
    expect(item.context).not.toContain('before cutoff');
  });

  it('keeps an overdue rejected ISF too', async () => {
    prisma.filing.findMany.mockResolvedValue([filing({ status: 'rejected', ...cutoffIn(-24 * 5) })]);
    expect(await deadlineItems()).toHaveLength(1);
  });

  it('still leaves out a deadline more than 72h away', async () => {
    prisma.filing.findMany.mockResolvedValue([filing(cutoffIn(100))]);
    expect(await deadlineItems()).toEqual([]);
  });

  it('works from the lading date alone, without inventing a departure', async () => {
    prisma.filing.findMany.mockResolvedValue([filing(cutoffIn(10))]);
    const [item] = await deadlineItems();
    expect(item.title).toBe('ISF deadline in 10h — MB1');
    expect(item.context).not.toMatch(/1970|Dec 31|Jan 1\b/);
  });
});
