/**
 * Webhook endpoint management (JWT-authed, owner/admin) for the public API.
 *
 * Customers register callback URLs that MyCargoLens POSTs to on filing/entry
 * status changes (see services/webhooks.ts for delivery + signing). The signing
 * secret (whsec_…) is returned in full only on create / rotate and masked
 * everywhere else.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { WEBHOOK_EVENTS, generateWebhookSecret } from '../services/webhooks.js';
import { assertPublicWebhookUrl, SsrfError } from '../services/ssrfGuard.js';

const router = Router();
router.use(authMiddleware);

// Non-secret projection (never exposes `secret`).
const PUBLIC_FIELDS = {
  id: true, url: true, secretPrefix: true, events: true, active: true,
  description: true, lastStatus: true, lastError: true, lastDeliveryAt: true,
  createdAt: true, updatedAt: true,
} as const;

const createSchema = z.object({
  url: z.string().url().max(2048),
  // Empty array = subscribe to all events.
  events: z.array(z.enum(WEBHOOK_EVENTS)).default([]),
  description: z.string().max(200).optional(),
});

const updateSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).optional(),
  active: z.boolean().optional(),
  description: z.string().max(200).nullish(),
});

// GET /api/v1/webhooks — list this org's endpoints (secret masked).
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { orgId: req.user!.orgId },
    orderBy: { createdAt: 'desc' },
    select: PUBLIC_FIELDS,
  });
  res.json({ webhooks: endpoints, availableEvents: WEBHOOK_EVENTS });
});

// POST /api/v1/webhooks — create an endpoint (owner/admin). Returns the secret once.
router.post('/', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    await assertPublicWebhookUrl(parsed.data.url);
  } catch (err) {
    if (err instanceof SsrfError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  const { secret, prefix } = generateWebhookSecret();
  const created = await prisma.webhookEndpoint.create({
    data: {
      orgId: req.user!.orgId,
      url: parsed.data.url,
      events: parsed.data.events,
      description: parsed.data.description ?? null,
      secret,
      secretPrefix: prefix,
      createdById: req.user!.id,
    },
    select: PUBLIC_FIELDS,
  });
  // The signing secret is shown exactly once.
  res.status(201).json({ ...created, secret });
});

// PATCH /api/v1/webhooks/:id — update url/events/active/description (owner/admin).
router.patch('/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (parsed.data.url !== undefined) {
    try {
      await assertPublicWebhookUrl(parsed.data.url);
    } catch (err) {
      if (err instanceof SsrfError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }
  const id = String(req.params.id);
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, orgId: req.user!.orgId } });
  if (!existing) {
    res.status(404).json({ error: 'Webhook endpoint not found.' });
    return;
  }
  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(parsed.data.url !== undefined ? { url: parsed.data.url } : {}),
      ...(parsed.data.events !== undefined ? { events: parsed.data.events } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    },
    select: PUBLIC_FIELDS,
  });
  res.json(updated);
});

// POST /api/v1/webhooks/:id/rotate — regenerate the signing secret (owner/admin).
router.post('/:id/rotate', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, orgId: req.user!.orgId } });
  if (!existing) {
    res.status(404).json({ error: 'Webhook endpoint not found.' });
    return;
  }
  const { secret, prefix } = generateWebhookSecret();
  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data: { secret, secretPrefix: prefix },
    select: PUBLIC_FIELDS,
  });
  res.json({ ...updated, secret });
});

// DELETE /api/v1/webhooks/:id — remove an endpoint (owner/admin).
router.delete('/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, orgId: req.user!.orgId } });
  if (!existing) {
    res.status(404).json({ error: 'Webhook endpoint not found.' });
    return;
  }
  await prisma.webhookEndpoint.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
