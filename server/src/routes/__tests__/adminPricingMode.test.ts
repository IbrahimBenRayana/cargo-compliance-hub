/**
 * An invoiced org can't be switched back to card billing while it still has
 * accrued (unbilled) shipments: card mode never charges them and invoicing
 * refuses card orgs, so they would never be billed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    subscription: { findUnique: vi.fn(), update: vi.fn() },
    shipmentCharge: { count: vi.fn() },
  },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../services/auditLog.js', () => ({ writeAuditLog: vi.fn(), getRequestMeta: () => ({}) }));

import router from '../admin.js';

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] };
}
const route = (router as unknown as { stack: Layer[] }).stack.find(
  (l) => l.route?.path === '/organizations/:id/pricing' && l.route.methods.put,
)!.route!;
const handle = route.stack[route.stack.length - 1].handle;

async function put(body: object) {
  const res = { statusCode: 200, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  await handle({ params: { id: 'o1' }, body, user: { id: 'u1', isPlatformAdmin: true }, headers: {}, ip: '' }, res, vi.fn());
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.subscription.findUnique.mockResolvedValue({ id: 's1', orgId: 'o1', billingMode: 'invoiced', plan: null });
  prisma.subscription.update.mockResolvedValue({ billingMode: 'card', plan: null });
});

describe('PUT /admin/organizations/:id/pricing billing mode', () => {
  it('refuses invoiced → card while accrued shipments are unbilled', async () => {
    prisma.shipmentCharge.count.mockResolvedValue(3);
    const res = await put({ isfCents: null, entryLinkedCents: null, entryOnlyCents: null, billingMode: 'card' });
    expect(res.statusCode).toBe(409);
    expect(prisma.shipmentCharge.count).toHaveBeenCalledWith({ where: { orgId: 'o1', status: 'accrued' } });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('allows the switch once nothing is accrued', async () => {
    prisma.shipmentCharge.count.mockResolvedValue(0);
    const res = await put({ isfCents: null, entryLinkedCents: null, entryOnlyCents: null, billingMode: 'card' });
    expect(res.statusCode).toBe(200);
    expect(prisma.subscription.update).toHaveBeenCalled();
  });
});
