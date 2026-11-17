/**
 * Why this org cannot file right now, and what to do about it. Email and MFA
 * are absent on purpose: ProtectedRoute redirects before this page ever loads.
 */
import type { OrgEntitlements } from '../entitlements.js';
import { requiresPaymentMethod } from '../pricing.js';
import type { Blocker, SetupStep } from './types.js';

export interface CbpConfigFacts {
  filerCode: string | null;
  isfFilerModeDefault: string;
  serviceCenterApprovedAt: Date | null;
}

const BILLING = '/settings?tab=billing';

export function computeBlockers(ent: OrgEntitlements, cfg: CbpConfigFacts | null, opts: { canFix: boolean; abi: boolean }): Blocker[] {
  const { canFix, abi } = opts;
  const askAdmin = 'An owner or admin can fix this.';
  const out: Blocker[] = [];

  if (!ent.hasActiveTier) {
    out.push({ code: 'NO_PLAN', scope: 'all', title: 'No plan selected', detail: canFix ? 'Choose a plan to start filing.' : askAdmin, fix: canFix ? { label: 'Choose a plan', href: '/upgrade' } : null });
    return out;
  }
  if (ent.billingHold) {
    out.push({ code: 'BILLING_HOLD', scope: 'all', title: 'Filing is on hold', detail: 'Your account has an overdue invoice. Contact us to keep filing.', fix: null });
  }
  if (ent.billingMode === 'card') {
    if (ent.delinquent) {
      out.push({ code: 'PAYMENT_FAILED', scope: 'all', title: 'Filing is paused. Your last payment failed.', detail: canFix ? 'Update your payment method to send filings again.' : askAdmin, fix: canFix ? { label: 'Update payment', href: BILLING } : null });
    } else if (requiresPaymentMethod(ent.pricing) && !ent.cardOnFile) {
      out.push({ code: 'NO_PAYMENT_METHOD', scope: 'all', title: 'Add a payment method to file', detail: canFix ? 'Filings cannot be sent until one is saved.' : askAdmin, fix: canFix ? { label: 'Add payment method', href: BILLING } : null });
    }
  }
  if (abi && !ent.entryPricingSet) {
    out.push({ code: 'ENTRY_PRICING_MISSING', scope: 'entry', title: 'Entry pricing is not set up yet', detail: 'Contact us to start filing entries.', fix: null });
  }

  // ISFs in S7P mode go out without the client's own filer code, so a gap here
  // stops entries only. See services/cbp/filerIdentity.ts.
  const scope = cfg?.isfFilerModeDefault === 'CLIENT' ? 'all' : 'entry';
  if (scope === 'all' || abi) {
    if (!cfg?.filerCode) {
      out.push({ code: 'CBP_SETUP_INCOMPLETE', scope, title: 'Your CBP filer code is not set up yet', detail: 'Contact us to complete your CBP setup.', fix: null });
    } else if (!cfg.serviceCenterApprovedAt) {
      out.push({ code: 'SERVICE_CENTER_NOT_APPROVED', scope, title: `CBP has not yet approved us for filer code ${cfg.filerCode}`, detail: 'Your CBP client representative needs to add our service center.', fix: null });
    }
  }
  return out;
}

export function computeSetup(ent: OrgEntitlements, opts: { canFix: boolean }): SetupStep[] {
  const steps: SetupStep[] = [];
  if (opts.canFix && ent.billingMode === 'card' && requiresPaymentMethod(ent.pricing)) {
    steps.push({ key: 'payment', label: 'Add a payment method', done: ent.cardOnFile, href: BILLING });
  }
  steps.push({ key: 'first_isf', label: 'File your first ISF', done: false, href: '/shipments/new' });
  return steps;
}
