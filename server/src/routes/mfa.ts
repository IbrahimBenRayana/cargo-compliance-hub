/**
 * MFA routes — the HTTP surface over services/mfa.ts.
 *
 * Two families:
 *   • Challenge endpoints (/verify, /email/send) — used mid-login. They are NOT
 *     Bearer-authenticated; they authenticate via the short-lived `mfaToken`
 *     (typ:'mfa') minted by /auth/login after a correct password. /verify
 *     exchanges that token + a second factor for a real access/refresh pair.
 *   • Management endpoints (/setup, /enable, /disable, /recovery-codes) —
 *     Bearer-authenticated (a normal session). Each re-verifies the account
 *     password before touching the second factor.
 *
 * All routes are behind authLimiter (10/min/IP). Business logic lives in
 * services/mfa.ts — routes only translate HTTP ⇄ service calls.
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { User, Organization } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import {
  generateAccessToken,
  generateRefreshToken,
  setRefreshCookie,
} from './auth.js';
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  verifyTotp,
  verifyRecoveryCode,
  verifyEmailCode,
  issueEmailCode,
  generateRecoveryCodes,
  recordMfaFailure,
  resetMfaFailures,
  MfaError,
  MfaCooldownError,
  MFA_CONSTANTS,
} from '../services/mfa.js';
import {
  sendMfaCodeEmail,
  sendMfaEnabledEmail,
  sendMfaDisabledEmail,
  sendMfaRecoveryCodeUsedEmail,
} from '../services/email.js';

const router = Router();

const EMAIL_CODE_EXPIRES_MIN = 5;
const EMAIL_CODE_COOLDOWN_SEC = 60;

// ─── Shared helpers ───────────────────────────────────────────────────

type UserWithOrg = User & { organization: Organization };

/** Shape returned to the SPA on a completed login — identical to /auth/login
 *  success, plus the MFA status fields the frontend gates on. */
function buildUserPayload(user: UserWithOrg) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isPlatformAdmin: user.isPlatformAdmin,
    mfaEnabled: user.mfaEnabled,
    mfaSetupRequired: user.mfaEnforced && !user.mfaEnabled,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      onboardingCompleted: user.organization.onboardingCompleted,
    },
  };
}

/**
 * Authenticate a challenge request via the `mfaToken` in the body. Verifies the
 * JWT, asserts typ==='mfa' (so a real access token can't be replayed here),
 * and loads the (active) user. On any failure it writes the 401 response and
 * returns null — callers should `return` immediately when they get null.
 */
async function authenticateMfaToken(
  mfaToken: string,
  res: Response,
): Promise<UserWithOrg | null> {
  const fail = () => {
    res.status(401).json({ error: 'Your sign-in session expired. Please log in again.', code: 'mfa_token_invalid' });
    return null;
  };

  let decoded: { sub?: string; typ?: string };
  try {
    decoded = jwt.verify(mfaToken, env.JWT_ACCESS_SECRET) as { sub?: string; typ?: string };
  } catch {
    return fail();
  }

  // Must be an mfa token — reject access tokens (no typ) or anything else.
  if (decoded.typ !== 'mfa' || !decoded.sub) {
    return fail();
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    include: { organization: true },
  });
  if (!user || !user.isActive) {
    return fail();
  }
  return user;
}

/** Locked accounts get the SAME generic 401 as login — no lock oracle. */
function respondLocked(res: Response): void {
  res.status(401).json({ error: 'Invalid credentials' });
}

// ─── Challenge endpoints (mfaToken auth) ──────────────────────────────

const verifySchema = z.object({
  mfaToken: z.string().min(1),
  method: z.enum(['totp', 'recovery', 'email']),
  code: z.string().min(1).max(64),
});

// POST /api/v1/auth/mfa/verify — exchange mfaToken + second factor for a session.
router.post('/verify', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { mfaToken, method, code } = parsed.data;

  const user = await authenticateMfaToken(mfaToken, res);
  if (!user) return;

  // Locked mid-challenge (e.g. 5 prior failures) → generic 401, same as login.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    respondLocked(res);
    return;
  }

  // Dispatch to the right verifier. `recoveryRemaining` is captured so we can
  // tell the user how many codes are left (and email them) on a recovery login.
  let ok = false;
  let recoveryRemaining = 0;
  if (method === 'totp') {
    ok = await verifyTotp(user, code);
  } else if (method === 'recovery') {
    const result = await verifyRecoveryCode(user.id, code);
    ok = result.ok;
    recoveryRemaining = result.remaining;
  } else {
    const result = await verifyEmailCode(user, code);
    ok = result.ok;
  }

  if (!ok) {
    const failure = await recordMfaFailure(user);
    if (failure.locked) {
      // 5th failure just locked the account — generic 401, no attempt count.
      respondLocked(res);
      return;
    }
    // recordMfaFailure incremented the counter; compute what's left.
    const newCount = user.mfaFailedAttempts + 1;
    res.status(400).json({
      error: 'Invalid code',
      attemptsRemaining: Math.max(0, MFA_CONSTANTS.MAX_MFA_FAILURES - newCount),
    });
    return;
  }

  // Second factor proven — clear the failure counter and complete the login
  // exactly like the /auth/login success path.
  await resetMfaFailures(user);

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
  setRefreshCookie(res, refreshToken);

  res.json({ user: buildUserPayload(user), accessToken });

  // Audit + (for recovery) a security email noting a code was burned.
  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: user.orgId, userId: user.id,
    action: 'user.login_mfa', entityType: 'user', entityId: user.id,
    newValue: { method },
    ...meta,
  });

  if (method === 'recovery') {
    sendMfaRecoveryCodeUsedEmail({
      to: user.email,
      firstName: user.firstName,
      remainingCodes: recoveryRemaining,
    }).catch(() => { /* fire-and-forget */ });
  }
});

