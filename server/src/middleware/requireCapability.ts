/**
 * requireCapability — gates a route behind a pricing-tier capability.
 *
 * This is the REAL authorization boundary for tier-gated features (the
 * frontend hiding nav items is only cosmetic). Apply it after authMiddleware
 * to ABI Entry, container tracking, and HTS classification routes.
 *
 * Rejection shapes (mirroring the app's other middleware so the client's
 * error handling lights up):
 *   402 subscription_required  — org has no active tier at all
 *   403 feature_not_in_plan    — org has a tier, but not this capability
 * Both carry `upgradeUrl` so the client can route the user to billing.
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import type { Capability } from '../config/plans.js';
import { getOrgEntitlements } from '../services/entitlements.js';

const BILLING_URL = '/settings?tab=billing';

export function requireCapability(capability: Capability) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const ent = await getOrgEntitlements(orgId);

    if (!ent.hasActiveTier) {
      res.status(402).json({
        error: 'Choose a plan to use this feature.',
        code: 'subscription_required',
        requiredCapability: capability,
        upgradeUrl: BILLING_URL,
      });
      return;
    }

    if (!ent.capabilities.includes(capability)) {
      res.status(403).json({
        error: "This feature isn't included in your current plan.",
        code: 'feature_not_in_plan',
        requiredCapability: capability,
        currentPlanId: ent.planId,
        upgradeUrl: BILLING_URL,
      });
      return;
    }

    next();
  };
}
