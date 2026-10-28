/**
 * Platform admin — sales-led client provisioning.
 *
 * MyCargoLens staff (User.isPlatformAdmin) onboard clients here after a demo:
 * create the client Organization + its owner User + a Subscription on the
 * chosen tier, then email the owner a set-password link. Self-service signup is
 * disabled (see routes/auth.ts), so this is the only way new client orgs are
 * created.
 *
 * Billing note: provisioned orgs get their plan's capabilities immediately. A
 * Stripe customer is NOT created here (the client has no card at provisioning);
 * the owner adds one in Settings → Billing before a paid filing can be sent.
 * Per-org prices (PUT /organizations/:id/pricing) live on the Subscription row,
 * so a negotiated price survives deploys (planSync only writes plan defaults).
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { emailField } from '../schemas/common.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requirePlatformAdmin } from '../middleware/auth.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import { issuePasswordSetupToken } from '../services/passwordSetup.js';
import { sendAccountSetupEmail } from '../services/email.js';
import { TIERS, tierById } from '../config/plans.js';
import { checkPriceInput, resolvePricing } from '../services/pricing.js';
import { statusAfterPlanChange } from '../services/billingAccount.js';
import { PILOT_DEFAULTS, parsePeriod } from '../services/invoiceRating.js';
import { previewMonth, createMonthlyInvoice, usageCsv, stripeDashboardUrl } from '../services/invoicing.js';
import logger from '../config/logger.js';
import { notifyLead } from '../services/leads.js';

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
      sellsEntries: t.capabilities.includes('ABI_ENTRY'),
    })),
  });
});

// GET /api/v1/admin/organizations — list all client orgs.
router.get('/organizations', async (_req: AuthRequest, res: Response): Promise<void> => {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: { include: { plan: true } },
      cbpConfig: true,
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
        // The org's own prices (null = default) and what they resolve to.
        pricing: o.subscription
          ? {
              isfCents: o.subscription.isfCents,
              entryLinkedCents: o.subscription.entryLinkedCents,
              entryOnlyCents: o.subscription.entryOnlyCents,
              effective: resolvePricing(o.subscription.plan?.perFilingCents, o.subscription),
            }
          : null,
        billing: o.subscription
          ? {
              mode: o.subscription.billingMode,
              monthlyMinimumCents: o.subscription.monthlyMinimumCents,
              includedIsfs: o.subscription.includedIsfs,
              billingStartsOn: o.subscription.billingStartsOn?.toISOString().slice(0, 10) ?? null,
              billingHold: o.subscription.billingHold,
              bankAccount: o.subscription.achLast4
                ? { bankName: o.subscription.achBankName, last4: o.subscription.achLast4 }
                : null,
            }
          : null,
        cardOnFile: !!o.subscription?.defaultPaymentMethodId,
        owner: owner
          ? { email: owner.email, firstName: owner.firstName, lastName: owner.lastName, emailVerified: owner.emailVerified }
          : null,
        userCount: o._count.users,
        filingCount: o._count.filings,
        cbp: o.cbpConfig
          ? {
              gateway: o.cbpConfig.gateway,
              filerCode: o.cbpConfig.filerCode,
              isfFilerModeDefault: o.cbpConfig.isfFilerModeDefault,
              serviceCenterApprovedAt: o.cbpConfig.serviceCenterApprovedAt,
              serviceCenterApprovedBy: o.cbpConfig.serviceCenterApprovedBy,
              notes: o.cbpConfig.notes,
            }
          : null,
      };
    }),
  });
});

// PUT /api/v1/admin/organizations/:id/cbp — set a client's CBP identity
// (native go-live Phase 2). Platform admins only: the filer code and the
// service-center approval are what make a client's filings legal to send.
const cbpConfigSchema = z.object({
  gateway: z.enum(['NATIVE', 'CC']).optional(),
  filerCode: z
    .string().trim().toUpperCase()
    .regex(/^[A-Z0-9]{3}$/, 'Filer code must be 3 letters/digits')
    .refine((v) => v !== 'S7P', 'S7P is Sigma\'s own filer code and cannot be assigned to a client')
    .nullable().optional(),
  isfFilerModeDefault: z.enum(['SIGMA', 'CLIENT']).optional(),
  /** ISO date the client's CBP client rep approved our queue; null clears it. */
  serviceCenterApprovedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  serviceCenterApprovedBy: z.string().trim().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).strict();

