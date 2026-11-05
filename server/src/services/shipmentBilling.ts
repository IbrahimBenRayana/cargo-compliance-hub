/**
 * Shipment billing — charges each CBP-accepted shipment exactly once, under the
 * card-on-file model.
 *
 * Billing fires when CBP ACCEPTS (the verdict / polling paths), never on
 * transmission, so a rejected filing is never charged. One ShipmentCharge row
 * per acceptance, priced by WHAT WAS FILED (services/pricing.ts):
 *   - an accepted ISF            → kind 'isf', anchored on the Filing
 *   - an accepted entry on an ISF → kind 'entry_linked', anchored on the entry;
 *                                   only one entry per ISF (unique index), the
 *                                   rest bill as 'entry'          (P1 G3)
 *   - any other accepted entry    → kind 'entry'
 * The price is locked on the row at acceptance; the plan the org is on doesn't
 * change it (P1 G4).
 *
 * Charge integrity (P1 G1, G5):
 *   - A charge attempt is CLAIMED before Stripe is called: the row goes to
 *     'processing' in one atomic UPDATE, so two retry paths (card save + its
 *     webhook + the hourly sweep) can never charge the same row twice.
 *   - The Stripe idempotency key is stable per attempt (row id, then
 *     `<id>:attempt-N`). A Stripe outage leaves the row 'processing' with its
 *     error; the sweep re-runs it with the SAME key, so if Stripe did charge,
 *     it returns that charge instead of making a second one.
 *   - A decline / 3DS / removed card marks the row failed and the org
 *     delinquent; the next attempt (new card, or hourly for 30 days) uses a new
 *     key so Stripe actually retries.
 *
 * Invoiced orgs (pilots, contracts) are never charged here: each accepted
 * shipment is recorded 'accrued' at its locked price, and the monthly Stripe
 * invoice (services/invoicing.ts) bills them.
 *
 * Nothing here throws: by acceptance time the filing is done at CBP.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database.js';
import { getOrgEntitlements, type OrgEntitlements } from './entitlements.js';
import { chargeSavedCard, stripeConfigured } from './stripe.js';
import { priceFor, type ChargeKind } from './pricing.js';
import logger from '../config/logger.js';

/** Anchor: the accepted ISF Filing, or the accepted ABI Entry. */
export type ShipmentAnchor =
  | { filingId: string; abiDocumentId?: undefined }
  | { abiDocumentId: string; filingId?: undefined };

/** Charges are retried for this long, then left for a collections review. */
export const RETRY_WINDOW_DAYS = 30;
/** An attempt still 'processing' after this long is re-run with the same key. */
export const STALE_ATTEMPT_MINUTES = 15;
/** A 'processing' row older than this is alerted on (something is stuck). */
export const STUCK_ALERT_MINUTES = 60;

const RETRYABLE_FAILED = ['failed', 'requires_action'];

/** Stripe idempotency key for one charge attempt. Attempt 1 uses the bare row
 *  id — the key every pre-v2 charge used — so legacy rows stay safe to re-run. */
export function chargeIdempotencyKey(chargeId: string, attempt: number): string {
  return attempt <= 1 ? chargeId : `${chargeId}:attempt-${attempt}`;
}

export async function billShipmentForFiling(filingId: string, orgId: string): Promise<void> {
  return billShipment({ filingId }, orgId);
}

interface ChargeRow {
  id: string;
  orgId: string;
  kind: ChargeKind;
  filingId: string | null;
  abiDocumentId: string | null;
  amountCents: number;
  attempt: number;
}

type Initial = { status: 'processing' | 'skipped' | 'failed' | 'accrued'; attempt: number; lastError: string | null };

