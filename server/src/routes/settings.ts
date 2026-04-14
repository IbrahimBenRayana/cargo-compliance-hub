/**
 * Settings Routes
 * 
 * Manage user profile, organization settings, and CC API configuration.
 */

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import logger from '../config/logger.js';

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
    const { firstName, lastName, email } = req.body;

    // Check email uniqueness if changing
    if (email && email !== req.user!.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email && { email }),
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
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new passwords are required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

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

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash },
    });

    res.json({ success: true, message: 'Password changed successfully' });
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
router.patch('/organization', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, iorNumber, einNumber, address } = req.body;

    const updated = await prisma.organization.update({
      where: { id: req.user!.orgId },
      data: {
        ...(name !== undefined && { name }),
        ...(iorNumber !== undefined && { iorNumber }),
        ...(einNumber !== undefined && { einNumber }),
        ...(address !== undefined && { address }),
      },
      select: {
        id: true,
        name: true,
        iorNumber: true,
        einNumber: true,
        ccEnvironment: true,
        address: true,
      },
    });

    res.json(updated);
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
