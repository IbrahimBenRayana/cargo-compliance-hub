/**
 * Entitlements — resolves what an organization is allowed to do under the
 * per-filing pricing model. The single read used by both the capability
 * middleware (route gating) and the filing-submit path (billing + gating).
 *
 * A tier only confers capabilities while the subscription is in a usable
 * state. A canceled / incomplete subscription — or no subscription at all —
 * yields zero capabilities, so the org must (re)subscribe before it can file
 * or reach a gated feature.
 */
import { prisma } from '../config/database.js';
import type { Capability } from '../config/plans.js';

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

export interface OrgEntitlements {
  /** Active tier id, or null when there is no usable subscription. */
  planId: string | null;
  capabilities: Capability[];
  /** Per-shipment rate (cents) of the active tier; 0 when none. */
  perFilingCents: number;
  stripeCustomerId: string | null;
  status: string | null;
  hasActiveTier: boolean;
}

export async function getOrgEntitlements(orgId: string): Promise<OrgEntitlements> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    include: { plan: true },
  });
  const hasActiveTier = !!sub && ACTIVE_STATUSES.includes(sub.status);
  const plan = hasActiveTier ? sub!.plan : null;
  return {
    planId: plan?.id ?? null,
    capabilities: (plan?.capabilities ?? []) as Capability[],
    perFilingCents: plan?.perFilingCents ?? 0,
    stripeCustomerId: sub?.stripeCustomerId ?? null,
    status: sub?.status ?? null,
    hasActiveTier,
  };
}

export function entitlementsHaveCapability(ent: OrgEntitlements, cap: Capability): boolean {
  return ent.capabilities.includes(cap);
}
