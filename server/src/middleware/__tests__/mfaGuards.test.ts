/**
 * MFA token-confusion and enrollment-gate guards.
 *
 * The two load-bearing security properties of the MFA rollout:
 *   • authMiddleware must reject the partial-auth mfaToken (typ:'mfa') even
 *     though it is signed with the same JWT_ACCESS_SECRET — otherwise a
 *     password alone would grant a full session before the second factor.
 *   • requireMfaEnrolled must 403 enforced-but-unenrolled accounts (fresh DB
 *     lookup, never the JWT) and pass everyone else.
 *
 * Prisma is mocked; tokens are signed with the real jsonwebtoken + test env
 * secrets planted by test-setup.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { authMiddleware, type AuthRequest } from '../auth.js';
import { requireMfaEnrolled } from '../requireMfaEnrolled.js';
import { env } from '../../config/env.js';

function buildRes(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

function bearerReq(token: string): AuthRequest {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
}

const ACTIVE_USER = {
  id: 'u1',
  email: 'x@y.z',
  orgId: 'o1',
  role: 'operator',
  isActive: true,
  isPlatformAdmin: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authMiddleware ⇄ mfaToken type confusion', () => {
  it('rejects an mfaToken (typ:"mfa") signed with the access secret', async () => {
    const mfaToken = jwt.sign(
      { sub: 'u1', typ: 'mfa', jti: 'j1' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' },
    );
    const next = vi.fn() as NextFunction;
    const { res, status, json } = buildRes();

    await authMiddleware(bearerReq(mfaToken), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
    // Must be rejected BEFORE any DB access — pure claim check.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects any token carrying an unexpected typ claim', async () => {
    const weird = jwt.sign(
      { sub: 'u1', email: 'x@y.z', orgId: 'o1', role: 'operator', typ: 'something-else' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' },
    );
    const next = vi.fn() as NextFunction;
    const { res, status } = buildRes();

    await authMiddleware(bearerReq(weird), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('still accepts a normal access token (no typ claim)', async () => {
    prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
    const accessToken = jwt.sign(
      { sub: 'u1', email: 'x@y.z', orgId: 'o1', role: 'operator' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );
    const next = vi.fn() as NextFunction;
    const { res, status } = buildRes();

    const req = bearerReq(accessToken);
    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
    expect(req.user?.id).toBe('u1');
  });
});

describe('requireMfaEnrolled', () => {
  const authedReq = () => ({ user: { ...ACTIVE_USER } }) as unknown as AuthRequest;

  it('403s with mfa_enrollment_required when enforced and not enrolled', async () => {
    prisma.user.findUnique.mockResolvedValue({ mfaEnforced: true, mfaEnabled: false });
    const next = vi.fn() as NextFunction;
    const { res, status, json } = buildRes();

    await requireMfaEnrolled(authedReq(), res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: 'MFA enrollment required',
      code: 'mfa_enrollment_required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when enforced and enrolled', async () => {
    prisma.user.findUnique.mockResolvedValue({ mfaEnforced: true, mfaEnabled: true });
    const next = vi.fn() as NextFunction;
    const { res, status } = buildRes();

    await requireMfaEnrolled(authedReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it('passes when not enforced (existing users, soft prompt only)', async () => {
    prisma.user.findUnique.mockResolvedValue({ mfaEnforced: false, mfaEnabled: false });
    const next = vi.fn() as NextFunction;
    const { res, status } = buildRes();

    await requireMfaEnrolled(authedReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it('401s when there is no authenticated user', async () => {
    const next = vi.fn() as NextFunction;
    const { res, status } = buildRes();

    await requireMfaEnrolled({} as AuthRequest, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('reads enrollment state from the DB, not the JWT', async () => {
    prisma.user.findUnique.mockResolvedValue({ mfaEnforced: true, mfaEnabled: false });
    const next = vi.fn() as NextFunction;
    const { res } = buildRes();

    await requireMfaEnrolled(authedReq(), res, next);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { mfaEnforced: true, mfaEnabled: true },
    });
  });
});
