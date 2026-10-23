/**
 * Usage limits for the HTS classifier (spec "Usage limits"): one unit per
 * classification, counted from the audit table plus requests in flight.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ count: vi.fn(), findFirst: vi.fn(), create: vi.fn(async (_args: any) => ({})) }));
vi.mock('../../../config/database.js', () => ({ prisma: { htsClassification: { count: m.count, findFirst: m.findFirst, create: m.create } } }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { env } from '../../../config/env.js';
import { auditStatus, cachedResult, HtsLimitError, recordRepeat, reserve, usageFor } from '../limits.js';

const A = { userId: 'u1', orgId: 'o1' };
const B = { userId: 'u2', orgId: 'o1' };

/** Which window a count() asks about, from its where clause. */
function scope(where: any): 'minute' | 'userDay' | 'orgMonth' | 'global' | 'globalMonth' {
  if (where.userId) return Date.now() - where.createdAt.gte.getTime() < 120_000 ? 'minute' : 'userDay';
  if (where.orgId) return 'orgMonth';
  return where.createdAt.gte.getUTCDate() === 1 && where.createdAt.gte.getUTCDate() !== new Date().getUTCDate() ? 'globalMonth' : 'global';
}
let counts: Record<string, number>;

beforeEach(() => {
  vi.clearAllMocks();
  counts = { minute: 0, userDay: 0, orgMonth: 0, global: 0, globalMonth: 0 };
  m.count.mockImplementation(async ({ where }: any) => counts[scope(where)]);
  Object.assign(env, { HTS_LIMIT_PER_MINUTE: 3, HTS_LIMIT_USER_DAILY: 25, HTS_LIMIT_ORG_MONTHLY: 300, HTS_LIMIT_GLOBAL_DAILY: 500, HTS_LIMIT_GLOBAL_MONTHLY: 900 });
});

const limitError = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e as HtsLimitError; }
  throw new Error('expected a limit error');
};

describe('reserve', () => {
  it('lets a request through under every limit, and frees the slot on release', async () => {
    const release = await reserve(A);
    release();
    (await reserve(A))();
  });

  it('allows one classification at a time per user', async () => {
    const release = await reserve(A);
    const e = await limitError(reserve(A));
    expect(e.scope).toBe('in_flight');
    expect(e.message).toMatch(/still running/i);
    release();
    (await reserve(A))();
  });

  it('limits bursts per minute', async () => {
    counts.minute = 3;
    const e = await limitError(reserve(A));
    expect(e.scope).toBe('per_minute');
    expect(e.message).toMatch(/3 .*a minute/i);
  });

  it('limits each user per day, saying when it resets and that repeats are free', async () => {
    counts.userDay = 25;
    const e = await limitError(reserve(A));
    expect(e.scope).toBe('user_daily');
    expect(e.message).toMatch(/25 HTS classifications for today/);
    expect(e.message).toMatch(/midnight UTC/);
    expect(e.message).toMatch(/same description/i);
    expect(e.resetsAt.getUTCHours()).toBe(0);
  });

  it('limits each organization per month, counting requests in flight', async () => {
    env.HTS_LIMIT_ORG_MONTHLY = 1;
    const release = await reserve(A);
    const e = await limitError(reserve(B));
    expect(e.scope).toBe('org_monthly');
    expect(e.message).toMatch(/organization has used its 1 HTS classification/);
    expect(e.resetsAt.getUTCDate()).toBe(1);
    release();
  });

  it('caps the whole platform per day without exposing the number', async () => {
    counts.global = 500;
    const e = await limitError(reserve(A));
    expect(e.scope).toBe('global_daily');
    expect(e.message).not.toMatch(/500/);
    expect(e.message).toMatch(/try again later/i);
  });

  it('caps the whole platform per month (the AI budget), without exposing the number', async () => {
    // a month-start window differs from today's only after the 1st
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
    try {
      counts.globalMonth = 900;
      const e = await limitError(reserve(A));
      expect(e.scope).toBe('global_monthly');
      expect(e.message).not.toMatch(/900/);
      expect(e.resetsAt.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts only classifications that ran the AI to an answer', async () => {
    (await reserve(A))();
    const where = m.count.mock.calls.map((c) => c[0].where).find((w) => scope(w) === 'userDay');
    expect(where.model).toEqual({ notIn: ['none', 'cache'] });
    expect(where.status).toEqual({ notIn: ['too_vague', 'keyword_only'] });
  });
});

describe('usageFor', () => {
  it('reports what the user and the organization have used and left', async () => {
    counts.userDay = 4;
    counts.orgMonth = 40;
    const u = await usageFor(A);
    expect(u.user).toMatchObject({ used: 4, limit: 25, period: 'day' });
    expect(u.organization).toMatchObject({ used: 40, limit: 300, period: 'month' });
  });
});

describe('repeats are free', () => {
  it('returns the organization\'s stored answer for the same description within 24 hours', async () => {
    m.findFirst.mockResolvedValue({ result: { status: 'ok', suggestions: [{ code: '8507600010' }] } });
    const r = await cachedResult('o1', '  E-bike battery ');
    expect(r).toMatchObject({ status: 'ok' });
    const where = m.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ orgId: 'o1', description: { equals: 'E-bike battery', mode: 'insensitive' } });
    expect(Date.now() - where.createdAt.gte.getTime()).toBeGreaterThan(23 * 3600_000);
    expect(where.status).toEqual({ in: ['ok', 'needs_detail', 'no_match'] });
  });

  it('has nothing for a new description', async () => {
    m.findFirst.mockResolvedValue(null);
    expect(await cachedResult('o1', 'new thing')).toBeNull();
  });

  it('logs a repeat as free', async () => {
    await recordRepeat(A, 'e-bike battery', { status: 'ok', suggestions: [] } as any);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ model: 'cache', orgId: 'o1', userId: 'u1' });
  });
});

describe('auditStatus', () => {
  it('marks a too-vague answer (asked, no codes) so it is not counted', () => {
    expect(auditStatus({ status: 'needs_detail', suggestions: [] } as any)).toBe('too_vague');
    expect(auditStatus({ status: 'needs_detail', suggestions: [{}] } as any)).toBe('needs_detail');
    expect(auditStatus({ status: 'ok', suggestions: [{}] } as any)).toBe('ok');
  });
});
