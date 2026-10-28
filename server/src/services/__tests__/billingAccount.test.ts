/** Billing audit G2: an admin plan change must not wipe a delinquency. */
import { describe, it, expect } from 'vitest';
import { statusAfterPlanChange } from '../billingAccount.js';

describe('statusAfterPlanChange', () => {
  it('keeps a delinquency (unpaid charges stay owed and filing stays blocked)', () => {
    expect(statusAfterPlanChange({ status: 'delinquent', defaultPaymentMethodId: 'pm_1' })).toBe('delinquent');
  });
  it('an org with a card is card_on_file', () => {
    expect(statusAfterPlanChange({ status: 'incomplete', defaultPaymentMethodId: 'pm_1' })).toBe('card_on_file');
  });
  it('a new or card-less org is active (as provisioning sets it)', () => {
    expect(statusAfterPlanChange(null)).toBe('active');
    expect(statusAfterPlanChange({ status: 'canceled', defaultPaymentMethodId: null })).toBe('active');
  });
});