router.put('/organizations/:id/cbp', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = String(req.params.id);
  const parsed = cbpConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    return;
  }
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }
  const d = parsed.data;
  if (d.filerCode) {
    const taken = await prisma.orgCbpConfig.findFirst({ where: { filerCode: d.filerCode, orgId: { not: orgId } }, select: { orgId: true } });
    if (taken) {
      res.status(409).json({ error: `Filer code ${d.filerCode} is already assigned to another organization.` });
      return;
    }
  }
  const before = await prisma.orgCbpConfig.findUnique({ where: { orgId } });
  const data = {
    ...(d.gateway !== undefined && { gateway: d.gateway }),
    ...(d.filerCode !== undefined && { filerCode: d.filerCode }),
    ...(d.isfFilerModeDefault !== undefined && { isfFilerModeDefault: d.isfFilerModeDefault }),
    ...(d.serviceCenterApprovedAt !== undefined && {
      serviceCenterApprovedAt: d.serviceCenterApprovedAt ? new Date(d.serviceCenterApprovedAt) : null,
    }),
    ...(d.serviceCenterApprovedBy !== undefined && { serviceCenterApprovedBy: d.serviceCenterApprovedBy }),
    ...(d.notes !== undefined && { notes: d.notes }),
    updatedById: req.user!.id,
  };
  const config = await prisma.orgCbpConfig.upsert({
    where: { orgId },
    create: { orgId, ...data },
    update: data,
  });
  writeAuditLog({
    orgId,
    userId: req.user!.id,
    action: 'admin.org_cbp_config_set',
    entityType: 'organization',
    entityId: orgId,
    oldValue: before ?? undefined,
    newValue: config,
    ...getRequestMeta(req),
  });
  res.json({ cbp: config });
});

const provisionSchema = z.object({
  companyName: z.string().min(1).max(255),
  iorNumber: z.string().max(100).optional(),
  ownerEmail: emailField,
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
  // Keep a delinquency (billing audit G2): a plan change must not forgive an
  // unpaid charge or re-open filing. The hourly sweep keeps retrying it.
  const status = statusAfterPlanChange(existing);
  const sub = await prisma.subscription.upsert({
    where: { orgId },
    update: { planId: tier.id, status },
    create: { orgId, planId: tier.id, status },
  });

  writeAuditLog({
    orgId,
    userId: req.user!.id,
    action: 'admin.org_plan_changed',
    entityType: 'subscription',
    entityId: sub.id,
    oldValue: { planId: existing?.planId ?? null, status: existing?.status ?? null },
    newValue: { planId: tier.id, status },
    ...getRequestMeta(req),
  });

  res.json({ orgId, plan: { id: tier.id, name: tier.name }, status });
});

// PUT /api/v1/admin/organizations/:id/pricing — set a client's own prices
// (cents; null = the default) and, optionally, how it pays. Entries have no
// public price: an org can send entries only once both entry prices are set.
// A new price applies to shipments CBP accepts from now on; already-billed
// shipments keep theirs.
//   billingMode "invoiced" (pilots, contracts): no per-filing card charge;
//   accepted shipments accrue for a monthly Stripe invoice paid by ACH. When an
//   org is switched to invoiced, any term left null gets the founder-approved
//   pilot default: $250/month minimum including 50 ISFs, then $5 per ISF.
const centsField = z.number().int().min(0).nullable();
const pricingSchema = z.object({
  isfCents: centsField,
  entryLinkedCents: centsField,
  entryOnlyCents: centsField,
  billingMode: z.enum(['card', 'invoiced']).optional(),
  monthlyMinimumCents: centsField.optional(),
  includedIsfs: z.number().int().min(0).max(1_000_000).nullable().optional(),
  billingStartsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  billingHold: z.boolean().optional(),
}).strict();