/** What a new charge row starts as. Pure, so the rules are easy to test. */
export function initialChargeState(
  amountCents: number | null,
  ent: Pick<OrgEntitlements, 'stripeCustomerId' | 'defaultPaymentMethodId'> & { billingMode?: OrgEntitlements['billingMode'] },
  stripeOn: boolean,
): Initial {
  if (amountCents == null) return { status: 'skipped', attempt: 0, lastError: 'Not priced for this org (no entry pricing)' };
  // Invoiced orgs: no per-filing charge; the row waits for the monthly invoice
  // (even at $0, so included ISFs are counted against the minimum).
  if (ent.billingMode === 'invoiced') return { status: 'accrued', attempt: 0, lastError: null };
  if (amountCents <= 0) return { status: 'skipped', attempt: 0, lastError: null };
  if (!stripeOn) return { status: 'skipped', attempt: 0, lastError: 'Stripe not configured' };
  if (!ent.stripeCustomerId || !ent.defaultPaymentMethodId) {
    // A card removed between submit and acceptance: owed, so retry once a card is back.
    return { status: 'failed', attempt: 0, lastError: 'No card on file' };
  }
  return { status: 'processing', attempt: 1, lastError: null };
}

export async function billShipment(anchor: ShipmentAnchor, orgId: string): Promise<void> {
  const anchorLog = anchor.filingId ? { filingId: anchor.filingId } : { abiDocumentId: anchor.abiDocumentId };
  try {
    const ent = await getOrgEntitlements(orgId);
    if (!ent.hasActiveTier || !ent.planId) {
      // Submission paths gate on a selected plan, so this is a defensive guard.
      logger.warn({ ...anchorLog, orgId }, '[Billing] No selected plan at bill time; charge skipped');
      return;
    }

    const row = anchor.filingId
      ? await insertCharge({ orgId, ent, kind: 'isf', filingId: anchor.filingId })
      : await insertEntryCharge(anchor.abiDocumentId!, orgId, ent);
    if (!row) return; // already billed (a repeat acceptance)

    if (row.status === 'accrued') {
      logger.info({ ...anchorLog, orgId, kind: row.kind, amountCents: row.amountCents }, '✓ Shipment accrued for the monthly invoice');
      return;
    }
    if (row.status === 'skipped') {
      if (row.lastError?.startsWith('Not priced')) {
        logger.error({ ...anchorLog, orgId, kind: row.kind }, '[Billing] Accepted entry has no price for this org; recorded unbilled');
      } else {
        logger.info({ ...anchorLog, orgId, kind: row.kind }, '✓ Shipment recorded (no charge)');
      }
      return;
    }
    if (row.status === 'failed') {
      await markDelinquent(orgId);
      logger.error({ ...anchorLog, orgId }, '[Billing] Shipment accepted with no card on file; org marked delinquent');
      return;
    }
    await attemptCharge(row, ent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, ...anchorLog, orgId }, '[Billing] Unexpected error while billing shipment');
  }
}

/** Entry: the linked price if this is the first entry on its ISF, else entry-only. */
async function insertEntryCharge(abiDocumentId: string, orgId: string, ent: OrgEntitlements) {
  const doc = await prisma.abiDocument.findUnique({ where: { id: abiDocumentId }, select: { filingId: true } });
  if (doc?.filingId) {
    const linked = await insertCharge({ orgId, ent, kind: 'entry_linked', abiDocumentId, linkedFilingId: doc.filingId });
    if (linked) return linked;
    // Either this entry was already billed, or another entry holds the ISF's one linked slot.
    const existing = await prisma.shipmentCharge.findUnique({ where: { abiDocumentId }, select: { id: true } });
    if (existing) return null;
  }
  return insertCharge({ orgId, ent, kind: 'entry', abiDocumentId });
}

