/**
 * Settings Routes
 * 
 * Manage user profile, organization settings, and CC API configuration.
 */

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import logger from '../config/logger.js';

// PATCH /profile only accepts name updates. Email changes need re-verification
// against the new address — that lands in audit Phase 4 alongside the
// pendingEmail schema migration. Until then, attempts to change email through
// this endpoint are rejected with a 400 so we don't silently allow a
// zero-verification email swap (the original P0 takeover vector).
const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
}).strict();

const router = Router();
router.use(authMiddleware);

// ─── GET /api/v1/settings/profile — Get current user profile
router.get('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            iorNumber: true,
            einNumber: true,
            ccEnvironment: true,
            address: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (err: any) {
    logger.error({ err: err.message }, '[Settings] Error fetching profile:');
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── PATCH /api/v1/settings/profile — Update user profile
router.patch('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Pre-Zod: if the caller sent `email`, refuse explicitly so they don't
    // think a silent swap happened. The proper pendingEmail flow lands in
    // audit Phase 4 (alongside the schema migration adding pendingEmail).
    if (typeof req.body?.email === 'string' && req.body.email !== req.user!.email) {
      res.status(400).json({
        error: 'Changing email through profile settings is temporarily disabled. Contact support to update your email.',
      });
      return;
    }

    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
      return;
    }
    const { firstName, lastName } = parsed.data;

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err: err.message }, '[Settings] Error updating profile:');
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── POST /api/v1/settings/change-password — Change password
router.post('/change-password', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { passwordHash: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    if (newPassword === currentPassword) {
      res.status(400).json({ error: 'New password must be different from your current password' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    // Null the refresh token in the same write. A stolen refresh token would
    // otherwise keep minting access tokens for the full 7-day window even
    // after the user "changes their password to be safe" — the exact reflex
    // we want to honour.
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash, refreshToken: null },
    });

    res.json({ success: true, message: 'Password changed successfully' });

    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: req.user!.orgId,
      userId: req.user!.id,
      action: 'user.password_changed',
      entityType: 'user',
      entityId: req.user!.id,
      ...meta,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Settings] Error changing password:');
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── GET /api/v1/settings/organization — Get org settings
router.get('/organization', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
      select: {
        id: true,
        name: true,
        iorNumber: true,
        einNumber: true,
        ccEnvironment: true,
        address: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            filings: true,
            filingTemplates: true,
          },
        },
      },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json(org);
  } catch (err: any) {
    logger.error({ err: err.message }, '[Settings] Error fetching organization:');
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// ─── PATCH /api/v1/settings/organization — Update org settings
// requireRole gate: org name, IOR, EIN, address feed every CBP submission
// downstream. operator/viewer must not be able to rewrite the legal entity
// behind a filing — only owner/admin can.
router.patch('/organization', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, iorNumber, einNumber, address, phone, website } = req.body;

    // Read the previous values so the audit row can show the diff.
    // Org IOR/EIN flow into every CBP submission downstream — anyone who
    // rewrites them silently is the most dangerous insider action in the
    // app, hence the audit entry below (audit Phase 7).
    const before = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
      select: { name: true, iorNumber: true, einNumber: true, address: true, phone: true, website: true },
    });

    const updated = await prisma.organization.update({
      where: { id: req.user!.orgId },
      data: {
        ...(name !== undefined && { name }),
        ...(iorNumber !== undefined && { iorNumber }),
        ...(einNumber !== undefined && { einNumber }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(website !== undefined && { website }),
      },
      select: {
        id: true,
        name: true,
        iorNumber: true,
        einNumber: true,
        ccEnvironment: true,
        address: true,
        phone: true,
        website: true,
      },
    });

    res.json(updated);

    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: req.user!.orgId,
      userId: req.user!.id,
      action: 'organization.updated',
      entityType: 'organization',
      entityId: req.user!.orgId,
      oldValue: before ?? undefined,
      newValue: {
        name: updated.name,
        iorNumber: updated.iorNumber,
        einNumber: updated.einNumber,
        address: updated.address,
        phone: updated.phone,
        website: updated.website,
      },
      ...meta,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Settings] Error updating organization:');
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ─── GET /api/v1/settings/audit-log — Get audit log
router.get('/audit-log', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const entityType = req.query.entityType as string;
    const action = req.query.action as string;

    const where: any = { orgId: req.user!.orgId };
    if (entityType) where.entityType = entityType;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Settings] Error fetching audit log:');
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ─── Entry number blocks — the filer's pre-issued ranges ─────────────
//
// Reads are open to every org member (the wizard shows remaining counts);
// writes are owner/admin only — a wrong range corrupts every entry number
// drawn from it. Sequences are the 7-digit filer-assigned part; check
// digits are computed at draw time (services/entryNumberBlocks.ts).

const entryBlockCreateSchema = z.object({
  filerCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3}$/, 'Filer code must be 3 letters/digits'),
  rangeStart: z.number().int().min(1).max(9_999_999),
  rangeEnd: z.number().int().min(1).max(9_999_999),
  label: z.string().trim().max(100).optional(),
}).strict().refine((b) => b.rangeEnd >= b.rangeStart, {
  path: ['rangeEnd'],
  message: 'Range end must be ≥ range start',
});

