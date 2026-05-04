import { Router, Response, raw } from 'express';
import { z } from 'zod';
import type { Request } from 'express';
import Stripe from 'stripe';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getStripe, stripeConfigured } from '../services/stripe.js';
import { notify } from '../services/notifications.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

const router = Router();

// ─── Webhook (MUST be defined BEFORE router.use(authMiddleware) and BEFORE any body-parsing) ─────
// This endpoint uses raw body for Stripe signature verification.
// The raw() middleware is applied at the route level here, but index.ts also mounts
// express.raw() at /api/v1/billing/webhook BEFORE express.json() to ensure the
// body is never parsed as JSON first.
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
      event = getStripe().webhooks.constructEvent(
        req.body as Buffer, // raw Buffer — NOT parsed JSON
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
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
      // Return 500 so Stripe retries. But don't leak details.
      res.status(500).json({ error: 'Internal error' });
    }
  }
);

// ─── Event handler (dispatch by type) ──────────────────────
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await onSubscriptionChanged(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      logger.debug({ type: event.type }, 'Unhandled Stripe event');
  }
}

// Helper: extract billing period dates from a Stripe Subscription.
// In Stripe SDK v22, current_period_start/end moved from Subscription to
// SubscriptionItem (items.data[0]). Fall back to null if items are empty.
function getSubPeriod(sub: Stripe.Subscription): {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} {
  const item = sub.items.data[0];
  if (!item) return { currentPeriodStart: null, currentPeriodEnd: null };
  return {
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
  };
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orgId = session.client_reference_id;
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;
  const planId = session.metadata?.planId;
  if (!orgId || !planId) {
    logger.warn({ sessionId: session.id }, 'Checkout session missing orgId or planId in metadata');
    return;
  }
  // Fetch the subscription to get current period details
  const stripeSub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
  const { currentPeriodStart, currentPeriodEnd } = getSubPeriod(stripeSub);

  await prisma.subscription.upsert({
    where: { orgId },
    update: {
      planId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: stripeSub.status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      canceledAt: null,
    },
    create: {
      orgId,
      planId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: stripeSub.status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    },
  });
  logger.info({ orgId, planId }, '✓ Subscription activated via checkout');

  // Phase 3: notify owners + admins that the subscription is live.
  await notify({
    kind:     'billing_subscription_changed',
    audience: { orgId, roles: ['ADMIN', 'OWNER'] },
    title:    'Subscription Activated',
    message:  `Your ${planId} plan is now active.`,
    linkUrl:  '/settings?tab=billing',
    metadata: { planId, status: stripeSub.status },
  });
}

async function onSubscriptionChanged(sub: Stripe.Subscription): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!existing) {
    logger.warn(
      { subscriptionId: sub.id },
      'Subscription updated but not found in DB; waiting for checkout.session.completed'
    );
    return;
  }
  // Determine the planId from the Stripe price — look up via stripePriceId
  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId
    ? await prisma.plan.findUnique({ where: { stripePriceId: priceId } })
    : null;

  const { currentPeriodStart, currentPeriodEnd } = getSubPeriod(sub);

  await prisma.subscription.update({
    where: { stripeSubscriptionId: sub.id },
    data: {
      planId: plan?.id ?? existing.planId,
      status: sub.status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
  });
}

async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  // Downgrade org to Starter (free) plan
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!existing) return;
  await prisma.subscription.update({
    where: { stripeSubscriptionId: sub.id },
    data: {
      planId: 'starter',
      status: 'canceled',
      canceledAt: new Date(),
      stripeSubscriptionId: null, // allow the org to resubscribe
    },
  });
  logger.info({ orgId: existing.orgId }, '✓ Subscription canceled, downgraded to Starter');

  // Phase 3: warn owners + admins. Severity is 'warning' (default for kind),
  // not 'critical' — the org has been downgraded but is not blocked.
  await notify({
    kind:     'billing_subscription_canceled',
    audience: { orgId: existing.orgId, roles: ['ADMIN', 'OWNER'] },
    title:    'Subscription Canceled',
    message:  'Your plan has been canceled. The org has been downgraded to Starter.',
    linkUrl:  '/settings?tab=billing',
    metadata: { previousPlanId: existing.planId },
  });
}

