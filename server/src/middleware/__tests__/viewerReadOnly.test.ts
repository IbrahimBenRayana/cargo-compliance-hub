/**
 * The viewer role is sold as read-only, so the server must enforce it
 * (audit BPR-05 / FNA-16): viewers could submit, amend, cancel and transmit
 * to CBP and change billing. Writes answer 403; reads and self-service
 * (own profile, password, MFA, notifications, chat) stay open.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';

const { prisma } = vi.hoisted(() => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { authMiddleware, type AuthRequest } from '../auth.js';
import { env } from '../../config/env.js';

const token = jwt.sign({ sub: 'u1' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });

async function call(role: string, method: string, url: string) {
  prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'v@x.y', orgId: 'o1', role, isActive: true, isPlatformAdmin: false });
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const next = vi.fn() as NextFunction;
  const req = { method, originalUrl: url, headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
  await authMiddleware(req, { status, json } as unknown as Response, next);
  return { status, next };
}

beforeEach(() => vi.clearAllMocks());

describe('viewer role is read-only', () => {
  it.each([
    ['POST', '/api/v1/filings/f1/submit'],
    ['POST', '/api/v1/abi-documents/d1/send'],
    ['PATCH', '/api/v1/filings/f1'],
    ['DELETE', '/api/v1/filings/f1'],
    ['POST', '/api/v1/billing/setup-intent'],
  ])('refuses %s %s', async (method, url) => {
    const { status, next } = await call('viewer', method, url);
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', '/api/v1/filings'],
    ['PATCH', '/api/v1/settings/profile'],
    ['POST', '/api/v1/settings/change-password'],
    ['POST', '/api/v1/auth/mfa/totp/enroll'],
    ['PATCH', '/api/v1/notifications/n1/read'],
    ['POST', '/api/v1/chat/messages'],
  ])('allows %s %s', async (method, url) => {
    const { next } = await call('viewer', method, url);
    expect(next).toHaveBeenCalledOnce();
  });

  it('leaves other roles unchanged', async () => {
    const { next } = await call('operator', 'POST', '/api/v1/filings/f1/submit');
    expect(next).toHaveBeenCalledOnce();
  });
});
