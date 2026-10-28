/** Who may file: card orgs need a working card; invoiced orgs don't; a hold blocks everyone. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({ prisma: { subscription: { findUnique: vi.fn() } } }));
vi.mock('../../config/database.js', () => ({ prisma }));

import { getOrgEntitlements } from '../entitlements.js';

const PLAN = { id: 'isf', perFilingCents: 4500, capabilities: ['ISF_FILING'] };
const SUB = {
  status: 'active', plan: PLAN, defaultPaymentMethodId: null, stripeCustomerId: null,
  isfCents: null, entryLinkedCents: null, entryOnlyCents: null, billingMode: 'card', billingHold: false,
};

beforeEach(() => vi.clearAllMocks());

describe('getOrgEntitlements', () => {
  it('card mode: no card → cannot file a paid ISF', async () => {
    prisma.subscription.findUnique.mockResolvedValue(SUB);
    const e = await getOrgEntitlements('o1');
    expect(e).toMatchObject({ canFile: false, billingMode: 'card', perFilingCents: 4500, entryPricingSet: false });
  });

  it('card mode: a card and no unpaid charge → can file', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, defaultPaymentMethodId: 'pm_1' });
    expect((await getOrgEntitlements('o1')).canFile).toBe(true);
  });

  it('card mode: delinquent → cannot file', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, defaultPaymentMethodId: 'pm_1', status: 'delinquent' });
    expect((await getOrgEntitlements('o1')).canFile).toBe(false);
  });

  it('invoiced: files without a card', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, billingMode: 'invoiced', isfCents: 500 });
    expect(await getOrgEntitlements('o1')).toMatchObject({ canFile: true, billingMode: 'invoiced', perFilingCents: 500 });
  });

  it('a billing hold blocks filing in either mode', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, billingMode: 'invoiced', billingHold: true });
    expect(await getOrgEntitlements('o1')).toMatchObject({ canFile: false, billingHold: true });
  });

  it('per-org prices win over the plan default', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...SUB, isfCents: 3000, entryLinkedCents: 1000, entryOnlyCents: 2000 });
    expect(await getOrgEntitlements('o1')).toMatchObject({ perFilingCents: 3000, entryPricingSet: true });
  });
});
