/**
 * Shipment billing v2 — the charge-integrity fixes from the billing audit:
 *   G1 a Stripe outage leaves the charge retryable (same key), not orphaned
 *   G3 only one entry per ISF gets the linked price
 *   G4 the price follows what was filed, not the plan
 *   G5 retries are claimed before charging, with a stable key per attempt
 * Prisma and Stripe are mocked; the SQL itself is exercised against a real
 * Postgres in the migration smoke test (see the PR).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, stripe, entitlements } = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    abiDocument: { findUnique: vi.fn() },
    shipmentCharge: { update: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    subscription: { update: vi.fn(), updateMany: vi.fn() },
  },
  stripe: { chargeSavedCard: vi.fn(), stripeConfigured: vi.fn(() => true) },
  entitlements: { getOrgEntitlements: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../stripe.js', () => stripe);
vi.mock('../entitlements.js', () => entitlements);
vi.mock('../../config/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  billShipment, retryOrgCharges, sweepUnsettledCharges, chargeIdempotencyKey, initialChargeState,
} from '../shipmentBilling.js';

const PRICING = { isfCents: 4500, entryLinkedCents: 10500, entryOnlyCents: 12500 };
const ENT = {
  planId: 'entry', hasActiveTier: true, pricing: PRICING, perFilingCents: 4500,
  stripeCustomerId: 'cus_1', defaultPaymentMethodId: 'pm_1',
};

/** The SQL text + bound values of the n-th $queryRaw call. */
function rawCall(n: number) {
  const [strings, ...values] = prisma.$queryRaw.mock.calls[n] as [TemplateStringsArray, ...unknown[]];
  return { sql: strings.join('?'), values };
}
/** Values of an INSERT, by column name. */
function insertedRow(n: number) {
  const { sql, values } = rawCall(n);
  const cols = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((c) => c.trim().replace(/"/g, ''));
  return Object.fromEntries(cols.slice(0, values.length).map((c, i) => [c, values[i]]));
}

beforeEach(() => {
  vi.clearAllMocks();
  stripe.stripeConfigured.mockReturnValue(true);
  entitlements.getOrgEntitlements.mockResolvedValue(ENT);
  prisma.$queryRaw.mockResolvedValue([{ id: 'new' }]);
  prisma.shipmentCharge.update.mockResolvedValue({});
  prisma.subscription.update.mockResolvedValue({});
  prisma.subscription.updateMany.mockResolvedValue({ count: 0 });
  stripe.chargeSavedCard.mockResolvedValue({ status: 'paid', paymentIntentId: 'pi_1' });
});

describe('pricing by what was filed (G4)', () => {
  it('an accepted ISF bills the ISF price, whatever the plan', async () => {
    await billShipment({ filingId: 'f1' }, 'o1');
    expect(insertedRow(0)).toMatchObject({ filing_id: 'f1', kind: 'isf', amount_cents: 4500, status: 'processing' });
    expect(stripe.chargeSavedCard).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 4500 }));
  });

  it('the first entry on an ISF bills the linked price', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue({ filingId: 'f1' });
    await billShipment({ abiDocumentId: 'd1' }, 'o1');
    expect(insertedRow(0)).toMatchObject({ abi_document_id: 'd1', linked_filing_id: 'f1', kind: 'entry_linked', amount_cents: 10500 });
    expect(stripe.chargeSavedCard).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 10500 }));
  });

  it('a standalone entry bills the entry-only price', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue({ filingId: null });
    await billShipment({ abiDocumentId: 'd2' }, 'o1');
    expect(insertedRow(0)).toMatchObject({ abi_document_id: 'd2', kind: 'entry', amount_cents: 12500 });
  });
});

describe('one linked entry per ISF (G3)', () => {
  it('a second entry on the same ISF bills entry-only', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue({ filingId: 'f1' });
    prisma.$queryRaw
      .mockResolvedValueOnce([]) // the ISF's linked slot is taken
      .mockResolvedValueOnce([{ id: 'new' }]);
    prisma.shipmentCharge.findUnique.mockResolvedValue(null); // this entry isn't billed yet
    await billShipment({ abiDocumentId: 'd2' }, 'o1');
    expect(insertedRow(1)).toMatchObject({ abi_document_id: 'd2', kind: 'entry', amount_cents: 12500, linked_filing_id: null });
    expect(stripe.chargeSavedCard).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 12500 }));
  });

  it('a repeat acceptance of the same entry is a no-op', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue({ filingId: 'f1' });
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.shipmentCharge.findUnique.mockResolvedValue({ id: 'existing' });
    await billShipment({ abiDocumentId: 'd1' }, 'o1');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(stripe.chargeSavedCard).not.toHaveBeenCalled();
  });

  it('the insert relies on every unique index (anchor + linked slot)', async () => {
    await billShipment({ filingId: 'f1' }, 'o1');
    expect(rawCall(0).sql).toMatch(/ON CONFLICT DO NOTHING/);
  });
});