router.put('/organizations/:id/pricing', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = String(req.params.id);
  const parsed = pricingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const problem = checkPriceInput(parsed.data);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const existing = await prisma.subscription.findUnique({ where: { orgId }, include: { plan: true } });
  if (!existing) {
    res.status(404).json({ error: 'This organization has no plan yet. Assign a plan first.' });
    return;
  }
  const { billingStartsOn, ...rest } = parsed.data;
  const data: Record<string, unknown> = {
    ...rest,
    ...(billingStartsOn !== undefined && { billingStartsOn: billingStartsOn ? new Date(`${billingStartsOn}T00:00:00Z`) : null }),
  };
  const mode = parsed.data.billingMode ?? existing.billingMode;
  if (mode === 'invoiced') {
    // Pilot defaults for anything the admin didn't set (pricing plan v2 §5.1).
    data.isfCents ??= PILOT_DEFAULTS.isfCents;
    if ((parsed.data.monthlyMinimumCents ?? existing.monthlyMinimumCents) == null) data.monthlyMinimumCents = PILOT_DEFAULTS.monthlyMinimumCents;
    if ((parsed.data.includedIsfs ?? existing.includedIsfs) == null) data.includedIsfs = PILOT_DEFAULTS.includedIsfs;
  }
  const updated = await prisma.subscription.update({
    where: { orgId },
    data,
    include: { plan: true },
  });
  writeAuditLog({
    orgId,
    userId: req.user!.id,
    action: 'admin.org_pricing_changed',
    entityType: 'subscription',
    entityId: existing.id,
    oldValue: {
      isfCents: existing.isfCents, entryLinkedCents: existing.entryLinkedCents, entryOnlyCents: existing.entryOnlyCents,
      billingMode: existing.billingMode, monthlyMinimumCents: existing.monthlyMinimumCents, includedIsfs: existing.includedIsfs,
      billingStartsOn: existing.billingStartsOn, billingHold: existing.billingHold,
    },
    newValue: data,
    ...getRequestMeta(req),
  });
  res.json({
    orgId,
    pricing: {
      isfCents: updated.isfCents, entryLinkedCents: updated.entryLinkedCents, entryOnlyCents: updated.entryOnlyCents,
      effective: resolvePricing(updated.plan?.perFilingCents, updated),
    },
    billing: {
      mode: updated.billingMode, monthlyMinimumCents: updated.monthlyMinimumCents, includedIsfs: updated.includedIsfs,
      billingStartsOn: updated.billingStartsOn?.toISOString().slice(0, 10) ?? null, billingHold: updated.billingHold,
    },
  });
});

