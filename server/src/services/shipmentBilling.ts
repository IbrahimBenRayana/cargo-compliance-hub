/**
 * Shipment billing — charges a shipment exactly once under the per-filing
 * pricing model.
 *
 * The billable unit is the shipment, anchored on EITHER an ISF Filing or a
 * standalone ABI Entry. The first successful CBP submission — the ISF submit
 * (routes/filings.ts) or an ABI Entry send (routes/abiDocuments.ts) — creates a
 * ShipmentCharge and reports one metered event to Stripe at the org's current
 * tier rate. An Entry that is linked to an ISF bills against that filingId, so
 * it shares the ISF's charge (never double-billed). Idempotency is enforced two
 * ways: the unique anchor index makes a repeat submit/send a no-op, and the
 * meter event uses the charge id as its Stripe idempotency key.
 *
 * This NEVER throws. The customer's filing already succeeded at CBP before we
 * get here; a billing hiccup must not surface as a filing failure. Failed meter
 * events leave the charge row as 'failed' for a later retry sweep.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database.js';
import { getOrgEntitlements } from './entitlements.js';
import { recordFilingMeterEvent, stripeConfigured } from './stripe.js';
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
      // Submission paths gate on an active tier, so this is a defensive guard.
      logger.warn({ ...anchorLog, orgId }, '[Billing] No active tier at bill time; charge skipped');
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

    // Enterprise / custom orgs (or dev without Stripe) have no self-serve
    // customer: record the charge for reporting but skip the meter event.
    if (!ent.stripeCustomerId || !stripeConfigured()) {
      await prisma.shipmentCharge.update({ where: { id: chargeId }, data: { status: 'skipped' } });
      logger.info({ ...anchorLog, orgId, planId: ent.planId }, '✓ Shipment charge recorded (metering skipped)');
      return;
    }

    try {
      const meterEventId = await recordFilingMeterEvent({
        stripeCustomerId: ent.stripeCustomerId,
        identifier: chargeId, // Stripe-level idempotency key
      });
      await prisma.shipmentCharge.update({
        where: { id: chargeId },
        data: { status: 'reported', stripeMeterEventId: meterEventId },
      });
      logger.info(
        { ...anchorLog, orgId, planId: ent.planId, amountCents: ent.perFilingCents },
        '✓ Shipment billed (meter event reported)',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.shipmentCharge
        .update({ where: { id: chargeId }, data: { status: 'failed' } })
        .catch(() => { /* charge stays 'pending'; retry sweep will pick it up */ });
      logger.error({ err: message, ...anchorLog, orgId }, '[Billing] Meter event failed; charge left for retry');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, ...anchorLog, orgId }, '[Billing] Unexpected error while billing shipment');
  }
}
