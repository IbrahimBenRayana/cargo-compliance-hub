/**
 * Organization Management Routes
 * 
 * Team member management, invitations, role changes.
 * Only owners/admins can manage team members.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import { sendInvitationEmail } from '../services/email.js';
import logger from '../config/logger.js';

const router = Router();
router.use(authMiddleware);

// Valid roles in order of privilege
const ROLES = ['viewer', 'operator', 'admin', 'owner'] as const;
type Role = typeof ROLES[number];

// ─── GET /api/v1/organization/members — List team members
router.get('/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const members = await prisma.user.findMany({
      where: { orgId: req.user!.orgId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: { filings: true },
        },
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Sort by role privilege (owner first)
    const rolePriority: Record<string, number> = { owner: 0, admin: 1, operator: 2, viewer: 3 };
    members.sort((a, b) => (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99));

    res.json({ data: members });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Org] Error listing members:');
    res.status(500).json({ error: 'Failed to list members' });
  }
});

// ─── PATCH /api/v1/organization/members/:id/role — Change member role
router.patch('/members/:id/role', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    if (!role || !ROLES.includes(role as Role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
      return;
    }

    // Can't change your own role
    if (id === req.user!.id) {
      res.status(400).json({ error: 'Cannot change your own role' });
      return;
    }

    // Only owners can promote to owner or change other owners
    const target = await prisma.user.findFirst({
      where: { id, orgId: req.user!.orgId },
    });

    if (!target) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if ((role === 'owner' || target.role === 'owner') && req.user!.role !== 'owner') {
      res.status(403).json({ error: 'Only owners can promote to owner or modify other owners' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    res.json(updated);

    // Audit
    const meta = getRequestMeta(req as any);
    writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'member.role_changed', entityType: 'user', entityId: id,
      oldValue: { role: target.role },
      newValue: { role },
      ...meta,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Org] Error changing role:');
    res.status(500).json({ error: 'Failed to change role' });
  }
});

// ─── DELETE /api/v1/organization/members/:id — Remove member
router.delete('/members/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (id === req.user!.id) {
      res.status(400).json({ error: 'Cannot remove yourself' });
      return;
    }

    const target = await prisma.user.findFirst({
      where: { id, orgId: req.user!.orgId },
    });

    if (!target) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if (target.role === 'owner' && req.user!.role !== 'owner') {
      res.status(403).json({ error: 'Only owners can remove other owners' });
      return;
    }

    // Deactivate instead of hard delete (preserve filing attribution)
    await prisma.user.update({
      where: { id },
      data: { isActive: false, refreshToken: null },
    });

    res.json({ message: 'Member removed', memberId: id });

    const meta = getRequestMeta(req as any);
    writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'member.removed', entityType: 'user', entityId: id,
      oldValue: { email: target.email, role: target.role },
      ...meta,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Org] Error removing member:');
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ─── POST /api/v1/organization/invitations — Send invite
router.post('/invitations', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(['viewer', 'operator', 'admin']),
    });

    const data = schema.parse(req.body);

    // Check if already a member
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email, orgId: req.user!.orgId, isActive: true },
    });
    if (existingUser) {
      res.status(409).json({ error: 'User is already a member of this organization' });
      return;
    }

    // Check seat limit
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
      select: { maxUsers: true, _count: { select: { users: { where: { isActive: true } } } } },
    });
    if (org && org._count.users >= org.maxUsers) {
      res.status(403).json({ error: `Organization has reached its member limit (${org.maxUsers})` });
      return;
    }

    // Check if pending invite already exists
    const existingInvite = await prisma.orgInvitation.findFirst({
      where: { email: data.email, orgId: req.user!.orgId, status: 'pending' },
    });
    if (existingInvite) {
      res.status(409).json({ error: 'An invitation is already pending for this email' });
      return;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.orgInvitation.create({
      data: {
        orgId: req.user!.orgId,
        invitedById: req.user!.id,
        email: data.email,
        role: data.role,
        token,
        expiresAt,
      },
      include: {
        invitedBy: { select: { firstName: true, lastName: true, email: true } },
        organization: { select: { name: true } },
      },
    });

    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      inviteLink: `/register?invite=${token}`,
      invitedBy: invitation.invitedBy,
      organization: invitation.organization,
    });

    // Send invitation email (fire-and-forget)
    const inviterName = `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim() || invitation.invitedBy.email;
    sendInvitationEmail({
      to: data.email,
      inviterName,
      organizationName: invitation.organization.name,
      role: data.role,
      inviteToken: token,
    }).catch((err) => logger.error({ err }, '[Org] Invitation email failed'));

    const meta = getRequestMeta(req as any);
    writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'invitation.created', entityType: 'invitation', entityId: invitation.id,
      newValue: { email: data.email, role: data.role },
      ...meta,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.flatten() });
      return;
    }
    logger.error({ err: (err as any).message }, '[Org] Error creating invitation');
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// ─── GET /api/v1/organization/invitations — List invitations
router.get('/invitations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invitations = await prisma.orgInvitation.findMany({
      where: { orgId: req.user!.orgId },
      include: {
        invitedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ data: invitations });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Org] Error listing invitations:');
    res.status(500).json({ error: 'Failed to list invitations' });
  }
});

// ─── DELETE /api/v1/organization/invitations/:id — Revoke invite
router.delete('/invitations/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invitation = await prisma.orgInvitation.findFirst({
      where: { id: req.params.id as string, orgId: req.user!.orgId, status: 'pending' },
    });

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found or already used' });
      return;
    }

    await prisma.orgInvitation.update({
      where: { id: invitation.id },
      data: { status: 'revoked' },
    });

    res.json({ message: 'Invitation revoked' });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Org] Error revoking invitation:');
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

// ─── POST /api/v1/organization/accept-invite — Accept invitation (public, auth required)
router.post('/accept-invite', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Invitation token required' });
      return;
    }

    const invitation = await prisma.orgInvitation.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    });

    if (!invitation) {
      res.status(404).json({ error: 'Invalid invitation' });
      return;
    }

    if (invitation.status !== 'pending') {
      res.status(400).json({ error: `Invitation already ${invitation.status}` });
      return;
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.orgInvitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
      res.status(400).json({ error: 'Invitation has expired' });
      return;
    }

    // Transfer user to the new org
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user!.id },
        data: { orgId: invitation.orgId, role: invitation.role },
      }),
      prisma.orgInvitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      }),
    ]);

    res.json({
      message: `You've joined ${invitation.organization.name}`,
      organization: { id: invitation.orgId, name: invitation.organization.name },
      role: invitation.role,
    });

    const meta = getRequestMeta(req as any);
    writeAuditLog({
      orgId: invitation.orgId, userId: req.user!.id,
      action: 'invitation.accepted', entityType: 'invitation', entityId: invitation.id,
      newValue: { email: req.user!.email, role: invitation.role },
      ...meta,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Org] Error accepting invitation:');
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// ─── GET /api/v1/organization/overview — Org overview for dashboard
router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        iorNumber: true,
        ccEnvironment: true,
        maxUsers: true,
        onboardingCompleted: true,
        createdAt: true,
        _count: {
          select: {
            users: { where: { isActive: true } },
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
    logger.error({ err: err.message }, '[Org] Error fetching overview:');
    res.status(500).json({ error: 'Failed to fetch organization overview' });
  }
});

// ─── PATCH /api/v1/organization/onboarding — Mark onboarding complete
router.patch('/onboarding', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.organization.update({
      where: { id: req.user!.orgId },
      data: { onboardingCompleted: true },
    });
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Org] Error updating onboarding:');
    res.status(500).json({ error: 'Failed to update onboarding status' });
  }
});

export default router;
