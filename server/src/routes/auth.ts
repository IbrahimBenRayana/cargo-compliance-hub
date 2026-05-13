import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { sendWelcomeEmail, sendVerificationCodeEmail } from '../services/email.js';
import { notify } from '../services/notifications.js';
import {
  requestVerificationCode,
  confirmVerificationCode,
  getResendState,
  VERIFICATION_CONSTANTS,
} from '../services/emailVerification.js';

const router = Router();

// ─── Zod Schemas ──────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().optional(), // Optional when joining via invite
  iorNumber: z.string().optional(),
  inviteToken: z.string().optional(), // Invite token to join an existing org
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Token Helpers ────────────────────────────────────────
function generateAccessToken(user: { id: string; email: string; orgId: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, orgId: user.orgId, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
  );
}

function generateRefreshToken(userId: string) {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
}

// ─── POST /api/v1/auth/register ───────────────────────────
router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    // Check if registering via invite
    let invitation: any = null;
    if (data.inviteToken) {
      invitation = await prisma.orgInvitation.findUnique({
        where: { token: data.inviteToken },
        include: { organization: true },
      });
      if (!invitation || invitation.status !== 'pending') {
        res.status(400).json({ error: 'Invalid or expired invitation' });
        return;
      }
      if (invitation.expiresAt < new Date()) {
        await prisma.orgInvitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
        res.status(400).json({ error: 'Invitation has expired' });
        return;
      }
      if (invitation.email.toLowerCase() !== data.email.toLowerCase()) {
        res.status(400).json({ error: 'This invitation was sent to a different email address' });
        return;
      }
    } else if (!data.companyName) {
      res.status(400).json({ error: 'Company name is required when creating a new organization' });
      return;
    }

    // Create org + user (or join existing org) in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let org;
      let role = 'owner';

      if (invitation) {
        // Joining an existing org via invite
        org = invitation.organization;
        role = invitation.role;

        // Invalidate invitation after use — delete it so the token cannot be replayed
        await tx.orgInvitation.delete({ where: { id: invitation.id } });
      } else {
        // Creating a new org
        org = await tx.organization.create({
          data: {
            name: data.companyName!,
            iorNumber: data.iorNumber ?? null,
          },
        });
      }

      const user = await tx.user.create({
        data: {
          orgId: org.id,
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role,
          // New accounts start unverified — a 6-digit code is sent below and
          // the frontend gates writes (filing submit, ABI submit, billing
          // checkout) on emailVerified=true via the requireVerifiedEmail
          // middleware. Existing accounts pre-dating this rollout are not
          // affected (they're already true in the DB).
          emailVerified: false,
        },
      });

      return { org, user };
    });

    const accessToken = generateAccessToken({
      id: result.user.id,
      email: result.user.email,
      orgId: result.org.id,
      role: result.user.role,
    });

    const refreshToken = generateRefreshToken(result.user.id);

    // Save refresh token
    await prisma.user.update({
      where: { id: result.user.id },
      data: { refreshToken },
    });

    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        emailVerified: result.user.emailVerified,
        organization: {
          id: result.org.id,
          name: result.org.name,
          onboardingCompleted: result.org.onboardingCompleted,
        },
      },
      accessToken,
      refreshToken,
    });

    // Fire-and-forget: issue + email a fresh 6-digit verification code.
    // bypassCooldown because this is the very first request post-signup;
    // a normal cooldown check would always pass anyway (no prior tokens
    // exist) but being explicit avoids a roundtrip and a possible race.
    (async () => {
      try {
        const { code, expiresAt } = await requestVerificationCode(
          result.user.id,
          { bypassCooldown: true },
        );
        const expiresInMin = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
        await sendVerificationCodeEmail({
          to: result.user.email,
          firstName: result.user.firstName,
          code,
          expiresInMin,
        });
      } catch {
        // Non-fatal — the user can hit /resend from the verify page.
      }
    })();

    // Audit log (fire-and-forget)
    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: result.org.id, userId: result.user.id,
      action: 'user.registered', entityType: 'user', entityId: result.user.id,
      newValue: { email: data.email, companyName: data.companyName },
      ...meta,
    });

    // Send welcome email (fire-and-forget)
    sendWelcomeEmail({
      to: result.user.email,
      firstName: result.user.firstName || 'there',
      organizationName: result.org.name,
    }).catch(() => {});

    // Phase 3: when someone joins via invite, ping the org admins so they
    // know the seat was taken. Skip for first-org-creation (no admins
    // existed yet, would be a self-notification).
    if (invitation) {
      const fullName = `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim() || result.user.email;
      notify({
        kind:     'team_member_joined',
        audience: { orgId: result.org.id, roles: ['ADMIN', 'OWNER'] },
        title:    'New Team Member',
        message:  `${fullName} joined the team as ${result.user.role}.`,
        linkUrl:  '/team',
        metadata: { newUserId: result.user.id, role: result.user.role, email: result.user.email },
      }).catch(() => {});
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.flatten() });
      return;
    }
    throw err;
  }
});

// ─── POST /api/v1/auth/login ──────────────────────────────
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { organization: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      res.status(423).json({
        error: 'Account locked',
        lockedUntil: user.lockedUntil.toISOString(),
      });
      return;
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      // Increment failed attempts
      const failedAttempts = user.failedAttempts + 1;
      const updates: any = { failedAttempts };

      if (failedAttempts >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      }

      await prisma.user.update({ where: { id: user.id }, data: updates });

      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Reset failed attempts on success
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
    });

    const refreshToken = generateRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        refreshToken,
      },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          onboardingCompleted: user.organization.onboardingCompleted,
        },
      },
      accessToken,
      refreshToken,
    });

    // Audit log
    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: user.orgId, userId: user.id,
      action: 'user.login', entityType: 'user', entityId: user.id,
      ...meta,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.flatten() });
      return;
    }
    throw err;
  }
});

// ─── POST /api/v1/auth/refresh ────────────────────────────
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sub: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { organization: true },
    });

    if (!user || user.refreshToken !== refreshToken || !user.isActive) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Rotate tokens
    const newAccessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
    });

    const newRefreshToken = generateRefreshToken(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Refresh token expired, please login again' });
      return;
    }
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── POST /api/v1/auth/logout ─────────────────────────────
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { refreshToken: null },
  });
  res.json({ message: 'Logged out' });
});

// ─── GET /api/v1/auth/me ──────────────────────────────────
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { organization: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    emailVerified: user.emailVerified,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      iorNumber: user.organization.iorNumber,
      ccEnvironment: user.organization.ccEnvironment,
      onboardingCompleted: user.organization.onboardingCompleted,
    },
  });
});

// ─── Email verification endpoints ────────────────────────────────────
// All three require an authenticated session — the user signs up, gets an
// access token, then lands on /verify-email and exchanges its code. The
// requireVerifiedEmail middleware separately gates sensitive *write* paths
// (filing submit, ABI submit, billing checkout) so the user isn't stuck.

const verifyConfirmSchema = z.object({
  code: z.string().min(4).max(10).regex(/^\d+$/, 'Code must be digits only'),
});

// POST /api/v1/auth/verify-email/resend — issue a fresh code, email it.
// Rate-limited by the service via per-user 60s cooldown; on top of that
// authLimiter caps to 10/min/IP for spam prevention.
router.post('/verify-email/resend', authLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, firstName: true, emailVerified: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (user.emailVerified) {
    res.json({ ok: true, alreadyVerified: true });
    return;
  }

  try {
    const { code, expiresAt } = await requestVerificationCode(user.id);
    const expiresInMin = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
    sendVerificationCodeEmail({
      to: user.email,
      firstName: user.firstName,
      code,
      expiresInMin,
    }).catch(() => { /* swallow — user can hit resend again */ });
    res.json({ ok: true, cooldownSec: 60, expiresInMin });
  } catch (err: any) {
    if (err?.code === 'COOLDOWN') {
      res.status(429).json({
        error: err.message,
        cooldownRemainingSec: err.cooldownRemainingSec,
      });
      return;
    }
    throw err;
  }
});

// GET /api/v1/auth/verify-email/state — quick check used by the UI to drive
// the resend-countdown without hitting the resend endpoint speculatively.
router.get('/verify-email/state', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { emailVerified: true, email: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const state = await getResendState(req.user!.id);
  res.json({
    emailVerified: user.emailVerified,
    email: user.email,
    canResend: state.canResend,
    cooldownRemainingSec: state.cooldownRemainingSec,
    codeLength: VERIFICATION_CONSTANTS.CODE_LENGTH,
  });
});

// POST /api/v1/auth/verify-email/confirm — submit the 6-digit code.
router.post('/verify-email/confirm', authLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = verifyConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid code format', details: parsed.error.flatten() });
    return;
  }

  const result = await confirmVerificationCode(req.user!.id, parsed.data.code);
  if (result.ok) {
    // Audit trail — we want to know exactly when a user verified, from where.
    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'user.email_verified', entityType: 'user', entityId: req.user!.id,
      newValue: { verifiedAt: new Date().toISOString() },
      ...meta,
    });
    res.json({ ok: true });
    return;
  }

  // Map service reasons to user-friendly HTTP responses. We deliberately use
  // 400 for everything except "rate-locked" (429) so the UI can render a
  // single inline error string and the actionable subset comes via
  // `attemptsRemaining` when present.
  const status = result.reason === 'locked' ? 429 : 400;
  res.status(status).json({
    error: humanReasonFor(result.reason),
    reason: result.reason,
    attemptsRemaining: result.attemptsRemaining,
  });
});

function humanReasonFor(reason: ConfirmReason): string {
  switch (reason) {
    case 'expired':         return 'This code has expired. Request a new one.';
    case 'locked':          return 'Too many incorrect attempts. Request a new code to continue.';
    case 'no_active_token': return 'No active verification code. Request a new one to continue.';
    case 'invalid':
    default:                return 'That code is not correct. Please try again.';
  }
}

type ConfirmReason = 'invalid' | 'expired' | 'locked' | 'no_active_token' | undefined;

export default router;
