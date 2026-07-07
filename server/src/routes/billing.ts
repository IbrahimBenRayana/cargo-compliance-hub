import { Router, Response, raw } from 'express';
import { z } from 'zod';
import type { Request } from 'express';
import Stripe from 'stripe';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/requireVerifiedEmail.js';
import { requireMfaEnrolled } from '../middleware/requireMfaEnrolled.js';
import {
  getStripe,
  stripeConfigured,
  createStripeCustomer,
  createSetupIntent,
  setDefaultCard,
} from '../services/stripe.js';
import { getOrgEntitlements } from '../services/entitlements.js';
import { retryFailedCharges } from '../services/shipmentBilling.js';
import { notify } from '../services/notifications.js';
import { writeAuditLog } from '../services/auditLog.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

const router = Router();

// ════════════════════════════════════════════════════════════════════════
// Billing model: card-on-file + immediate per-shipment charge.
// The org keeps a Stripe Customer with a default payment method (saved via a
// SetupIntent — no charge). Each shipment CBP ACCEPTS is charged immediately
// (services/shipmentBilling.ts). There are NO Stripe subscriptions / invoices.
// ════════════════════════════════════════════════════════════════════════

// ─── Webhook (MUST be before authMiddleware and before any body-parsing) ───
// index.ts mounts express.raw() at this path before express.json(), and we also
// apply raw() here, so the body is a Buffer for Stripe signature verification.
router.post(
  '/webhook',
  raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    if (!stripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
      res.status(503).json({ error: 'Billing not configured' });
      return;
    }
    const signature = req.headers['stripe-signature'];
    if (!signature || Array.isArray(signature)) {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn({ err }, 'Stripe webhook signature verification failed');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    try {
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      logger.error({ err, eventType: event.type }, 'Stripe webhook handler error');
      res.status(500).json({ error: 'Internal error' }); // 500 → Stripe retries
    }
  },
);

// ─── Event dispatch with an idempotency ledger ─────────────────────────────
// Stripe delivers at-least-once. We INSERT event.id ON CONFLICT DO NOTHING; an
// empty result means we already processed it. processedAt is set only after the
// handler finishes (and nulled on failure) so a crashed handler can be retried.
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const inserted = await prisma.$queryRaw<Array<{ event_id: string }>>`
    INSERT INTO "stripe_webhook_events" ("event_id", "type", "received_at")
    VALUES (${event.id}, ${event.type}, NOW())
    ON CONFLICT ("event_id") DO NOTHING
    RETURNING "event_id"
  `;
  if (inserted.length === 0) {
    logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook: duplicate event, ignoring');
    return;
  }

  try {
    switch (event.type) {
      case 'setup_intent.succeeded':
        await onSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;
      case 'payment_intent.succeeded':
        await onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await onChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event');
    }
  } catch (err) {
    await prisma.stripeWebhookEvent
      .update({ where: { eventId: event.id }, data: { processedAt: null } })
      .catch(() => { /* primary error matters more */ });
    throw err;
  }

  await prisma.stripeWebhookEvent.update({
    where: { eventId: event.id },
    data: { processedAt: new Date() },
  });
}

/** Backup for POST /billing/card — a confirmed SetupIntent saved a card. */
async function onSetupIntentSucceeded(si: Stripe.SetupIntent): Promise<void> {
  const customerId = typeof si.customer === 'string' ? si.customer : si.customer?.id;
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
  if (!customerId || !pmId) return;
  const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
  if (!sub) return;
  if (sub.defaultPaymentMethodId === pmId) return; // already recorded by the direct endpoint
  const card = await setDefaultCard(customerId, pmId);
  await prisma.subscription.update({
    where: { orgId: sub.orgId },
    data: {
      defaultPaymentMethodId: card.paymentMethodId,
      cardBrand: card.brand,
      cardLast4: card.last4,
      cardExpMonth: card.expMonth,
      cardExpYear: card.expYear,
      status: 'card_on_file',
    },
  });
  await retryFailedCharges(sub.orgId);
  logger.info({ orgId: sub.orgId }, '✓ Card saved (via setup_intent webhook)');
}

