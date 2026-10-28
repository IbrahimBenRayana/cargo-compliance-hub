/**
 * The HTTP handler shared by /integrations/hts-classify and
 * /compliance/classify-hts: honest status codes, never a fake "no results".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => {
  class AiRateLimitedError extends Error {}
  class ClassifyInputError extends Error {}
  class HtsLimitError extends Error {
    constructor(message: string, public scope: string, public resetsAt: Date) { super(message); }
  }
  return {
    classifyProduct: vi.fn(), AiRateLimitedError, ClassifyInputError, HtsLimitError,
    release: vi.fn(), reserve: vi.fn(), cachedResult: vi.fn(), recordRepeat: vi.fn(async () => {}),
    usageFor: vi.fn(async () => ({ user: { used: 3, limit: 25, period: 'day' }, organization: { used: 40, limit: 300, period: 'month' } })),
  };
});
vi.mock('../limits.js', () => ({
  HtsLimitError: m.HtsLimitError, reserve: m.reserve, cachedResult: m.cachedResult, recordRepeat: m.recordRepeat, usageFor: m.usageFor,
}));
vi.mock('../index.js', () => ({ classifyProduct: m.classifyProduct, ClassifyInputError: m.ClassifyInputError }));
vi.mock('../../ai.js', () => ({ AiRateLimitedError: m.AiRateLimitedError }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { classifyHandler } from '../http.js';

function call(body: unknown) {
  const res = { statusCode: 200, body: undefined as any, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return classifyHandler({ body, user: { id: 'u1', orgId: 'o1', role: 'operator' } } as any, res as any).then(() => res);
}

describe('classifyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.reserve.mockResolvedValue(m.release);
    m.cachedResult.mockResolvedValue(null);
  });

  it('returns the classifier result', async () => {
    m.classifyProduct.mockResolvedValue({ status: 'ok', suggestions: [{ code: '8507600010' }] });
    const res = await call({ description: 'e-bike battery' });
    expect(res.statusCode).toBe(200);
    expect(res.body.suggestions[0].code).toBe('8507600010');
    expect(m.classifyProduct).toHaveBeenCalledWith('e-bike battery', { userId: 'u1', orgId: 'o1' });
    // with what is left of the allowance, and the slot is freed
    expect(res.body.usage.user).toMatchObject({ used: 3, limit: 25 });
    expect(m.release).toHaveBeenCalled();
  });

  it('answers a repeat from the stored result without AI and without using the allowance', async () => {
    m.cachedResult.mockResolvedValue({ status: 'ok', suggestions: [{ code: '8507600010' }] });
    const res = await call({ description: 'e-bike battery' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ repeat: true, suggestions: [{ code: '8507600010' }] });
    expect(m.classifyProduct).not.toHaveBeenCalled();
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.recordRepeat).toHaveBeenCalled();
  });

  it('429s with the reason, when it resets, and the usage, when a limit is reached', async () => {
    const resetsAt = new Date('2026-11-01T00:00:00Z');
    m.reserve.mockRejectedValue(new m.HtsLimitError('Your organization has used its 300 HTS classifications for this month.', 'org_monthly', resetsAt));
    const res = await call({ description: 'e-bike battery' });
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/organization/), limit: 'org_monthly', resetsAt: resetsAt.toISOString() });
    expect(res.body.usage.organization.limit).toBe(300);
    expect(m.classifyProduct).not.toHaveBeenCalled();
  });

  it('frees the slot when the classification fails', async () => {
    m.classifyProduct.mockRejectedValue(new Error('db down'));
    await call({ description: 'x y' });
    expect(m.release).toHaveBeenCalled();
  });

  it('400s a missing description', async () => {
    expect((await call({})).statusCode).toBe(400);
  });

  it('400s with the reason when the input is rejected', async () => {
    m.classifyProduct.mockRejectedValue(new m.ClassifyInputError('Describe the product to classify.'));
    const res = await call({ description: ' ' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Describe/);
  });

  it('429s when the daily AI budget is used up', async () => {
    m.classifyProduct.mockRejectedValue(new m.AiRateLimitedError('limit'));
    const res = await call({ description: 'x y' });
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/daily/i);
  });

  it('503s honestly on any other failure', async () => {
    m.classifyProduct.mockRejectedValue(new Error('db down'));
    const res = await call({ description: 'x y' });
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('HTS suggestions are temporarily unavailable.');
  });
});
