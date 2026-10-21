/**
 * The HTTP handler shared by /integrations/hts-classify and
 * /compliance/classify-hts: honest status codes, never a fake "no results".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => {
  class AiRateLimitedError extends Error {}
  class ClassifyInputError extends Error {}
  return { classifyProduct: vi.fn(), AiRateLimitedError, ClassifyInputError };
});
vi.mock('../index.js', () => ({ classifyProduct: m.classifyProduct, ClassifyInputError: m.ClassifyInputError }));
vi.mock('../../ai.js', () => ({ AiRateLimitedError: m.AiRateLimitedError }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { classifyHandler } from '../http.js';

function call(body: unknown) {
  const res = { statusCode: 200, body: undefined as any, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return classifyHandler({ body, user: { id: 'u1', orgId: 'o1', role: 'operator' } } as any, res as any).then(() => res);
}

describe('classifyHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the classifier result', async () => {
    m.classifyProduct.mockResolvedValue({ status: 'ok', suggestions: [{ code: '8507600010' }] });
    const res = await call({ description: 'e-bike battery' });
    expect(res.statusCode).toBe(200);
    expect(res.body.suggestions[0].code).toBe('8507600010');
    expect(m.classifyProduct).toHaveBeenCalledWith('e-bike battery', { userId: 'u1', orgId: 'o1' });
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
