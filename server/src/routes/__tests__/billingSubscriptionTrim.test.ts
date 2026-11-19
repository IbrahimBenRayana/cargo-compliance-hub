/**
 * GET /billing/subscription feeds the capability gate for every role, so it
 * stays open, but card, price and invoice detail is for owners and admins.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, entitlements, invoicing } = vi.hoisted(() => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    shipmentCharge: { aggregate: vi.fn() },
  },
  entitlements: { getOrgEntitlements: vi.fn() },
  invoicing: { previewMonth: vi.fn(), syncInvoiceStatus: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../services/entitlements.js', () => entitlements);
vi.mock('../../services/invoicing.js', () => invoicing);

import router from '../billing.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const subscription = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === '/subscription')!.route!.stack.at(-1)!.handle;

const ENT = {
  hasActiveTier: true, perFilingCents: 4500, capabilities: ['isf.file'], canFile: true, status: 'active', delinquent: false,
  cardOnFile: true, billingMode: 'card', billingHold: false, pricing: { isfCents: 4500, entryLinkedCents: 10500, entryOnlyCents: 12500 },
};
const SUB = {
  cardBrand: 'visa', cardLast4: '4242', cardExpMonth: 12, cardExpYear: 2030, achBankName: 'BANK', achLast4: '6789',
  plan: { id: 'isf', name: 'ISF Filing', description: 'd', isPublic: true, capabilities: ['isf.file'], features: ['f'] },
};
const PREVIEW = { terms: { minimumCents: 25000, includedIsfs: 50 }, isfCount: 12, rows: [{}], totalCents: 25000, lines: [{ code: 'minimum', amountCents: 25000 }] };

async function getAs(role: string) {
  const res = { status() { return this; }, json: vi.fn() };
  await subscription({ user: { id: 'u1', orgId: 'o1', role } }, res, vi.fn());
  return res.json.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.subscription.findUnique.mockResolvedValue(SUB);
  prisma.shipmentCharge.aggregate.mockResolvedValue({ _count: { _all: 3 }, _sum: { amountCents: 13500 } });
  entitlements.getOrgEntitlements.mockResolvedValue(ENT);
  invoicing.previewMonth.mockResolvedValue(PREVIEW);
});

describe('GET /billing/subscription', () => {
  it.each(['owner', 'admin'])('gives the %s the full detail', async (role) => {
    const body = await getAs(role);
    expect(body.card).toEqual({ brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 });
    expect(body.cardOnFile).toBe(true);
    expect(body.pricing).toEqual(ENT.pricing);
    expect(body.plan.perFilingCents).toBe(4500);
    expect(body.usage.amountCents).toBe(13500);
  });

  it.each(['operator', 'viewer'])('gives the %s no card, prices or amounts', async (role) => {
    const body = await getAs(role);
    expect(body.card).toBeNull();
    expect(body.pricing).toBeNull();
    expect(body.plan.perFilingCents).toBeNull();
    expect(body.usage.amountCents).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/4242|4500|13500/);
  });

  it.each(['operator', 'viewer'])('still gives the %s everything useCapabilities and the filing gates read', async (role) => {
    const body = await getAs(role);
    expect(body).toMatchObject({ capabilities: ['isf.file'], canFile: true, cardOnFile: true, delinquent: false, status: 'active', billingMode: 'card', billingHold: false });
    expect(body.plan).toMatchObject({ id: 'isf', name: 'ISF Filing', isPublic: true });
    expect(body.usage.filingsBilled).toBe(3);
  });

  it('hides invoice lines and the bank account from an operator on an invoiced account', async () => {
    entitlements.getOrgEntitlements.mockResolvedValue({ ...ENT, billingMode: 'invoiced' });
    const body = await getAs('operator');
    expect(body.invoicing).toBeNull();
    expect(invoicing.previewMonth).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toMatch(/6789|25000/);
  });

  it('keeps invoice lines for an owner on an invoiced account', async () => {
    entitlements.getOrgEntitlements.mockResolvedValue({ ...ENT, billingMode: 'invoiced' });
    const body = await getAs('owner');
    expect(body.invoicing.monthToDate.lines).toEqual(PREVIEW.lines);
  });
});