/** Mark the matching ShipmentCharge paid (backup for the synchronous path). */
async function onPaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const chargeId = pi.metadata?.chargeId;
  const charge = chargeId
    ? await prisma.shipmentCharge.findUnique({ where: { id: chargeId } })
    : await prisma.shipmentCharge.findFirst({ where: { stripePaymentIntentId: pi.id } });
  if (!charge || charge.status === 'paid') return;
  await prisma.shipmentCharge.update({
    where: { id: charge.id },
    data: { status: 'paid', stripePaymentIntentId: pi.id },
  });
}

/** A charge failed — mark it, flag the org delinquent, and alert owners/admins. */
async function onPaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const chargeId = pi.metadata?.chargeId;
  const metaOrgId = pi.metadata?.orgId;
  const charge = chargeId
    ? await prisma.shipmentCharge.findUnique({ where: { id: chargeId } })
    : await prisma.shipmentCharge.findFirst({ where: { stripePaymentIntentId: pi.id } });
  if (charge && charge.status !== 'paid') {
    await prisma.shipmentCharge.update({
      where: { id: charge.id },
      data: { status: 'failed', stripePaymentIntentId: pi.id },
    });
  }
  const targetOrg = charge?.orgId ?? metaOrgId;
  if (!targetOrg) return;
  await prisma.subscription
    .updateMany({ where: { orgId: targetOrg }, data: { status: 'delinquent' } })
    .catch(() => {});
  await notify({
    kind: 'billing_payment_failed',
    audience: { orgId: targetOrg, roles: ['ADMIN', 'OWNER'] },
    title: 'Payment Failed',
    message: 'A per-shipment charge could not be completed. Update your card to keep filing.',
    linkUrl: '/settings?tab=billing',
    metadata: { paymentIntentId: pi.id },
    dedupeKey: `billing_failed_${pi.id}`,
  }).catch(() => {});
}

/** A charge was refunded in Stripe — reflect it on the ShipmentCharge. */
async function onChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  await prisma.shipmentCharge.updateMany({
    where: { stripePaymentIntentId: piId },
    data: { status: 'refunded' },
  });
}

// ─── Authenticated endpoints ───────────────────────────────────────────────
router.use(authMiddleware);

// GET /api/v1/billing/config → publishable key for Stripe Elements.
router.get('/config', (_req: AuthRequest, res: Response): void => {
  res.json({ publishableKey: env.STRIPE_PUBLISHABLE_KEY, configured: stripeConfigured() });
});

// POST /api/v1/billing/select-tier  { planId }
// Choose / change the plan tier. No charge, no card re-entry — the new rate
// applies to shipments accepted after the change. Self-serve tiers only.
router.post('/select-tier', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ planId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || !plan.isActive) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  if (!plan.isPublic) {
    res.status(400).json({ error: 'This plan is not self-serve. Contact sales.' });
    return;
  }
  const orgId = req.user!.orgId;
  const existing = await prisma.subscription.findUnique({ where: { orgId } });
  const hasCard = !!existing?.defaultPaymentMethodId;
  // Preserve a delinquency; otherwise card-on-file if a card exists, else incomplete.
  const status = existing?.status === 'delinquent' ? 'delinquent' : hasCard ? 'card_on_file' : 'incomplete';
  await prisma.subscription.upsert({
    where: { orgId },
    update: { planId: plan.id, status },
    create: { orgId, planId: plan.id, status: 'incomplete' },
  });
  writeAuditLog({
    orgId,
    userId: req.user!.id,
    action: 'billing.tier_selected',
    entityType: 'subscription',
    entityId: orgId,
    oldValue: existing ? { planId: existing.planId } : undefined,
    newValue: { planId: plan.id },
  });
  const ent = await getOrgEntitlements(orgId);
  res.json({ planId: plan.id, canFile: ent.canFile, cardOnFile: ent.cardOnFile });
});

