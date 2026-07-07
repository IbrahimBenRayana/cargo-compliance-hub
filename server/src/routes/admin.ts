/**
 * Platform admin — sales-led client provisioning.
 *
 * MyCargoLens staff (User.isPlatformAdmin) onboard clients here after a demo:
 * create the client Organization + its owner User + a Subscription on the
 * chosen tier, then email the owner a set-password link. Self-service signup is
 * disabled (see routes/auth.ts), so this is the only way new client orgs are
 * created.
 *
 * Billing note: provisioned orgs get their tier's capabilities immediately. A
 * Stripe customer/subscription is NOT created here (the client has no card at
 * provisioning) — until one exists, per-shipment charges are recorded in
 * shipment_charges with status 'skipped' (see services/shipmentBilling.ts) for
 * manual/negotiated invoicing. Wire Stripe via the billing portal later.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requirePlatformAdmin } from '../middleware/auth.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import { issuePasswordSetupToken } from '../services/passwordSetup.js';
import { sendAccountSetupEmail } from '../services/email.js';
import { TIERS, tierById } from '../config/plans.js';
import logger from '../config/logger.js';

const router = Router();
router.use(authMiddleware);
router.use(requirePlatformAdmin);

// GET /api/v1/admin/plans — tiers available for provisioning (incl. enterprise).
router.get('/plans', (_req: AuthRequest, res: Response): void => {
  res.json({
    plans: TIERS.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      perFilingCents: t.perFilingCents,
      capabilities: t.capabilities,
      isPublic: t.isPublic,
    })),
  });
});

// GET /api/v1/admin/organizations — list all client orgs.
router.get('/organizations', async (_req: AuthRequest, res: Response): Promise<void> => {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: { include: { plan: true } },
      users: {
        where: { isActive: true },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, emailVerified: true },
      },
      _count: { select: { users: true, filings: true } },
    },
  });

  res.json({
    organizations: orgs.map((o) => {
      const owner = o.users.find((u) => u.role === 'owner') ?? o.users[0] ?? null;
      return {
        id: o.id,
        name: o.name,
        iorNumber: o.iorNumber,
        maxUsers: o.maxUsers,
        createdAt: o.createdAt,
        plan: o.subscription?.plan
          ? { id: o.subscription.plan.id, name: o.subscription.plan.name }
          : null,
        subscriptionStatus: o.subscription?.status ?? null,
        owner: owner
          ? { email: owner.email, firstName: owner.firstName, lastName: owner.lastName, emailVerified: owner.emailVerified }
          : null,
        userCount: o._count.users,
        filingCount: o._count.filings,
      };
    }),
  });
});

const provisionSchema = z.object({
  companyName: z.string().min(1).max(255),
  iorNumber: z.string().max(100).optional(),
  ownerEmail: z.string().email(),
  ownerFirstName: z.string().min(1).max(100),
  ownerLastName: z.string().min(1).max(100),
  planId: z.string().min(1),
  maxUsers: z.number().int().min(1).max(1000).optional(),
});

// POST /api/v1/admin/organizations — provision a new client org + owner + tier.
router.post('/organizations', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;

  const tier = tierById(data.planId);
  if (!tier) {
    res.status(400).json({ error: `Unknown plan "${data.planId}".` });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: data.ownerEmail } });
  if (existing) {
    res.status(409).json({ error: 'A user with that email already exists.' });
    return;
  }

  // Unusable random password — the owner sets a real one via the emailed link.
  const placeholderHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

  const { org, owner } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: data.companyName,
        iorNumber: data.iorNumber ?? null,
        ...(data.maxUsers ? { maxUsers: data.maxUsers } : {}),
      },
    });
    const owner = await tx.user.create({
      data: {
        orgId: org.id,
        email: data.ownerEmail,
        passwordHash: placeholderHash,
        firstName: data.ownerFirstName,
        lastName: data.ownerLastName,
        role: 'owner',
        emailVerified: false, // flipped true when they set their password
        // Provisioned client owners must enroll in MFA at first login.
        mfaEnforced: true,
      },
    });
    await tx.subscription.create({
      data: { orgId: org.id, planId: tier.id, status: 'active' },
    });
    return { org, owner };
  });

  // Issue + email the set-password link (fire-and-forget email).
  const { token, expiresInDays } = await issuePasswordSetupToken(owner.id);
  sendAccountSetupEmail({
    to: owner.email,
    firstName: owner.firstName,
    organizationName: org.name,
    planName: tier.name,
    setupToken: token,
    expiresInDays,
  }).catch((err) => logger.error({ err, orgId: org.id }, '[Admin] Failed to send account setup email'));

  writeAuditLog({
    orgId: org.id,
    userId: req.user!.id,
    action: 'admin.org_provisioned',
    entityType: 'organization',
    entityId: org.id,
    newValue: { companyName: org.name, planId: tier.id, ownerEmail: owner.email },
    ...getRequestMeta(req),
  });
  logger.info({ orgId: org.id, planId: tier.id, by: req.user!.email }, '✓ Client org provisioned');

  res.status(201).json({
    organization: { id: org.id, name: org.name, iorNumber: org.iorNumber },
    owner: { id: owner.id, email: owner.email },
    plan: { id: tier.id, name: tier.name },
  });
});

const changePlanSchema = z.object({ planId: z.string().min(1) });

// PATCH /api/v1/admin/organizations/:id/plan — change a client's tier.
router.patch('/organizations/:id/plan', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = String(req.params.id);
  const parsed = changePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const tier = tierById(parsed.data.planId);
  if (!tier) {
    res.status(400).json({ error: `Unknown plan "${parsed.data.planId}".` });
    return;
  }

  const existing = await prisma.subscription.findUnique({ where: { orgId } });
  const sub = await prisma.subscription.upsert({
    where: { orgId },
    update: { planId: tier.id, status: 'active' },
    create: { orgId, planId: tier.id, status: 'active' },
  });

  writeAuditLog({
    orgId,
    userId: req.user!.id,
    action: 'admin.org_plan_changed',
    entityType: 'subscription',
    entityId: sub.id,
    oldValue: { planId: existing?.planId ?? null },
    newValue: { planId: tier.id },
    ...getRequestMeta(req),
  });

  res.json({ orgId, plan: { id: tier.id, name: tier.name } });
});

// POST /api/v1/admin/organizations/:id/resend-setup — re-send the owner's link.
router.post('/organizations/:id/resend-setup', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = String(req.params.id);
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      users: { where: { role: 'owner', isActive: true }, take: 1 },
      subscription: { include: { plan: true } },
    },
  });
  const owner = org?.users[0];
  if (!org || !owner) {
    res.status(404).json({ error: 'Organization or owner not found.' });
    return;
  }

  const { token, expiresInDays } = await issuePasswordSetupToken(owner.id);
  await sendAccountSetupEmail({
    to: owner.email,
    firstName: owner.firstName,
    organizationName: org.name,
    planName: org.subscription?.plan?.name ?? 'your',
    setupToken: token,
    expiresInDays,
  });

  res.json({ success: true, sentTo: owner.email });
});

export default router;