async function onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // In Stripe SDK v22, the subscription reference moved to invoice.parent.subscription_details.subscription
  const parentSub = invoice.parent?.subscription_details?.subscription;
  const subId: string | null =
    typeof parentSub === 'string' ? parentSub : (parentSub?.id ?? null);
  if (!subId) return;
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subId },
    data: { status: 'past_due' },
  });
  logger.warn({ subscriptionId: subId }, 'Payment failed — subscription marked past_due');

  // Phase 3: critical alert to admin + owner. Service may be suspended if
  // not resolved before grace period lapses, so this is the highest-urgency
  // billing notification we send.
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subId },
    select: { orgId: true },
  });
  if (sub) {
    // Dedupe per-invoice so retries within a single dunning cycle don't
    // spam users; a fresh payment_failed event for the same invoice is a
    // no-op.
    await notify({
      kind:      'billing_payment_failed',
      audience:  { orgId: sub.orgId, roles: ['ADMIN', 'OWNER'] },
      title:     'Payment Failed',
      message:   'A subscription invoice failed to charge. Update your payment method to keep service running.',
      linkUrl:   '/settings?tab=billing',
      metadata:  { invoiceId: invoice.id, subscriptionId: subId },
      dedupeKey: `billing_failed_${invoice.id}`,
    });
  }
}

// ─── Authenticated endpoints ─────────────────────────────────
router.use(authMiddleware);

// POST /api/v1/billing/checkout-session
// Body: { planId: string, successUrl?: string, cancelUrl?: string }
// Returns: { url: string, sessionId: string }
router.post('/checkout-session', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!stripeConfigured()) {
    res.status(503).json({ error: 'Billing not configured. Contact support.' });
    return;
  }
  const schema = z.object({
    planId: z.string().min(1),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const plan = await prisma.plan.findUnique({ where: { id: body.data.planId } });
  if (!plan) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  if (!plan.stripePriceId) {
    res
      .status(400)
      .json({ error: 'This plan is not purchasable via self-service. Contact sales.' });
    return;
  }

  const orgId = req.user!.orgId;
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  const baseUrl = env.FRONTEND_URL || 'https://mycargolens.com';

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    customer: sub?.stripeCustomerId || undefined,
    customer_email: sub?.stripeCustomerId ? undefined : req.user!.email,
    client_reference_id: orgId,
    metadata: { orgId, planId: plan.id },
    subscription_data: { metadata: { orgId, planId: plan.id } },
    success_url:
      body.data.successUrl ||
      `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: body.data.cancelUrl || `${baseUrl}/checkout/cancel`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    automatic_tax: { enabled: false }, // flip to true once you configure tax in Stripe Dashboard
  });

  res.json({ url: session.url, sessionId: session.id });
});

// GET /api/v1/billing/subscription
// Returns: { plan, subscription, usage }
router.get('/subscription', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user!.orgId;
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    include: { plan: true },
  });

  // If no subscription yet, the org is on the free Starter plan implicitly.
  // Return the Starter plan + zero usage so frontend always has a consistent shape.
  const plan = sub?.plan ?? (await prisma.plan.findUnique({ where: { id: 'starter' } }));

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const usage = await prisma.filingUsage.findUnique({
    where: { orgId_month: { orgId, month } },
  });

  res.json({
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          priceCents: plan.priceCents,
          billingInterval: plan.billingInterval,
          filingsIncluded: plan.filingsIncluded,
          maxSeats: plan.maxSeats,
          overageCents: plan.overageCents,
          features: plan.features,
        }
      : null,
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : null,
    usage: {
      month,
      count: usage?.count ?? 0,
      limit: plan?.filingsIncluded ?? 0,
    },
  });
});

// POST /api/v1/billing/portal-session
// Returns: { url: string }
router.post('/portal-session', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!stripeConfigured()) {
    res.status(503).json({ error: 'Billing not configured' });
    return;
  }
  const orgId = req.user!.orgId;
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub?.stripeCustomerId) {
    res.status(404).json({ error: 'No active subscription found' });
    return;
  }
  const baseUrl = env.FRONTEND_URL || 'https://mycargolens.com';
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${baseUrl}/app/settings/billing`,
  });
  res.json({ url: session.url });
});

export default router;
