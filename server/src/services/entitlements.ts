/**
 * Entitlements — resolves what an organization is allowed to do under the
 * card-on-file, immediate per-shipment model. The single read used by both the
 * capability middleware (route gating / feature visibility) and the
 * filing-submit path (billing + gating).
 *
 * Selecting a tier grants its capabilities (so the user can see + explore the
 * features). Actually FILING — which charges the card on CBP acceptance —
 * additionally requires a usable card on file and no unpaid (delinquent)
 * charge, UNLESS the tier is $0 (enterprise/custom), which needs no card.
 */
import { prisma } from '../config/database.js';
import type { Capability } from '../config/plans.js';

export interface OrgEntitlements {
  /** Selected tier id, or null when no tier is chosen. */
  planId: string | null;
  capabilities: Capability[];
  /** Per-shipment rate (cents) of the selected tier; 0 when none / enterprise. */
  perFilingCents: number;
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
  const perFilingCents = plan?.perFilingCents ?? 0;
  const cardOnFile = !!sub?.defaultPaymentMethodId;
  const delinquent = sub?.status === 'delinquent';
  const canFile = selected && (perFilingCents === 0 || (cardOnFile && !delinquent));
  return {
    planId: plan?.id ?? null,
    capabilities: (plan?.capabilities ?? []) as Capability[],
    perFilingCents,
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
