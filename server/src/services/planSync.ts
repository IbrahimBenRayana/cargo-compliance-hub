/**
 * Boot-time plan sync — the code's TIERS constant is the source of truth
 * for what each pricing tier unlocks; the DB `plans` table is what the
 * entitlements layer actually reads. Historically the table was seeded
 * once and drifted when TIERS changed (e.g. the IN_BOND capability landed
 * in code but not in existing rows, hiding the feature for everyone).
 *
 * This sync upserts the descriptive fields on every boot, idempotently.
 * Stripe identifiers are deliberately untouched — those are bootstrapped
 * against the live Stripe account through the billing flow.
 */
import { prisma } from '../config/database.js';
import { TIERS } from '../config/plans.js';
import logger from '../config/logger.js';

export async function syncPlansFromTiers(): Promise<void> {
  for (const tier of TIERS) {
    const data = {
      name: tier.name,
      description: tier.description,
      perFilingCents: tier.perFilingCents,
      capabilities: [...tier.capabilities],
      features: [...tier.features],
      isPublic: tier.isPublic,
      sortOrder: tier.sortOrder,
      isActive: true,
    };
    await prisma.plan.upsert({
      where: { id: tier.id },
      update: data,
      create: { id: tier.id, ...data },
    });
  }
  logger.info({ tiers: TIERS.map((t) => t.id) }, '[PlanSync] plans table synced from TIERS');
}