// GET /api/v1/admin/organizations/:id/usage?period=YYYY-MM[&format=csv]
// The month's accepted shipments (UTC). JSON = what the usage invoice would
// bill now; CSV = every row, for the statement or rating by hand.
router.get('/organizations/:id/usage', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = String(req.params.id);
  const periodStart = parsePeriod(String(req.query.period ?? ''));
  if (!periodStart) {
    res.status(400).json({ error: 'period must be YYYY-MM' });
    return;
  }
  if (req.query.format === 'csv') {
    const csv = await usageCsv(orgId, periodStart);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="usage-${orgId.slice(0, 8)}-${String(req.query.period)}.csv"`);
    res.send(csv);
    return;
  }
  const preview = await previewMonth(orgId, periodStart);
  if (!preview) {
    res.status(404).json({ error: 'This organization has no plan.' });
    return;
  }
  const { rows, ...rest } = preview;
  res.json({ ...rest, accruedShipments: rows.length });
});

// GET /api/v1/admin/organizations/:id/invoices — the org's monthly invoices.
router.get('/organizations/:id/invoices', async (req: AuthRequest, res: Response): Promise<void> => {
  const invoices = await prisma.billingInvoice.findMany({
    where: { orgId: String(req.params.id) },
    orderBy: [{ periodStart: 'desc' }, { kind: 'asc' }],
  });
  res.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      period: i.periodStart.toISOString().slice(0, 7),
      kind: i.kind,
      status: i.status,
      totalCents: i.totalCents,
      lines: i.lines,
      lastError: i.lastError,
      dashboardUrl: i.stripeInvoiceId ? stripeDashboardUrl(i.stripeInvoiceId) : null,
      createdAt: i.createdAt,
    })),
  });
});

// POST /api/v1/admin/organizations/:id/invoices { period: 'YYYY-MM', kind }
// Draft a monthly Stripe invoice (finalize it in the Stripe dashboard).
const invoiceSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  kind: z.enum(['usage', 'prepay']).default('usage'),
}).strict();

router.post('/organizations/:id/invoices', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = String(req.params.id);
  const parsed = invoiceSchema.safeParse(req.body);
  const periodStart = parsed.success ? parsePeriod(parsed.data.period) : null;
  if (!parsed.success || !periodStart) {
    res.status(400).json({ error: 'period must be YYYY-MM' });
    return;
  }
  const outcome = await createMonthlyInvoice({ orgId, periodStart, kind: parsed.data.kind, createdById: req.user!.id });
  if (!outcome.ok) {
    res.status(outcome.httpStatus).json({ error: outcome.error });
    return;
  }
  writeAuditLog({
    orgId,
    userId: req.user!.id,
    action: 'admin.invoice_drafted',
    entityType: 'billing_invoice',
    entityId: outcome.invoice.id,
    newValue: { period: parsed.data.period, kind: parsed.data.kind, totalCents: outcome.invoice.totalCents },
    ...getRequestMeta(req),
  });
  res.status(201).json({ invoice: outcome.invoice });
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

// ─── Cross-org user tooling ────────────────────────────────
// Email addresses are globally unique across organizations, so a stray row in
// any org (an abandoned test account, a provisioned owner that never logged
// in) blocks that email from being invited anywhere else. These endpoints let
// platform staff see WHERE an email lives and clear it when it's safe to.

// Relations that represent real work product. All of them are Restrict at the
// DB level, so a hard delete physically cannot orphan filings — the guard here
// exists to return a friendly 409 instead of a raw FK error.
const USER_ACTIVITY_COUNTS = {
  filings: true,
  uploadedDocs: true,
  filingTemplates: true,
  manifestQueries: true,
  abiDocuments: true,
  apiKeys: true,
  trackedShipments: true,
} as const;

// GET /api/v1/admin/users?email= — find which org holds an email.
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  const email = String(req.query.email ?? '').trim();
  if (!email) {
    res.status(400).json({ error: 'email query parameter is required' });
    return;
  }
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: {
      organization: { select: { id: true, name: true } },
      _count: { select: USER_ACTIVITY_COUNTS },
    },
  });
  if (!user) {
    res.json({ user: null });
    return;
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isPlatformAdmin: user.isPlatformAdmin,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      organization: user.organization,
      activity: user._count,
    },
  });
});

// PATCH /api/v1/admin/users/:id — activate/deactivate in any org (fallback
// when a hard delete is blocked by filing activity).
router.patch('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = String(req.params.id);
  const body = z.object({ isActive: z.boolean() }).parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (target.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot deactivate your own account.' });
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: body.isActive, ...(body.isActive ? {} : { refreshToken: null }) },
  });
  await writeAuditLog({
    orgId: target.orgId, userId: req.user!.id,
    action: body.isActive ? 'admin.user_activated' : 'admin.user_deactivated',
    entityType: 'user', entityId: target.id,
    ...getRequestMeta(req),
  });
  res.json({ success: true, isActive: body.isActive });
});

// DELETE /api/v1/admin/users/:id — hard delete, only for rows with no work
// product. Frees the email for re-invitation elsewhere.
router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = String(req.params.id);
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: USER_ACTIVITY_COUNTS } },
  });
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (target.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own account.' });
    return;
  }
  if (target.isPlatformAdmin) {
    res.status(400).json({ error: 'Platform admin accounts cannot be deleted from here.' });
    return;
  }
  const blocking = Object.entries(target._count).filter(([, n]) => n > 0);
  if (blocking.length > 0) {
    res.status(409).json({
      error: `This user has work product (${blocking.map(([k, n]) => `${n} ${k}`).join(', ')}) and cannot be hard-deleted. Deactivate them instead.`,
      code: 'user_has_activity',
      activity: target._count,
    });
    return;
  }
  try {
    await prisma.$transaction(async (tx) => {
      // Invitations they sent are safe to drop; everything else either
      // cascades (tokens, MFA, notifications) or nulls out (audit trail).
      await tx.orgInvitation.deleteMany({ where: { invitedById: target.id } });
      await tx.user.delete({ where: { id: target.id } });
    });
  } catch (err) {
    // FK race (activity created between the check and the delete).
    logger.error({ err: (err as Error).message, userId }, '[Admin] User hard-delete blocked');
    res.status(409).json({
      error: 'This user acquired activity while the delete was running. Deactivate them instead.',
      code: 'user_has_activity',
    });
    return;
  }
  await writeAuditLog({
    orgId: target.orgId, userId: req.user!.id,
    action: 'admin.user_deleted', entityType: 'user', entityId: target.id,
    oldValue: { email: target.email, orgId: target.orgId, role: target.role },
    ...getRequestMeta(req),
  });
  logger.info({ email: target.email, orgId: target.orgId }, '[Admin] User hard-deleted, email released');
  res.json({ success: true, releasedEmail: target.email });
});

// ─── Marketing leads (services/leads.ts) ────────────────────────────────
// GET /api/v1/admin/leads?notification=failed&subject=demo&limit=50&before=<iso>
// Newest first; page with `before` = the last row's createdAt.
const leadListQuery = z.object({
  notification: z.enum(['pending', 'sent', 'failed']).optional(),
  subject: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.date().optional(),
});

router.get('/leads', async (req: AuthRequest, res: Response): Promise<void> => {
  const q = leadListQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'Invalid query', details: q.error.flatten() });
    return;
  }
  const { notification, subject, limit, before } = q.data;
  const where = {
    ...(notification ? { notificationStatus: notification } : {}),
    ...(subject ? { subject } : {}),
    ...(before ? { createdAt: { lt: before } } : {}),
  };
  const [leads, failedCount] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.lead.count({ where: { notificationStatus: 'failed' } }),
  ]);
  res.json({ leads, failedCount });
});

// POST /api/v1/admin/leads/:id/notify — resend the team notification now.
router.post('/leads/:id/notify', async (req: AuthRequest, res: Response): Promise<void> => {
  const lead = await prisma.lead.findUnique({ where: { id: String(req.params.id) } }).catch(() => null);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  const sent = await notifyLead(lead);
  res.json({ success: sent });
});

export default router;
