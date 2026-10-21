/**
 * The whole classifier flow, each branch: clear, vague, AI down, no match,
 * second check disagrees, and the audit log.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScheduleLine } from '../retrieve.js';

const m = vi.hoisted(() => ({
  understandProduct: vi.fn(),
  classifyAmong: vi.fn(),
  verifyPick: vi.fn(),
  isConfigured: vi.fn(() => true),
  create: vi.fn(async () => ({})),
  findMany: vi.fn(),
}));
vi.mock('../understand.js', () => ({ understandProduct: m.understandProduct }));
vi.mock('../classify.js', () => ({ classifyAmong: m.classifyAmong }));
vi.mock('../verify.js', () => ({ verifyPick: m.verifyPick }));
vi.mock('../../ai.js', () => ({ isConfigured: m.isConfigured, AiRateLimitedError: class extends Error {} }));
vi.mock('../../../config/database.js', () => ({ prisma: { htsRateLine: { findMany: m.findMany }, htsClassification: { create: m.create } } }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { classifyProduct, resetScheduleCache } from '../index.js';

const ROWS: (ScheduleLine & { htsNumber: string; revision: string })[] = [
  ['8507600010', 'Electric storage batteries > Lithium-ion batteries > For electrically powered vehicles', '3.4%'],
  ['8507600090', 'Electric storage batteries > Lithium-ion batteries > Other > Other', '3.4%'],
  ['8711600010', 'Motorcycles and cycles fitted with an auxiliary motor > With electric motor > Bicycles', 'Free'],
  ['85076000', 'Electric storage batteries > Lithium-ion batteries', '3.4%'],
].map(([code, pathText, generalRate]) => ({ htsNumber: code, code, pathText, description: pathText.split(' > ').at(-1)!, generalRate, units: ['No.'], revision: '2026-test' }));

const U = (over = {}) => ({
  product: 'li-ion e-bike battery', facts: {}, sufficiency: 'enough', missing: [], questions: [], didYouMean: [],
  searchTerms: ['lithium-ion batteries', 'electrically powered vehicles'], likelyHeadings: ['8507'], ...over,
});
const ctx = { userId: 'u1', orgId: 'o1' };

describe('classifyProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScheduleCache();
    m.isConfigured.mockReturnValue(true);
    m.findMany.mockResolvedValue(ROWS);
  });

  it('returns verified, labelled suggestions with duty and the notice', async () => {
    m.understandProduct.mockResolvedValue(U());
    m.classifyAmong.mockResolvedValue({ picks: [
      { code: '8507600010', confidence: 0.93, reason: 'Li-ion, powers an e-bike' },
      { code: '8507600090', confidence: 0.2, reason: 'If not for a vehicle' },
    ], noneFit: false, concerns: [], droppedInvented: 0 });
    m.verifyPick.mockResolvedValue({ fits: true, confidence: 0.9, issue: null });

    const r = await classifyProduct('36V li-ion battery pack for e-bikes', ctx);
    expect(r.status).toBe('ok');
    expect(r.suggestions[0]).toMatchObject({ code: '8507600010', confidence: 'high', generalRate: '3.4%', score: 0.93 });
    expect(r.suggestions[0].description).toContain('Lithium-ion');
    expect(r.notice).toMatch(/not a binding classification/);
    expect(r.revision).toBe('2026-test');
    // only 10-digit lines are ever suggested
    expect(r.suggestions.every((s) => s.code.length === 10)).toBe(true);
  });

  it('asks instead of guessing when the description is too vague', async () => {
    m.understandProduct.mockResolvedValue(U({ sufficiency: 'too_vague', questions: ['Rechargeable?'], didYouMean: ['Lithium-ion e-bike battery pack'] }));
    const r = await classifyProduct('battery', ctx);
    expect(r).toMatchObject({ status: 'needs_detail', suggestions: [], questions: ['Rechargeable?'], didYouMean: ['Lithium-ion e-bike battery pack'] });
    expect(m.classifyAmong).not.toHaveBeenCalled();
  });

  it('gives suggestions and questions together when only the heading is clear', async () => {
    m.understandProduct.mockResolvedValue(U({ sufficiency: 'heading_only', questions: ['Is it for an electric vehicle?'] }));
    m.classifyAmong.mockResolvedValue({ picks: [{ code: '8507600090', confidence: 0.9, reason: 'r' }], noneFit: false, concerns: [], droppedInvented: 0 });
    m.verifyPick.mockResolvedValue({ fits: true, confidence: 0.9, issue: null });
    const r = await classifyProduct('li-ion battery', ctx);
    expect(r.status).toBe('needs_detail');
    expect(r.suggestions[0].confidence).toBe('medium');
    expect(r.questions).toEqual(['Is it for an electric vehicle?']);
  });

  it('shows the second check\'s objection and marks the pick low', async () => {
    m.understandProduct.mockResolvedValue(U());
    m.classifyAmong.mockResolvedValue({ picks: [{ code: '8507600090', confidence: 0.95, reason: 'r' }], noneFit: false, concerns: [], droppedInvented: 0 });
    m.verifyPick.mockResolvedValue({ fits: false, confidence: 0.8, issue: 'This is for a vehicle, so 8507.60.0010.' });
    const r = await classifyProduct('e-bike battery', ctx);
    expect(r.suggestions[0].confidence).toBe('low');
    expect(r.suggestions[0].warnings?.[0]).toMatch(/Second check/);
  });

  it('falls back to word matching, labelled as such, when AI is not configured', async () => {
    m.isConfigured.mockReturnValue(false);
    const r = await classifyProduct('lithium-ion batteries for electrically powered vehicles', ctx);
    expect(r.status).toBe('keyword_only');
    expect(r.suggestions[0]).toMatchObject({ code: '8507600010', confidence: null });
    expect(r.message).toMatch(/matching words only/);
  });

  it('falls back to word matching when the classify step fails', async () => {
    m.understandProduct.mockResolvedValue(U());
    m.classifyAmong.mockResolvedValue(null);
    const r = await classifyProduct('e-bike battery', ctx);
    expect(r.status).toBe('keyword_only');
  });

  it('says so plainly when nothing in the schedule matches', async () => {
    m.understandProduct.mockResolvedValue(U({ searchTerms: ['zzqx'], likelyHeadings: [] }));
    const r = await classifyProduct('zzqx', ctx);
    expect(r).toMatchObject({ status: 'no_match', suggestions: [] });
  });

  it('records every classification in the audit log', async () => {
    m.understandProduct.mockResolvedValue(U({ sufficiency: 'too_vague' }));
    await classifyProduct('battery', ctx);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ orgId: 'o1', userId: 'u1', description: 'battery', status: 'needs_detail' }),
    }));
  });

  it('rejects descriptions that are empty or too long', async () => {
    await expect(classifyProduct('  ', ctx)).rejects.toThrow(/describe/i);
    await expect(classifyProduct('x'.repeat(1001), ctx)).rejects.toThrow(/1000/);
  });
});
