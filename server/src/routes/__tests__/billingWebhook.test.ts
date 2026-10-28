/**
 * Stripe payment webhooks only settle the charge attempt they belong to: a late
 * event for an older attempt must not undo a later success, mark a refunded
 * charge paid, or leave the org delinquent with nothing left to retry.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, notifications } = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    stripeWebhookEvent: { update: vi.fn() },
    shipmentCharge: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    subscription: { updateMany: vi.fn(), findFirst: vi.fn() },
  },
  notifications: { notify: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../services/notifications.js', () => notifications);
vi.mock('../../services/shipmentBilling.js', () => ({ retryOrgCharges: vi.fn() }));

import { handleStripeEvent } from '../billing.js';

const event = (type: string, object: object) => ({ id: `evt_${Math.random()}`, type, data: { object } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$queryRaw.mockResolvedValue([{ event_id: 'e' }]);
  prisma.stripeWebhookEvent.update.mockResolvedValue({});
  prisma.subscription.updateMany.mockResolvedValue({ count: 1 });
});

describe('payment_intent.payment_failed', () => {
  it('fails the current attempt and marks the org delinquent', async () => {
    prisma.shipmentCharge.findUnique.mockResolvedValue({ id: 'c1', orgId: 'o1', status: 'processing', stripePaymentIntentId: null });
    await handleStripeEvent(event('payment_intent.payment_failed', { id: 'pi_2', metadata: { chargeId: 'c1' } }));
    expect(prisma.shipmentCharge.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed', stripePaymentIntentId: 'pi_2' }) }));
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({ where: { orgId: 'o1' }, data: { status: 'delinquent' } });
    expect(notifications.notify).toHaveBeenCalledOnce();
  });

  it('ignores a failure of an older attempt once a newer one is on the row', async () => {
    prisma.shipmentCharge.findUnique.mockResolvedValue({ id: 'c1', orgId: 'o1', status: 'failed', stripePaymentIntentId: 'pi_3' });
    await handleStripeEvent(event('payment_intent.payment_failed', { id: 'pi_2', metadata: { chargeId: 'c1' } }));
    expect(prisma.shipmentCharge.update).not.toHaveBeenCalled();
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('ignores a failure for a charge that is already paid', async () => {
    prisma.shipmentCharge.findUnique.mockResolvedValue({ id: 'c1', orgId: 'o1', status: 'paid', stripePaymentIntentId: 'pi_9' });
    await handleStripeEvent(event('payment_intent.payment_failed', { id: 'pi_2', metadata: { chargeId: 'c1', orgId: 'o1' } }));
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('does not flag an org for a payment intent that matches no charge', async () => {
    prisma.shipmentCharge.findFirst.mockResolvedValue(null);
    await handleStripeEvent(event('payment_intent.payment_failed', { id: 'pi_x', metadata: { orgId: 'o1' } }));
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });
});

describe('payment_intent.succeeded', () => {
  it('settles an attempt left processing by a Stripe outage', async () => {
    prisma.shipmentCharge.findUnique.mockResolvedValue({ id: 'c1', status: 'processing' });
    await handleStripeEvent(event('payment_intent.succeeded', { id: 'pi_1', metadata: { chargeId: 'c1' } }));
    expect(prisma.shipmentCharge.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'paid', stripePaymentIntentId: 'pi_1', lastError: null } });
  });

  it('never turns a refunded charge back into paid', async () => {
    prisma.shipmentCharge.findUnique.mockResolvedValue({ id: 'c1', status: 'refunded' });
    await handleStripeEvent(event('payment_intent.succeeded', { id: 'pi_1', metadata: { chargeId: 'c1' } }));
    expect(prisma.shipmentCharge.update).not.toHaveBeenCalled();
  });
});
