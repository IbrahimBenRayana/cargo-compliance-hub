/**
 * A removed (deactivated) member must not get a session from /login
 * (testing week TEAM-01: they got 200 + tokens, then every request 401'd).
 * Same answer as a wrong password, so removal isn't revealed either.
 */
import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const { prisma } = vi.hoisted(() => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import router from '../auth.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const login = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === '/login' && l.route.methods.post)!.route!.stack.at(-1)!.handle;

describe('POST /auth/login', () => {
  it('refuses a deactivated member with the wrong-password answer and issues no tokens', async () => {
    const password = 'Correct-horse-1';
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'gone@example.com', isActive: false, failedAttempts: 0, lockedUntil: null,
      passwordHash: await bcrypt.hash(password, 4), mfaEnabled: false, organization: { id: 'o1' },
    });
    const res = { statusCode: 200, body: undefined as unknown, cookie: vi.fn(), status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
    await login({ body: { email: 'gone@example.com', password }, headers: {}, ip: '127.0.0.1', get: () => '' }, res, vi.fn());
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
