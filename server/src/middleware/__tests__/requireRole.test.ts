/**
 * Tests for requireRole (audit Phase 10b).
 *
 * requireRole is the load-bearing gate on every privileged endpoint
 * (PATCH /settings/organization, /onboarding, members management,
 * job triggers, etc). It's the difference between an operator and an
 * owner being able to rewrite the org's IOR — so we want a deliberate
 * test net under it.
 *
 * Pure middleware (no DB, no JWT) — assert behavior against fabricated
 * req/res/next stubs.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import { requireRole, type AuthRequest } from '../auth.js';

function buildReq(user?: AuthRequest['user']): AuthRequest {
  return { user } as AuthRequest;
}

function buildRes(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

describe('requireRole', () => {
  it('401s when req.user is undefined', () => {
    const next = vi.fn() as NextFunction;
    const { res, status, json } = buildRes();
    requireRole('owner')(buildReq(undefined), res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('403s when the user role is not in the allowlist', () => {
    const next = vi.fn() as NextFunction;
    const { res, status, json } = buildRes();
    requireRole('owner', 'admin')(
      buildReq({ id: 'u1', email: 'x@y.z', orgId: 'o1', role: 'operator' }),
      res,
      next,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when the user role matches', () => {
    const next = vi.fn() as NextFunction;
    const { res } = buildRes();
    requireRole('owner', 'admin')(
      buildReq({ id: 'u1', email: 'x@y.z', orgId: 'o1', role: 'admin' }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('treats role names as exact case-sensitive matches', () => {
    // The codebase stores roles as lowercase ('owner', 'admin', 'operator',
    // 'viewer'). Anything case-skewed is treated as a different role —
    // documents the contract rather than asserting "should be loose".
    const next = vi.fn() as NextFunction;
    const { res, status } = buildRes();
    requireRole('owner')(
      buildReq({ id: 'u1', email: 'x@y.z', orgId: 'o1', role: 'OWNER' }),
      res,
      next,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts the first matching role when multiple are allowed', () => {
    const next = vi.fn() as NextFunction;
    const { res } = buildRes();
    requireRole('owner', 'admin', 'operator')(
      buildReq({ id: 'u1', email: 'x@y.z', orgId: 'o1', role: 'operator' }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('refuses an empty allowlist (defense-in-depth)', () => {
    // requireRole() with no args means "no role passes". Useful as a
    // belt-and-braces default to fail closed on a wiring mistake.
    const next = vi.fn() as NextFunction;
    const { res, status } = buildRes();
    requireRole()(
      buildReq({ id: 'u1', email: 'x@y.z', orgId: 'o1', role: 'owner' }),
      res,
      next,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
