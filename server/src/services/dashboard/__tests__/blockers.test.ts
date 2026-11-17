import { describe, it, expect } from 'vitest';
import type { OrgEntitlements } from '../../entitlements.js';
import { computeBlockers, computeSetup, type CbpConfigFacts } from '../blockers.js';

const pricing = { isfCents: 4500, entryLinkedCents: 1000, entryOnlyCents: 1000 };
function ent(over: Partial<OrgEntitlements> = {}): OrgEntitlements {
  return {
    planId: 'isf', capabilities: [], perFilingCents: 4500, pricing, entryPricingSet: true, billingMode: 'card', billingHold: false,
    stripeCustomerId: null, defaultPaymentMethodId: 'pm', status: 'card_on_file', cardOnFile: true, delinquent: false, hasActiveTier: true, canFile: true,
    ...over,
  } as OrgEntitlements;
}
const ready: CbpConfigFacts = { filerCode: 'ABC', isfFilerModeDefault: 'SIGMA', serviceCenterApprovedAt: new Date() };
const codes = (e: OrgEntitlements, cfg: CbpConfigFacts | null, o = { canFix: true, abi: true }) => computeBlockers(e, cfg, o).map((b) => b.code);

describe('computeBlockers', () => {
  it('is empty when the org can file', () => {
    expect(codes(ent(), ready)).toEqual([]);
  });
  it('reports no plan alone', () => {
    expect(codes(ent({ hasActiveTier: false }), null)).toEqual(['NO_PLAN']);
  });
  it('reports a failed payment on a card plan, with a fix only for those who can', () => {
    const b = computeBlockers(ent({ delinquent: true }), ready, { canFix: true, abi: false })[0];
    expect(b).toMatchObject({ code: 'PAYMENT_FAILED', fix: { label: 'Update payment' } });
    expect(computeBlockers(ent({ delinquent: true }), ready, { canFix: false, abi: false })[0].fix).toBeNull();
  });
  it('never asks an invoiced org for a card', () => {
    expect(codes(ent({ billingMode: 'invoiced', cardOnFile: false, delinquent: true }), ready)).toEqual([]);
  });
  it('reports a billing hold on an invoiced org', () => {
    expect(codes(ent({ billingMode: 'invoiced', billingHold: true }), ready)).toEqual(['BILLING_HOLD']);
  });
  it('reports missing entry pricing only to plans with entries', () => {
    expect(codes(ent({ entryPricingSet: false }), ready)).toEqual(['ENTRY_PRICING_MISSING']);
    expect(codes(ent({ entryPricingSet: false }), ready, { canFix: true, abi: false })).toEqual([]);
  });
  it('does not block S7P ISFs for a missing filer code', () => {
    const none = { filerCode: null, isfFilerModeDefault: 'SIGMA', serviceCenterApprovedAt: null };
    expect(codes(ent(), none, { canFix: true, abi: false })).toEqual([]);
    expect(computeBlockers(ent(), none, { canFix: true, abi: true })[0]).toMatchObject({ code: 'CBP_SETUP_INCOMPLETE', scope: 'entry' });
  });
  it('blocks everything when the org files ISFs under its own code', () => {
    const b = computeBlockers(ent(), { filerCode: 'ABC', isfFilerModeDefault: 'CLIENT', serviceCenterApprovedAt: null }, { canFix: true, abi: false })[0];
    expect(b).toMatchObject({ code: 'SERVICE_CENTER_NOT_APPROVED', scope: 'all' });
  });
});

describe('computeSetup', () => {
  it('offers payment only to someone who can add it, and never to an invoiced org', () => {
    const card = ent({ cardOnFile: false });
    expect(computeSetup(card, { canFix: true }).map((s) => s.key)).toEqual(['payment', 'first_isf']);
    expect(computeSetup(card, { canFix: false }).map((s) => s.key)).toEqual(['first_isf']);
    expect(computeSetup(ent({ billingMode: 'invoiced' }), { canFix: true }).map((s) => s.key)).toEqual(['first_isf']);
  });
});
