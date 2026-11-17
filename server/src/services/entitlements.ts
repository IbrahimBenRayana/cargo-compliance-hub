/**
 * Entitlements — resolves what an organization is allowed to do under the
 * card-on-file, immediate per-shipment model. The single read used by both the
 * capability middleware (route gating / feature visibility) and the
 * filing-submit path (billing + gating).
 *
 * Selecting a tier grants its capabilities (so the user can see + explore the
 * features). Actually FILING — which charges the card on CBP acceptance —
 * additionally requires a usable card on file and no unpaid (delinquent)
 * charge, UNLESS nothing the org files costs money ($0 prices), which needs no
 * card. Prices come from services/pricing.ts (per org, by what was filed).
 */
import { prisma } from '../config/database.js';
import type { Capability } from '../config/plans.js';
import { resolvePricing, requiresPaymentMethod, entryPricingSet, type OrgPricing } from './pricing.js';

export interface OrgEntitlements {
  /** Selected tier id, or null when no tier is chosen. */
  planId: string | null;
  capabilities: Capability[];
  /** Price (cents) of one accepted ISF for this org; 0 when no plan. */
  perFilingCents: number;
  /** The org's prices by what was filed (ISF, linked entry, entry-only). */
  pricing: OrgPricing;
  /** Entries have no public price: an org can send entries only once priced. */
  entryPricingSet: boolean;
  /** "card" = charged per filing; "invoiced" = accrued for a monthly invoice. */
  billingMode: 'card' | 'invoiced';
  /** A manual submit hold set by MyCargoLens (e.g. an overdue invoice). */
  billingHold: boolean;
  stripeCustomerId: string | null;
  defaultPaymentMethodId: string | null;
  status: string | null;
  cardOnFile: boolean;
  delinquent: boolean;
  /** Has a selected tier that grants capabilities (feature/nav visibility). */
  hasActiveTier: boolean;
  /** May submit/file (and be charged): $0 tier, or card on file & not delinquent. */
  canFile: boolean;
}

export async function getOrgEntitlements(orgId: string): Promise<OrgEntitlements> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    include: { plan: true },
  });
  // A tier is "selected" (grants capabilities) when a row exists with a plan
  // and the account isn't canceled. 'active' is the legacy metered status,
  // treated the same as the new 'card_on_file'/'incomplete'/'delinquent'.
  const selected = !!sub && sub.status !== 'canceled' && !!sub.plan;
  const plan = selected ? sub!.plan : null;
  const pricing = resolvePricing(plan?.perFilingCents, selected ? sub : null);
  const cardOnFile = !!sub?.defaultPaymentMethodId;
  const delinquent = sub?.status === 'delinquent';
  const billingMode = sub?.billingMode === 'invoiced' ? 'invoiced' : 'card';
  const billingHold = !!sub?.billingHold;
  // Invoiced orgs need no card: usage is billed monthly (ACH). Card orgs need a
  // working card once anything they file costs money.
  const canFile = selected && !billingHold
    && (billingMode === 'invoiced' || !requiresPaymentMethod(pricing) || (cardOnFile && !delinquent));
  return {
    planId: plan?.id ?? null,
    capabilities: (plan?.capabilities ?? []) as Capability[],
    perFilingCents: pricing.isfCents,
    pricing,
    entryPricingSet: entryPricingSet(pricing),
    billingMode,
    billingHold,
    stripeCustomerId: sub?.stripeCustomerId ?? null,
    defaultPaymentMethodId: sub?.defaultPaymentMethodId ?? null,
    status: sub?.status ?? null,
    cardOnFile,
    delinquent,
    hasActiveTier: selected,
    canFile,
  };
}

export function entitlementsHaveCapability(ent: OrgEntitlements, cap: Capability): boolean {
  return ent.capabilities.includes(cap);
}