async function insertCharge(opts: {
  orgId: string;
  ent: OrgEntitlements;
  kind: ChargeKind;
  filingId?: string;
  abiDocumentId?: string;
  linkedFilingId?: string;
}): Promise<(ChargeRow & { status: Initial['status']; lastError: string | null }) | null> {
  const { orgId, ent, kind } = opts;
  const amount = priceFor(kind, ent.pricing);
  const init = initialChargeState(amount, ent, stripeConfigured());
  const id = randomUUID();
  // ON CONFLICT DO NOTHING (no target) covers every unique index: the filing /
  // entry anchors AND the one-linked-entry-per-ISF partial index.
  const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "shipment_charges"
      ("id", "org_id", "filing_id", "abi_document_id", "linked_filing_id", "kind", "plan_id", "amount_cents",
       "stripe_customer_id", "status", "attempt_count", "last_attempt_at", "last_error", "billed_at", "created_at", "updated_at")
    VALUES
      (${id}::uuid, ${orgId}::uuid, ${opts.filingId ?? null}::uuid, ${opts.abiDocumentId ?? null}::uuid,
       ${opts.linkedFilingId ?? null}::uuid, ${kind}, ${ent.planId}, ${amount ?? 0},
       ${ent.stripeCustomerId}, ${init.status}, ${init.attempt}, ${init.attempt > 0 ? new Date() : null}, ${init.lastError},
       NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING "id"
  `;
  if (inserted.length === 0) return null;
  return {
    id, orgId, kind,
    filingId: opts.filingId ?? null,
    abiDocumentId: opts.abiDocumentId ?? null,
    amountCents: amount ?? 0,
    attempt: init.attempt,
    status: init.status,
    lastError: init.lastError,
  };
}

/** Run one claimed attempt against Stripe and record the outcome. */
async function attemptCharge(c: ChargeRow, ent: OrgEntitlements): Promise<'paid' | 'failed' | 'requires_action' | 'processing'> {
  const ref = c.filingId ? `ISF shipment ${c.filingId}` : `ABI entry ${c.abiDocumentId}`;
  let outcome;
  try {
    outcome = await chargeSavedCard({
      customerId: ent.stripeCustomerId!,
      paymentMethodId: ent.defaultPaymentMethodId!,
      amountCents: c.amountCents,
      idempotencyKey: chargeIdempotencyKey(c.id, c.attempt),
      description: c.attempt > 1 ? `${ref} (retry)` : ref,
      metadata: {
        orgId: c.orgId, chargeId: c.id, kind: c.kind, attempt: String(c.attempt),
        ...(c.filingId ? { filingId: c.filingId } : { abiDocumentId: c.abiDocumentId! }),
      },
    });
  } catch (err) {
    // Unknown outcome (Stripe outage / network): stay 'processing' — the sweep
    // re-runs this attempt with the same key. Not the customer's fault, so the
    // org is NOT made delinquent.
    const message = err instanceof Error ? err.message : String(err);
    await prisma.shipmentCharge.update({ where: { id: c.id }, data: { lastError: message.slice(0, 500) } });
    logger.error({ chargeId: c.id, orgId: c.orgId, err: message }, '[Billing] Stripe error; charge will be retried with the same key');
    return 'processing';
  }

  await prisma.shipmentCharge.update({
    where: { id: c.id },
    data: {
      status: outcome.status,
      ...(outcome.paymentIntentId && { stripePaymentIntentId: outcome.paymentIntentId }),
      lastError: outcome.error?.slice(0, 500) ?? null,
    },
  });
  if (outcome.status === 'paid') {
    logger.info({ chargeId: c.id, orgId: c.orgId, kind: c.kind, amountCents: c.amountCents }, '✓ Shipment charged');
  } else {
    // Decline, 3DS, or the card is gone: block further filing until fixed.
    await markDelinquent(c.orgId);
    logger.error({ chargeId: c.id, orgId: c.orgId, outcome: outcome.status, err: outcome.error }, '[Billing] Shipment charge not completed; org marked delinquent');
  }
  return outcome.status;
}

async function markDelinquent(orgId: string): Promise<void> {
  await prisma.subscription
    .update({ where: { orgId }, data: { status: 'delinquent' } })
    .catch(() => { /* best effort */ });
}

/**
 * Atomically claim an org's retryable charges. One UPDATE flips each row to
 * 'processing', so concurrent callers each get a disjoint set (Postgres re-checks
 * the WHERE after taking the row lock). Failed rows start a new attempt (new
 * key); stale 'processing' rows re-run their current attempt (same key).
 * `cardChanged` skips the hourly backoff for failed rows: a new card was saved.
 */
async function claimRetryableCharges(orgId: string, cardChanged: boolean): Promise<ChargeRow[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string; kind: ChargeKind; filing_id: string | null; abi_document_id: string | null;
    amount_cents: number; attempt_count: number;
  }>>`
    UPDATE "shipment_charges" SET
      "attempt_count" = CASE WHEN "status" = 'processing' THEN GREATEST("attempt_count", 1) ELSE "attempt_count" + 1 END,
      "status" = 'processing',
      "last_attempt_at" = NOW(),
      "updated_at" = NOW()
    WHERE "org_id" = ${orgId}::uuid
      AND "amount_cents" > 0
      AND "billed_at" > NOW() - make_interval(days => ${RETRY_WINDOW_DAYS}::int)
      AND (
        ("status" IN ('failed', 'requires_action')
          AND (${cardChanged} OR "last_attempt_at" IS NULL OR "last_attempt_at" < NOW() - INTERVAL '50 minutes'))
        OR ("status" = 'processing'
          AND ("last_attempt_at" IS NULL OR "last_attempt_at" < NOW() - make_interval(mins => ${STALE_ATTEMPT_MINUTES}::int)))
      )
    RETURNING "id", "kind", "filing_id", "abi_document_id", "amount_cents", "attempt_count"
  `;
  return rows.map((r) => ({
    id: r.id, orgId, kind: r.kind, filingId: r.filing_id, abiDocumentId: r.abi_document_id,
    amountCents: r.amount_cents, attempt: r.attempt_count,
  }));
}

/**
 * Re-attempt an org's unsettled charges: failed / requires_action ones, and
 * attempts stuck in 'processing' (a Stripe outage, or a crash mid-charge).
 * Called when the org saves a card (`cardChanged`) and by the hourly sweep.
 * Clears delinquency once nothing failed is left. Never throws.
 */
export async function retryOrgCharges(orgId: string, opts: { cardChanged?: boolean } = {}): Promise<{ retried: number; settled: number }> {
  try {
    const ent = await getOrgEntitlements(orgId);
    if (!ent.stripeCustomerId || !ent.defaultPaymentMethodId || !stripeConfigured()) {
      return { retried: 0, settled: 0 };
    }
    const claimed = await claimRetryableCharges(orgId, !!opts.cardChanged);
    let settled = 0;
    for (const c of claimed) {
      if ((await attemptCharge(c, ent)) === 'paid') settled++;
    }
    const remaining = await prisma.shipmentCharge.count({ where: { orgId, status: { in: RETRYABLE_FAILED } } });
    if (remaining === 0) {
      await prisma.subscription
        .updateMany({ where: { orgId, status: 'delinquent' }, data: { status: 'card_on_file' } })
        .catch(() => { /* best effort */ });
    }
    if (claimed.length > 0) {
      logger.info({ orgId, retried: claimed.length, settled }, '[Billing] Retried unsettled charges');
    }
    return { retried: claimed.length, settled };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, orgId }, '[Billing] retryOrgCharges error');
    return { retried: 0, settled: 0 };
  }
}

/**
 * The hourly CHARGE_RETRY sweep. Finds every org with something to retry —
 * whatever its subscription status, so neither an admin plan change nor a
 * Stripe outage can orphan a charge (P1 G1, G2) — and alerts on attempts that
 * have been stuck for over an hour.
 */
export async function sweepUnsettledCharges(): Promise<{ orgs: number; settled: number; stuck: number }> {
  const orgs = await prisma.$queryRaw<Array<{ org_id: string }>>`
    SELECT DISTINCT "org_id" FROM "shipment_charges"
    WHERE "amount_cents" > 0
      AND "billed_at" > NOW() - make_interval(days => ${RETRY_WINDOW_DAYS}::int)
      AND ("status" IN ('failed', 'requires_action')
        OR ("status" = 'processing'
          AND ("last_attempt_at" IS NULL OR "last_attempt_at" < NOW() - make_interval(mins => ${STALE_ATTEMPT_MINUTES}::int))))
  `;
  let settled = 0;
  for (const o of orgs) settled += (await retryOrgCharges(o.org_id)).settled;

  const stuck = await prisma.shipmentCharge.count({
    where: { status: 'processing', billedAt: { lt: new Date(Date.now() - STUCK_ALERT_MINUTES * 60_000) } },
  });
  if (stuck > 0) {
    logger.error({ stuck }, '[Billing] Charges unsettled for over an hour (still processing); check Stripe');
  }
  return { orgs: orgs.length, settled, stuck };
}