describe('charge outcomes', () => {
  it('first attempt uses the row id as the Stripe idempotency key', async () => {
    await billShipment({ filingId: 'f1' }, 'o1');
    const id = insertedRow(0).id;
    expect(stripe.chargeSavedCard.mock.calls[0][0].idempotencyKey).toBe(id);
    expect(prisma.shipmentCharge.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'paid' }) }));
  });

  it('a decline marks the org delinquent', async () => {
    stripe.chargeSavedCard.mockResolvedValue({ status: 'failed', paymentIntentId: 'pi_x', error: 'declined' });
    await billShipment({ filingId: 'f1' }, 'o1');
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { orgId: 'o1' }, data: { status: 'delinquent' } });
  });

  it('a Stripe outage keeps the row processing (retryable, same key) and does NOT block the org (G1)', async () => {
    stripe.chargeSavedCard.mockRejectedValue(new Error('Stripe API unavailable'));
    await billShipment({ filingId: 'f1' }, 'o1');
    const updates = prisma.shipmentCharge.update.mock.calls.map((c) => c[0].data);
    expect(updates).toEqual([{ lastError: 'Stripe API unavailable' }]);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('accepted with no card on file: recorded as failed and the org delinquent (retried once a card is added)', async () => {
    entitlements.getOrgEntitlements.mockResolvedValue({ ...ENT, defaultPaymentMethodId: null });
    await billShipment({ filingId: 'f1' }, 'o1');
    expect(insertedRow(0)).toMatchObject({ status: 'failed', attempt_count: 0 });
    expect(stripe.chargeSavedCard).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { orgId: 'o1' }, data: { status: 'delinquent' } });
  });

  it('a $0 price is recorded without a charge', async () => {
    entitlements.getOrgEntitlements.mockResolvedValue({ ...ENT, pricing: { ...PRICING, isfCents: 0 } });
    await billShipment({ filingId: 'f1' }, 'o1');
    expect(insertedRow(0)).toMatchObject({ status: 'skipped', amount_cents: 0 });
    expect(stripe.chargeSavedCard).not.toHaveBeenCalled();
  });
});

describe('initialChargeState', () => {
  const card = { stripeCustomerId: 'c', defaultPaymentMethodId: 'p' };
  it('an unpriced entry is recorded with a reason, never charged', () => {
    expect(initialChargeState(null, card, true)).toMatchObject({ status: 'skipped', lastError: expect.stringMatching(/Not priced/) });
  });
  it('without Stripe (dev) nothing is charged', () => {
    expect(initialChargeState(4500, card, false).status).toBe('skipped');
  });
});

describe('retries (G5)', () => {
  it('keys: attempt 1 = row id (the pre-v2 key), later attempts are distinct and stable', () => {
    expect(chargeIdempotencyKey('c1', 1)).toBe('c1');
    expect(chargeIdempotencyKey('c1', 0)).toBe('c1');
    expect(chargeIdempotencyKey('c1', 3)).toBe('c1:attempt-3');
  });

  it('claims rows atomically before charging, and charges each with its attempt key', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'c1', kind: 'isf', filing_id: 'f1', abi_document_id: null, amount_cents: 4500, attempt_count: 2 },
    ]);
    prisma.shipmentCharge.count.mockResolvedValue(0);
    const r = await retryOrgCharges('o1', { cardChanged: true });
    expect(rawCall(0).sql).toMatch(/UPDATE "shipment_charges" SET[\s\S]*"status" = 'processing'[\s\S]*RETURNING/);
    expect(rawCall(0).values).toContain(true); // cardChanged skips the backoff
    expect(stripe.chargeSavedCard).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'c1:attempt-2', amountCents: 4500 }));
    expect(r).toEqual({ retried: 1, settled: 1 });
    // Nothing failed is left: delinquency clears.
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({ where: { orgId: 'o1', status: 'delinquent' }, data: { status: 'card_on_file' } });
  });

  it('a concurrent caller that claims nothing charges nothing', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.shipmentCharge.count.mockResolvedValue(1);
    const r = await retryOrgCharges('o1', { cardChanged: true });
    expect(stripe.chargeSavedCard).not.toHaveBeenCalled();
    expect(r).toEqual({ retried: 0, settled: 0 });
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('a stale processing attempt is re-run with the SAME attempt number (claim keeps attempt_count)', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.shipmentCharge.count.mockResolvedValue(0);
    await retryOrgCharges('o1');
    expect(rawCall(0).sql).toMatch(/CASE WHEN "status" = 'processing' THEN GREATEST\("attempt_count", 1\) ELSE "attempt_count" \+ 1 END/);
  });

  it('no card → nothing to retry with', async () => {
    entitlements.getOrgEntitlements.mockResolvedValue({ ...ENT, defaultPaymentMethodId: null });
    expect(await retryOrgCharges('o1')).toEqual({ retried: 0, settled: 0 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('sweepUnsettledCharges (G1, G2)', () => {
  it('retries every org with unsettled charges, whatever its subscription status', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ org_id: 'o1' }, { org_id: 'o2' }]) // orgs to sweep
      .mockResolvedValue([]); // nothing claimable in each
    prisma.shipmentCharge.count.mockResolvedValue(0);
    const r = await sweepUnsettledCharges();
    expect(rawCall(0).sql).not.toMatch(/subscriptions|delinquent/);
    expect(r).toMatchObject({ orgs: 2, stuck: 0 });
    expect(entitlements.getOrgEntitlements).toHaveBeenCalledWith('o1');
    expect(entitlements.getOrgEntitlements).toHaveBeenCalledWith('o2');
  });
});