const emailSendSchema = z.object({ mfaToken: z.string().min(1) });

// POST /api/v1/auth/mfa/email/send — issue + email a one-time login code.
router.post('/email/send', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = emailSendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = await authenticateMfaToken(parsed.data.mfaToken, res);
  if (!user) return;

  try {
    const { code } = await issueEmailCode(user);
    sendMfaCodeEmail({
      to: user.email,
      firstName: user.firstName,
      code,
      expiresInMin: EMAIL_CODE_EXPIRES_MIN,
    }).catch(() => { /* fire-and-forget — user can resend */ });

    res.json({ ok: true, expiresInMin: EMAIL_CODE_EXPIRES_MIN, cooldownSec: EMAIL_CODE_COOLDOWN_SEC });
  } catch (err) {
    if (err instanceof MfaCooldownError) {
      res.status(429).json({ error: err.message, secondsRemaining: err.secondsRemaining });
      return;
    }
    throw err;
  }
});

// ─── Management endpoints (Bearer auth) ───────────────────────────────

/** Map a MfaError thrown by the enrollment flow to a 400 with a clear message. */
function mfaErrorMessage(err: MfaError): string {
  switch (err.code) {
    case 'no_pending_enrollment': return 'Start setup again — no pending enrollment was found.';
    case 'pending_expired':       return 'Setup timed out. Start again to get a fresh QR code.';
    case 'invalid_code':          return 'That code is not correct. Check your authenticator app and try again.';
    case 'already_enabled':       return 'MFA is already enabled on this account.';
    default:                      return 'Could not complete MFA setup. Please try again.';
  }
}

const setupSchema = z.object({ password: z.string().min(1) });

// POST /api/v1/auth/mfa/setup — password re-auth → begin TOTP enrollment.
router.post('/setup', authLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }
  if (user.mfaEnabled) {
    res.status(400).json({ error: 'MFA already enabled' });
    return;
  }

  const { otpauthUri, secretBase32 } = await beginTotpEnrollment(user);
  res.json({ otpauthUri, secretBase32 });
});

const enableSchema = z.object({
  code: z.string().min(1).max(16),
});

// POST /api/v1/auth/mfa/enable — confirm the pending secret with a live code.
router.post('/enable', authLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = enableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  try {
    const { recoveryCodes } = await confirmTotpEnrollment(user, parsed.data.code);

    sendMfaEnabledEmail({ to: user.email, firstName: user.firstName }).catch(() => {});

    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: user.orgId, userId: user.id,
      action: 'user.mfa_enabled', entityType: 'user', entityId: user.id,
      ...meta,
    });

    res.json({ recoveryCodes });
  } catch (err) {
    if (err instanceof MfaError) {
      res.status(400).json({ error: mfaErrorMessage(err), code: err.code });
      return;
    }
    throw err;
  }
});

const disableSchema = z.object({
  password: z.string().min(1),
  code: z.string().min(1).max(16),
});

// POST /api/v1/auth/mfa/disable — password + a valid TOTP or recovery code.
router.post('/disable', authLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = disableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }
  if (!user.mfaEnabled) {
    res.status(400).json({ error: 'MFA is not enabled' });
    return;
  }

  // Accept either factor: a live TOTP code or a single-use recovery code.
  let codeOk = await verifyTotp(user, parsed.data.code);
  if (!codeOk) {
    const rec = await verifyRecoveryCode(user.id, parsed.data.code);
    codeOk = rec.ok;
  }
  if (!codeOk) {
    res.status(400).json({ error: 'Invalid code' });
    return;
  }

  // Tear down MFA: clear the secret + pending state + replay guard, and drop
  // every recovery / email code row. NOTE: if the account is mfaEnforced we
  // still allow the disable — but requireMfaEnrolled will immediately force the
  // user back through enrollment on their next gated request. The enforcement
  // policy is deliberately decoupled from the enable/disable toggle.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecretEnc: null,
        mfaPendingSecretEnc: null,
        mfaPendingCreatedAt: null,
        mfaLastUsedStep: null,
        mfaEnrolledAt: null,
      },
    }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.mfaEmailCode.deleteMany({ where: { userId: user.id } }),
  ]);

  sendMfaDisabledEmail({ to: user.email, firstName: user.firstName }).catch(() => {});

  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: user.orgId, userId: user.id,
    action: 'user.mfa_disabled', entityType: 'user', entityId: user.id,
    ...meta,
  });

  res.json({ ok: true });
});

const recoveryCodesSchema = z.object({ password: z.string().min(1) });

// POST /api/v1/auth/mfa/recovery-codes — regenerate (invalidates the old set).
router.post('/recovery-codes', authLimiter, authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = recoveryCodesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }
  if (!user.mfaEnabled) {
    res.status(400).json({ error: 'MFA is not enabled' });
    return;
  }

  const recoveryCodes = await generateRecoveryCodes(user.id);

  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: user.orgId, userId: user.id,
    action: 'user.mfa_recovery_codes_regenerated', entityType: 'user', entityId: user.id,
    ...meta,
  });

  res.json({ recoveryCodes });
});

export default router;
