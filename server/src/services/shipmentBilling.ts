/**
 * Shipment billing — charges a shipment exactly once, immediately, under the
 * card-on-file model.
 *
 * The billable unit is the shipment, anchored on EITHER an ISF Filing or a
 * standalone ABI Entry. Billing fires when CBP ACCEPTS the shipment (the
 * polling subsystem) — not on transmission — so a rejected filing is never
 * charged. We create a ShipmentCharge and immediately charge the org's saved
 * card (off-session PaymentIntent) at its tier rate. An Entry linked to an ISF
 * bills against that filingId, so a linked ISF+Entry is billed once. Idempotency
 * is enforced two ways: the unique anchor index makes a repeat accept a no-op,
 * and the PaymentIntent uses the charge id as its Stripe idempotency key.
 *
 * This NEVER throws — by acceptance time the filing is already done at CBP. A
 * failed charge marks the org `delinquent` (blocking further filing until the
 * card is fixed) and leaves the charge for the retry sweep.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database.js';
import { getOrgEntitlements } from './entitlements.js';
import { chargeSavedCard, stripeConfigured } from './stripe.js';
import logger from '../config/logger.js';

/** Anchor the charge on the ISF Filing when one exists, else the ABI Entry. */
export type ShipmentAnchor =
  | { filingId: string; abiDocumentId?: undefined }
  | { abiDocumentId: string; filingId?: undefined };

export async function billShipmentForFiling(filingId: string, orgId: string): Promise<void> {
  return billShipment({ filingId }, orgId);
}

