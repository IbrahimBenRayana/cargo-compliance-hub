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

export default router;
