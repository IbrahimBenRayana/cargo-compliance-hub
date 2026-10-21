/**
 * The whole classifier flow, each branch: clear, vague, AI down, no match,
 * second check disagrees, and the audit log.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScheduleLine } from '../retrieve.js';

const m = vi.hoisted(() => ({
  understandProduct: vi.fn(),
  classifyAmong: vi.fn(),
  chooseHeadings: vi.fn(),
  secondOpinion: vi.fn(),
  isConfigured: vi.fn(() => true),
  create: vi.fn(async () => ({})),
  findMany: vi.fn(),
  findPrecedents: vi.fn(async () => [] as unknown[]),
  precedentEnabled: vi.fn(() => true),
}));
vi.mock('../precedent.js', async (orig) => ({ ...(await orig<object>()), findPrecedents: m.findPrecedents }));
vi.mock('../llm.js', () => ({ classifierModel: () => 'test-model', precedentEnabled: m.precedentEnabled }));
vi.mock('../understand.js', () => ({ understandProduct: m.understandProduct }));
vi.mock('../classify.js', () => ({ classifyAmong: m.classifyAmong, chooseHeadings: m.chooseHeadings }));
vi.mock('../verify.js', () => ({ secondOpinion: m.secondOpinion }));
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
  searchTerms: ['lithium-ion batteries', 'electrically powered vehicles'], likelyHeadings: ['8507'], rulingQueries: ['e-bike battery'], ...over,
});
const ctx = { userId: 'u1', orgId: 'o1' };

describe('classifyProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScheduleCache();
    m.isConfigured.mockReturnValue(true);
    m.precedentEnabled.mockReturnValue(true);
    m.findPrecedents.mockResolvedValue([]);
    m.findMany.mockResolvedValue(ROWS);
    m.chooseHeadings.mockResolvedValue([{ heading: '8507', confidence: 0.95, reason: 'storage battery' }]);
  });

  it('returns verified, labelled suggestions with duty and the notice', async () => {
    m.understandProduct.mockResolvedValue(U());
    m.classifyAmong.mockResolvedValue({ picks: [
      { code: '8507600010', confidence: 0.93, reason: 'Li-ion, powers an e-bike' },
      { code: '8507600090', confidence: 0.2, reason: 'If not for a vehicle' },
    ], noneFit: false, concerns: [], droppedInvented: 0 });
    m.secondOpinion.mockResolvedValue({ code: '8507600010', reason: 'same' });

    const r = await classifyProduct('36V li-ion battery pack for e-bikes', ctx);
    // the AI sees every line of the chosen heading, not a keyword subset
    expect(m.classifyAmong.mock.calls[0][2].map((c: { code: string }) => c.code)).toEqual(['8507600010', '8507600090']);
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
    m.secondOpinion.mockResolvedValue({ code: '8507600090', reason: 'same' });
    const r = await classifyProduct('li-ion battery', ctx);
    expect(r.status).toBe('needs_detail');
    expect(r.suggestions[0].confidence).toBe('medium');
    expect(r.questions).toEqual(['Is it for an electric vehicle?']);
  });

  it('shows when the blind second opinion chose a different line, and lists its pick', async () => {
    m.understandProduct.mockResolvedValue(U());
    m.classifyAmong.mockResolvedValue({ picks: [{ code: '8507600090', confidence: 0.95, reason: 'r' }], noneFit: false, concerns: [], droppedInvented: 0 });
    m.secondOpinion.mockResolvedValue({ code: '8507600010', reason: 'It powers a vehicle.' });
    const r = await classifyProduct('e-bike battery', ctx);
    expect(r.suggestions[0].confidence).toBe('medium'); // same subheading 8507.60, different line
    expect(r.suggestions[0].warnings?.[0]).toMatch(/second, independent check chose 8507\.60\.00\.10/i);
    expect(r.suggestions.map((s) => s.code)).toContain('8507600010');
  });

  it('marks the pick low when the second opinion lands in another heading', async () => {
    m.chooseHeadings.mockResolvedValue([{ heading: '8507', confidence: 0.6, reason: 'r' }, { heading: '8711', confidence: 0.4, reason: 'r' }]);
    m.understandProduct.mockResolvedValue(U());
    m.classifyAmong.mockResolvedValue({ picks: [{ code: '8507600010', confidence: 0.95, reason: 'r' }], noneFit: false, concerns: [], droppedInvented: 0 });
    m.secondOpinion.mockResolvedValue({ code: '8711600010', reason: 'It is the bike.' });
    const r = await classifyProduct('e-bike', ctx);
    expect(r.suggestions[0].confidence).toBe('low');
    // the runner-up heading's lines were offered too
    expect(m.classifyAmong.mock.calls[0][2].map((c: { code: string }) => c.code)).toContain('8711600010');
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

  describe('v3: precedent, notes, deciding questions', () => {
    const PICKS = (a: number, b: number) => ({ picks: [
      { code: '8507600010', confidence: a, reason: 'r' }, { code: '8507600090', confidence: b, reason: 'r' },
    ], noneFit: false, concerns: [], droppedInvented: 0 });

    it('searches CROSS with the ruling queries, excluding what the caller excludes, and shares precedent and notes with every step', async () => {
      m.understandProduct.mockResolvedValue(U({ likelyHeadings: [] }));
      m.findPrecedents.mockResolvedValue([{ ruling: 'N311074', date: '2020-05-01', subject: 'e-bike from China', codes: ['8711600090'] }]);
      m.classifyAmong.mockResolvedValue(PICKS(0.93, 0.1));
      m.secondOpinion.mockResolvedValue({ code: '8507600010', reason: 'same' });
      await classifyProduct('36V li-ion battery pack for e-bikes', { ...ctx, excludeRulings: ['N999999'] });
      expect(m.findPrecedents).toHaveBeenCalledWith(['e-bike battery'], expect.objectContaining({ exclude: ['N999999'] }));
      // the precedent's heading is among the headings to decide between
      expect(m.chooseHeadings.mock.calls[0][2].map((h: { heading: string }) => h.heading)).toContain('8711');
      const headingCtx = m.chooseHeadings.mock.calls[0][4];
      expect(headingCtx.precedent).toContain('N311074');
      expect(headingCtx.notes).toMatch(/Chapter 85 notes/);
      expect(m.classifyAmong.mock.calls[0][4].notes).toMatch(/Chapter 85 notes/);
      expect(m.secondOpinion.mock.calls[0][4].precedent).toContain('N311074');
    });

    it('runs without precedent when it is switched off', async () => {
      m.precedentEnabled.mockReturnValue(false);
      m.understandProduct.mockResolvedValue(U());
      m.classifyAmong.mockResolvedValue(PICKS(0.93, 0.1));
      m.secondOpinion.mockResolvedValue({ code: '8507600010', reason: 'same' });
      await classifyProduct('e-bike battery', ctx);
      expect(m.findPrecedents).not.toHaveBeenCalled();
      expect(m.chooseHeadings.mock.calls[0][4].precedent).toBeFalsy();
    });

    it('asks the deciding question when a missing fact separates close lines, even if the description seemed enough', async () => {
      m.understandProduct.mockResolvedValue(U());
      m.classifyAmong.mockResolvedValue({ ...PICKS(0.55, 0.4), decidingQuestion: 'Is it the main power source of an electric vehicle?' });
      m.secondOpinion.mockResolvedValue({ code: '8507600010', reason: 'same' });
      const r = await classifyProduct('li-ion battery pack', ctx);
      expect(r.status).toBe('needs_detail');
      expect(r.questions?.[0]).toBe('Is it the main power source of an electric vehicle?');
      expect(r.suggestions.length).toBeGreaterThan(0);
      expect(r.suggestions[0].confidence).not.toBe('high');
    });

    it('asks the deciding question when the two checks disagree', async () => {
      m.understandProduct.mockResolvedValue(U());
      m.classifyAmong.mockResolvedValue({ ...PICKS(0.95, 0.05), decidingQuestion: 'Is it for a vehicle?' });
      m.secondOpinion.mockResolvedValue({ code: '8507600090', reason: 'Not shown to be for a vehicle.' });
      const r = await classifyProduct('li-ion battery pack', ctx);
      expect(r.status).toBe('needs_detail');
      expect(r.questions).toContain('Is it for a vehicle?');
    });

    it('does not ask when the pick is clear-cut and both checks agree', async () => {
      m.understandProduct.mockResolvedValue(U());
      m.classifyAmong.mockResolvedValue({ ...PICKS(0.93, 0.05), decidingQuestion: 'Is it for a vehicle?' });
      m.secondOpinion.mockResolvedValue({ code: '8507600010', reason: 'same' });
      const r = await classifyProduct('36V li-ion battery pack for e-bikes', ctx);
      expect(r.status).toBe('ok');
      expect(r.suggestions[0].confidence).toBe('high');
    });
  });
});