// POST /api/v1/billing/setup-intent → { clientSecret }
// Starts saving a card. Requires a selected tier (so we have a billing row).
router.post('/setup-intent', requireVerifiedEmail, requireMfaEnrolled, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!stripeConfigured()) {
    res.status(503).json({ error: 'Billing not configured. Contact support.' });
    return;
  }
  const orgId = req.user!.orgId;
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub) {
    res.status(400).json({ error: 'Choose a plan before adding a card.', code: 'tier_required' });
    return;
  }
  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    customerId = await createStripeCustomer({ orgId, email: req.user!.email });
    await prisma.subscription.update({ where: { orgId }, data: { stripeCustomerId: customerId } });
  }
  const { clientSecret } = await createSetupIntent(customerId);
  res.json({ clientSecret });
});

// POST /api/v1/billing/card  { setupIntentId }
// Confirm a saved card: set it as the default payment method, store the display
// summary, and reattempt any unsettled charges (clearing delinquency on success).
router.post('/card', requireVerifiedEmail, requireMfaEnrolled, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!stripeConfigured()) {
    res.status(503).json({ error: 'Billing not configured' });
    return;
  }
  const parsed = z.object({ setupIntentId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const orgId = req.user!.orgId;
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub?.stripeCustomerId) {
    res.status(400).json({ error: 'No billing account — choose a plan first.' });
    return;
  }
  const si = await getStripe().setupIntents.retrieve(parsed.data.setupIntentId);
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
  const siCustomer = typeof si.customer === 'string' ? si.customer : si.customer?.id;
  if (si.status !== 'succeeded' || !pmId || siCustomer !== sub.stripeCustomerId) {
    res.status(400).json({ error: 'Card was not confirmed. Please try again.' });
    return;
  }
  const card = await setDefaultCard(sub.stripeCustomerId, pmId);
  await prisma.subscription.update({
    where: { orgId },
    data: {
      defaultPaymentMethodId: card.paymentMethodId,
      cardBrand: card.brand,
      cardLast4: card.last4,
      cardExpMonth: card.expMonth,
      cardExpYear: card.expYear,
      status: 'card_on_file',
    },
  });
  writeAuditLog({
    orgId,
    userId: req.user!.id,
    action: 'billing.card_saved',
    entityType: 'subscription',
    entityId: orgId,
    newValue: { brand: card.brand, last4: card.last4 },
  });
  // Now that a card is on file, settle anything that previously failed.
  await retryFailedCharges(orgId);
  const ent = await getOrgEntitlements(orgId);
  res.json({ card, canFile: ent.canFile });
});

// GET /api/v1/billing/subscription → { plan, capabilities, card, canFile, usage }
router.get('/subscription', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user!.orgId;
  const sub = await prisma.subscription.findUnique({ where: { orgId }, include: { plan: true } });
  const ent = await getOrgEntitlements(orgId);
  const plan = ent.hasActiveTier ? sub?.plan ?? null : null;

  // Usage = shipments charged this calendar month + the running total.
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const agg = await prisma.shipmentCharge.aggregate({
    where: { orgId, status: 'paid', billedAt: { gte: periodStart, lt: periodEnd } },
    _count: { _all: true },
    _sum: { amountCents: true },
  });

  res.json({
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          perFilingCents: plan.perFilingCents,
          capabilities: plan.capabilities,
          features: plan.features,
        }
      : null,
    capabilities: ent.capabilities,
    canFile: ent.canFile,
    status: ent.status,
    delinquent: ent.delinquent,
    card: ent.cardOnFile
      ? { brand: sub?.cardBrand, last4: sub?.cardLast4, expMonth: sub?.cardExpMonth, expYear: sub?.cardExpYear }
      : null,
    usage: {
      periodStart,
      periodEnd,
      filingsBilled: agg._count._all,
      amountCents: agg._sum.amountCents ?? 0,
    },
  });
});

// POST /api/v1/billing/portal-session → { url }  (manage card / receipts in Stripe)
router.post('/portal-session', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!stripeConfigured()) {
    res.status(503).json({ error: 'Billing not configured' });
    return;
  }
  const orgId = req.user!.orgId;
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub?.stripeCustomerId) {
    res.status(404).json({ error: 'No billing account found' });
    return;
  }
  const baseUrl = env.FRONTEND_URL || 'https://mycargolens.com';
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${baseUrl}/settings?tab=billing`,
  });
  res.json({ url: session.url });
});

export default router;