const entryBlockUpdateSchema = z.object({
  active: z.boolean().optional(),
  label: z.string().trim().max(100).nullable().optional(),
  rangeEnd: z.number().int().min(1).max(9_999_999).optional(),
}).strict();

/** Shape a block row for the API: usage counters included. */
function serializeEntryBlock(b: {
  id: string; filerCode: string; rangeStart: number; rangeEnd: number;
  nextSequence: number; active: boolean; label: string | null; createdAt: Date;
}) {
  return {
    id: b.id,
    filerCode: b.filerCode,
    rangeStart: b.rangeStart,
    rangeEnd: b.rangeEnd,
    nextSequence: b.nextSequence,
    active: b.active,
    label: b.label,
    createdAt: b.createdAt,
    used: Math.min(b.nextSequence, b.rangeEnd + 1) - b.rangeStart,
    remaining: Math.max(0, b.rangeEnd - b.nextSequence + 1),
    exhausted: b.nextSequence > b.rangeEnd,
  };
}

// GET /api/v1/settings/entry-blocks — list the org's blocks
router.get('/entry-blocks', async (req: AuthRequest, res: Response): Promise<void> => {
  const blocks = await prisma.entryNumberBlock.findMany({
    where: { orgId: req.user!.orgId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: blocks.map(serializeEntryBlock) });
});

// POST /api/v1/settings/entry-blocks — register a new block
router.post('/entry-blocks', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = entryBlockCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    return;
  }
  const { filerCode, rangeStart, rangeEnd, label } = parsed.data;

  // Overlapping ranges for the same filer code would double-issue numbers.
  const overlap = await prisma.entryNumberBlock.findFirst({
    where: {
      orgId: req.user!.orgId,
      filerCode,
      rangeStart: { lte: rangeEnd },
      rangeEnd: { gte: rangeStart },
    },
    select: { id: true, rangeStart: true, rangeEnd: true },
  });
  if (overlap) {
    res.status(409).json({
      error: `Range overlaps an existing ${filerCode} block (${overlap.rangeStart}–${overlap.rangeEnd}). Entry numbers must never be issued twice.`,
    });
    return;
  }

  const block = await prisma.entryNumberBlock.create({
    data: {
      orgId: req.user!.orgId,
      filerCode,
      rangeStart,
      rangeEnd,
      nextSequence: rangeStart,
      label: label ?? null,
    },
  });

  await writeAuditLog({
    orgId: req.user!.orgId,
    userId: req.user!.id,
    action: 'entry_block.create',
    entityType: 'entry_number_block',
    entityId: block.id,
    newValue: { filerCode, rangeStart, rangeEnd },
    ...getRequestMeta(req),
  });

  res.status(201).json({ data: serializeEntryBlock(block) });
});

// PATCH /api/v1/settings/entry-blocks/:id — activate/deactivate, relabel, extend
router.patch('/entry-blocks/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = entryBlockUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    return;
  }

  const block = await prisma.entryNumberBlock.findFirst({
    where: { id, orgId: req.user!.orgId },
  });
  if (!block) {
    res.status(404).json({ error: 'Entry number block not found' });
    return;
  }

  // A shrunk range must never un-issue numbers already drawn.
  if (parsed.data.rangeEnd !== undefined) {
    const floor = Math.max(block.rangeStart, block.nextSequence - 1);
    if (parsed.data.rangeEnd < floor) {
      res.status(400).json({
        error: `Range end cannot go below ${floor} — numbers up to ${block.nextSequence - 1} are already drawn.`,
      });
      return;
    }
    // Extending must not collide with a neighbouring block either.
    const overlap = await prisma.entryNumberBlock.findFirst({
      where: {
        orgId: req.user!.orgId,
        filerCode: block.filerCode,
        id: { not: block.id },
        rangeStart: { lte: parsed.data.rangeEnd },
        rangeEnd: { gte: block.rangeStart },
      },
      select: { id: true, rangeStart: true, rangeEnd: true },
    });
    if (overlap) {
      res.status(409).json({
        error: `Extended range would overlap the ${block.filerCode} block ${overlap.rangeStart}–${overlap.rangeEnd}.`,
      });
      return;
    }
  }

  const updated = await prisma.entryNumberBlock.update({
    where: { id: block.id },
    data: {
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.rangeEnd !== undefined && { rangeEnd: parsed.data.rangeEnd }),
    },
  });

  await writeAuditLog({
    orgId: req.user!.orgId,
    userId: req.user!.id,
    action: 'entry_block.update',
    entityType: 'entry_number_block',
    entityId: block.id,
    oldValue: { active: block.active, label: block.label, rangeEnd: block.rangeEnd },
    newValue: parsed.data,
    ...getRequestMeta(req),
  });

  res.json({ data: serializeEntryBlock(updated) });
});

export default router;