export async function billShipment(anchor: ShipmentAnchor, orgId: string): Promise<void> {
  const anchorLog = anchor.filingId
    ? { filingId: anchor.filingId }
    : { abiDocumentId: anchor.abiDocumentId };
  try {
    const ent = await getOrgEntitlements(orgId);
    if (!ent.hasActiveTier || !ent.planId) {
      // Submission paths gate on a selected tier, so this is a defensive guard.
      logger.warn({ ...anchorLog, orgId }, '[Billing] No selected tier at bill time; charge skipped');
      return;
    }

    // Idempotent insert — the unique anchor index makes a repeat submit/send a
    // no-op. Branch on which anchor is set so ON CONFLICT targets the right one.
    const chargeId = randomUUID();
    const inserted = anchor.filingId
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          INSERT INTO "shipment_charges"
            ("id", "org_id", "filing_id", "plan_id", "amount_cents", "stripe_customer_id", "status", "billed_at", "created_at", "updated_at")
          VALUES
            (${chargeId}::uuid, ${orgId}::uuid, ${anchor.filingId}::uuid, ${ent.planId}, ${ent.perFilingCents}, ${ent.stripeCustomerId}, 'pending', NOW(), NOW(), NOW())
          ON CONFLICT ("filing_id") DO NOTHING
          RETURNING "id"
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          INSERT INTO "shipment_charges"
            ("id", "org_id", "abi_document_id", "plan_id", "amount_cents", "stripe_customer_id", "status", "billed_at", "created_at", "updated_at")
          VALUES
            (${chargeId}::uuid, ${orgId}::uuid, ${anchor.abiDocumentId}::uuid, ${ent.planId}, ${ent.perFilingCents}, ${ent.stripeCustomerId}, 'pending', NOW(), NOW(), NOW())
          ON CONFLICT ("abi_document_id") DO NOTHING
          RETURNING "id"
        `;
    if (inserted.length === 0) {
      // This shipment was already billed (e.g. ISF then linked Entry, or a
      // re-submit) — nothing more to do.
      return;
    }

    // $0 tiers (enterprise/custom), or orgs without a card / Stripe, are not
    // charged — record the row for reporting and move on.
    if (ent.perFilingCents <= 0 || !ent.stripeCustomerId || !ent.defaultPaymentMethodId || !stripeConfigured()) {
      await prisma.shipmentCharge.update({ where: { id: chargeId }, data: { status: 'skipped' } });
      logger.info({ ...anchorLog, orgId, planId: ent.planId }, '✓ Shipment charge recorded (no charge — $0 tier / no card)');
      return;
    }

    // Charge the saved card immediately. chargeId is the idempotency key, so a
    // retry of the same accepted shipment never double-charges.
    const outcome = await chargeSavedCard({
      customerId: ent.stripeCustomerId,
      paymentMethodId: ent.defaultPaymentMethodId,
      amountCents: ent.perFilingCents,
      idempotencyKey: chargeId,
      description: anchor.filingId ? `ISF shipment ${anchor.filingId}` : `ABI entry ${anchor.abiDocumentId}`,
      metadata: anchor.filingId
        ? { orgId, planId: ent.planId, chargeId, filingId: anchor.filingId }
        : { orgId, planId: ent.planId, chargeId, abiDocumentId: anchor.abiDocumentId! },
    });

    await prisma.shipmentCharge.update({
      where: { id: chargeId },
      data: { status: outcome.status, stripePaymentIntentId: outcome.paymentIntentId },
    });

    if (outcome.status === 'paid') {
      logger.info(
        { ...anchorLog, orgId, planId: ent.planId, amountCents: ent.perFilingCents },
        '✓ Shipment charged',
      );
    } else {
      // Decline or 3DS-required: flag the org delinquent so further filing is
      // blocked until the card is fixed; the retry sweep re-attempts the charge.
      await prisma.subscription
        .update({ where: { orgId }, data: { status: 'delinquent' } })
        .catch(() => { /* best effort */ });
      logger.error(
        { ...anchorLog, orgId, outcome: outcome.status, err: outcome.error },
        '[Billing] Shipment charge not completed; org marked delinquent',
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, ...anchorLog, orgId }, '[Billing] Unexpected error while billing shipment');
  }
}

/**
 * Re-attempt an org's unsettled charges (status failed / requires_action).
 * Called when the org adds or updates a card, and by the nightly sweep. Uses a
 * FRESH idempotency key per attempt so Stripe actually retries (reusing the
 * original would just replay the old failure). Only retries non-paid charges,
 * so a settled shipment is never re-charged. Clears delinquency when nothing
 * is left unsettled. Never throws.
 */
export async function retryFailedCharges(orgId: string): Promise<{ retried: number; settled: number }> {
  try {
    const ent = await getOrgEntitlements(orgId);
    if (!ent.stripeCustomerId || !ent.defaultPaymentMethodId || !stripeConfigured()) {
      return { retried: 0, settled: 0 };
    }
    const failed = await prisma.shipmentCharge.findMany({
      where: { orgId, status: { in: ['failed', 'requires_action'] } },
    });
    let settled = 0;
    for (const c of failed) {
      const outcome = await chargeSavedCard({
        customerId: ent.stripeCustomerId,
        paymentMethodId: ent.defaultPaymentMethodId,
        amountCents: c.amountCents,
        idempotencyKey: randomUUID(), // fresh key → Stripe retries the charge
        description: c.filingId ? `ISF shipment ${c.filingId} (retry)` : `ABI entry ${c.abiDocumentId} (retry)`,
        metadata: { orgId, planId: c.planId, chargeId: c.id },
      }).catch(() => ({ status: 'failed' as const, paymentIntentId: null }));
      await prisma.shipmentCharge.update({
        where: { id: c.id },
        data: { status: outcome.status, stripePaymentIntentId: outcome.paymentIntentId ?? c.stripePaymentIntentId },
      });
      if (outcome.status === 'paid') settled++;
    }
    // Clear delinquency once nothing is left unsettled.
    const remaining = await prisma.shipmentCharge.count({
      where: { orgId, status: { in: ['failed', 'requires_action'] } },
    });
    if (remaining === 0) {
      await prisma.subscription
        .updateMany({ where: { orgId, status: 'delinquent' }, data: { status: 'card_on_file' } })
        .catch(() => { /* best effort */ });
    }
    if (failed.length > 0) {
      logger.info({ orgId, retried: failed.length, settled }, '[Billing] Retried unsettled charges');
    }
    return { retried: failed.length, settled };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, orgId }, '[Billing] retryFailedCharges error');
    return { retried: 0, settled: 0 };
  }
}
