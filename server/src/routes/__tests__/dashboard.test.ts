/**
 * The dashboard must only ever read the caller's org and plan. Prisma is faked so
 * every query can be inspected: one without the org scope fails this suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: Array<{ model: string; method: string; args: { where?: Record<string, unknown> } }> = [];
const rows: Record<string, unknown[]> = {};

vi.mock('../../config/database.js', () => {
  const model = (name: string) => new Proxy({}, {
    get: (_t, method: string) => async (args: { where?: Record<string, unknown> } = {}) => {
      calls.push({ model: name, method, args });
      if (method === 'count') return 0;
      if (method === 'findFirst' || method === 'findUnique') return null;
      return rows[name] ?? [];
    },
  });
  return { prisma: {
    filing: model('filing'), abiDocument: model('abiDocument'), cbpTransmission: model('cbpTransmission'),
    trackedShipment: model('trackedShipment'), orgCbpConfig: model('orgCbpConfig'), filingStatusHistory: model('filingStatusHistory'),
  } };
});

const capabilities: string[] = [];
vi.mock('../../services/entitlements.js', () => ({
  getOrgEntitlements: async () => ({
    capabilities, hasActiveTier: true, billingMode: 'card', billingHold: false, delinquent: false, cardOnFile: true,
    entryPricingSet: true, pricing: { isfCents: 4500, entryLinkedCents: null, entryOnlyCents: null },
  }),
}));

import { CAPABILITIES } from '../../config/plans.js';
import { loadDashboard } from '../../services/dashboard/load.js';
import router from '../dashboard.js';

const ORG = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  calls.length = 0;
  capabilities.length = 0;
  Object.keys(rows).forEach((k) => delete rows[k]);
});

describe('GET /dashboard data access', () => {
  it('scopes every query to the org', async () => {
    capabilities.push(CAPABILITIES.ISF_FILING, CAPABILITIES.ABI_ENTRY, CAPABILITIES.CONTAINER_TRACKING);
    rows.filing = [{ id: 'f1', status: 'submitted', pendingAction: 'ADD', lastTransmissionId: 't1', updatedAt: new Date(), filingType: 'ISF-10' }];
    await loadDashboard({ orgId: ORG, role: 'owner', now: new Date() });
    expect(calls.length).toBeGreaterThan(5);
    for (const c of calls) {
      const scoped = c.args.where?.orgId ?? (c.args.where?.filing as { orgId?: string } | undefined)?.orgId;
      expect(scoped, `${c.model}.${c.method}`).toBe(ORG);
    }
  });

  it('reads no entries or holds for an ISF-only plan', async () => {
    capabilities.push(CAPABILITIES.ISF_FILING);
    const r = await loadDashboard({ orgId: ORG, role: 'owner', now: new Date() });
    expect(calls.some((c) => c.model === 'abiDocument' || c.model === 'trackedShipment')).toBe(false);
    expect(r.flow.map((f) => f.key)).toEqual(['isf_to_send', 'isf_sent', 'accepted']);
  });

  it('gives month figures to owners and admins only', async () => {
    expect((await loadDashboard({ orgId: ORG, role: 'admin', now: new Date() })).month).not.toBeNull();
    expect((await loadDashboard({ orgId: ORG, role: 'operator', now: new Date() })).month).toBeNull();
    expect((await loadDashboard({ orgId: ORG, role: 'viewer', now: new Date() })).month).toBeNull();
  });

  it('never selects a JSON payload', async () => {
    capabilities.push(CAPABILITIES.ABI_ENTRY);
    await loadDashboard({ orgId: ORG, role: 'owner', now: new Date() });
    for (const c of calls.filter((x) => x.method === 'findMany')) {
      const select = (c.args as { select?: Record<string, unknown> }).select ?? {};
      for (const banned of ['payload', 'commodities', 'nativeWireText', 'manufacturer']) expect(select[banned]).toBeUndefined();
    }
  });
});

describe('GET /dashboard/actions input', () => {
  type Layer = { route?: { path: string; stack: { handle: (...a: unknown[]) => unknown }[] } };
  const handler = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === '/actions')!.route!.stack[0].handle;
  const call = async (query: Record<string, string>) => {
    const res = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string>,
      status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; },
      set(k: string, v: string) { this.headers[k] = v; return this; } };
    await handler({ query, user: { id: 'u1', orgId: ORG, role: 'operator' } }, res);
    return res;
  };

  it.each([
    [{ lane: 'urgent' }], [{ filter: 'everything' }], [{ limit: '500' }], [{ group: 'nope' }],
    [{ cursor: 'not-a-cursor' }], [{ importer: 'x'.repeat(256) }],
  ])('refuses %j', async (q) => {
    expect((await call(q as Record<string, string>)).statusCode).toBe(400);
  });

  it('is never cached by a proxy', async () => {
    expect((await call({})).headers['Cache-Control']).toBe('private, no-store');
  });
});
