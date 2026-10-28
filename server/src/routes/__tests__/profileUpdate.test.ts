/**
 * Settings > Profile 'Save Changes' always failed: the page sends the
 * (unchanged) email with the name, and the strict schema rejected the key
 * (testing week BUG-026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prisma } = vi.hoisted(() => ({ prisma: { user: { update: vi.fn() } } }));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import router from '../settings.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } }
const handler = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === '/profile' && l.route.methods.patch)!.route!.stack.at(-1)!.handle;

async function patch(body: unknown) {
  const res = { statusCode: 200, body: undefined as any, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  await handler({ body, user: { id: 'u1', orgId: 'o1', role: 'admin', email: 'me@example.com' } }, res, vi.fn());
  return res;
}

describe('PATCH /settings/profile', () => {
  beforeEach(() => prisma.user.update.mockReset().mockResolvedValue({ id: 'u1', email: 'me@example.com', firstName: 'Ann', lastName: 'Lee', role: 'admin' }));

  it('saves the name when the page also sends the unchanged email', async () => {
    const res = await patch({ firstName: 'Ann', lastName: 'Lee', email: 'me@example.com' });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { firstName: 'Ann', lastName: 'Lee' } }));
  });

  it('still refuses an email change', async () => {
    const res = await patch({ firstName: 'Ann', email: 'other@example.com' });
    expect(res.statusCode).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
