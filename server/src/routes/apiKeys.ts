/**
 * API key management (JWT-authed, owner/admin) for the public API.
 *
 * Issues, lists, and revokes the customer API keys used to authenticate against
 * /api/public/v1. The full key (mcl_live_…) is returned ONCE on creation and
 * stored only as a SHA-256 hash thereafter.
 */
import { Router, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { hashApiKey } from '../middleware/apiKeyAuth.js';

const router = Router();
router.use(authMiddleware);

// Scopes a key may hold. Mirror the public-API surface.
const SCOPES = ['filings:read', 'filings:write', 'entries:read', 'entries:write'] as const;

// GET /api/v1/api-keys — list this org's keys (never returns the secret).
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const keys = await prisma.apiKey.findMany({
    where: { orgId: req.user!.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, prefix: true, scopes: true,
      lastUsedAt: true, revokedAt: true, createdAt: true,
    },
  });
  res.json({ apiKeys: keys });
});

// POST /api/v1/api-keys — create a key (owner/admin). Returns the full key once.
const createSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(SCOPES)).min(1),
});
router.post('/', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const raw = `mcl_live_${randomBytes(24).toString('hex')}`;
  const created = await prisma.apiKey.create({
    data: {
      orgId: req.user!.orgId,
      name: parsed.data.name,
      prefix: raw.slice(0, 16),
      keyHash: hashApiKey(raw),
      scopes: parsed.data.scopes,
      createdById: req.user!.id,
    },
  });
  // The raw key is shown exactly once — it is never recoverable after this.
  res.status(201).json({
    id: created.id,
    name: created.name,
    prefix: created.prefix,
    scopes: created.scopes,
    key: raw,
  });
});

// DELETE /api/v1/api-keys/:id — revoke (owner/admin). Soft delete (revokedAt).
router.delete('/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.apiKey.findFirst({ where: { id, orgId: req.user!.orgId } });
  if (!existing) {
    res.status(404).json({ error: 'API key not found.' });
    return;
  }
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  res.json({ success: true });
});

export default router;
