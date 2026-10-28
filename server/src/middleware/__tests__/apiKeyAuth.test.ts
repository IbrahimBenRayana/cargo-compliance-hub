/**
 * API keys can file to CBP, so a key must stop working with its creator's
 * access (audit BPR-04).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response, NextFunction } from 'express';

const { prisma } = vi.hoisted(() => ({ prisma: { apiKey: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../services/entitlements.js', () => ({
  getOrgEntitlements: vi.fn(async () => ({ capabilities: [], planId: 'entry' })),
}));

import { apiKeyAuth } from '../apiKeyAuth.js';

function call() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const next = vi.fn() as unknown as NextFunction;
  const req = { headers: { authorization: 'Bearer mcl_live_abc' }, query: {} } as never;
  return { run: () => apiKeyAuth(req, { status, json } as unknown as Response, next), status, next };
}

const KEY = { id: 'k1', orgId: 'o1', createdById: 'u1', scopes: ['read'], revokedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.apiKey.update.mockResolvedValue({});
});

describe('apiKeyAuth', () => {
  it('accepts a live key whose creator is active', async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...KEY, createdBy: { isActive: true } });
    const c = call();
    await c.run();
    expect(c.next).toHaveBeenCalled();
  });

  it('rejects a key whose creator was removed from the org', async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...KEY, createdBy: { isActive: false } });
    const c = call();
    await c.run();
    expect(c.status).toHaveBeenCalledWith(401);
    expect(c.next).not.toHaveBeenCalled();
  });
});
