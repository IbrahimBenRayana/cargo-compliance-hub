/**
 * Steps 4-5: the AI picks from real candidates only, and an independent
 * pass checks the top pick.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock('../../ai.js', () => ({ complete }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { classifyAmong } from '../classify.js';
import { verifyPick } from '../verify.js';
import type { Candidate } from '../retrieve.js';
import type { Understanding } from '../understand.js';

const reply = (o: unknown) => complete.mockResolvedValueOnce(JSON.stringify(o));
const cand = (code: string, pathText: string): Candidate => ({ code, pathText, description: pathText.split(' > ').at(-1)!, generalRate: '3.4%', units: ['No.'], score: 1 });
const CANDS = [
  cand('8507600010', 'Electric storage batteries > Lithium-ion batteries > Of a kind used as the primary source of electrical power for electrically powered vehicles'),
  cand('8507600090', 'Electric storage batteries > Lithium-ion batteries > Other > Other'),
  cand('8506500010', 'Primary cells and primary batteries > Lithium > Cylindrical cells'),
];
const U: Understanding = {
  product: 'li-ion e-bike battery', facts: { use: 'powers e-bike motor' }, sufficiency: 'enough',
  missing: [], questions: [], didYouMean: [], searchTerms: [], likelyHeadings: ['8507'],
};

describe('classifyAmong', () => {
  beforeEach(() => complete.mockReset());

  it('returns the picks in order, with confidence and reason', async () => {
    reply({ picks: [
      { code: '8507600010', confidence: 0.9, reason: 'Lithium-ion; primary power source for an electrically powered vehicle' },
      { code: '8507600090', confidence: 0.3, reason: 'If not for a vehicle' },
    ], noneFit: false, concerns: [] });
    const r = (await classifyAmong('e-bike battery', U, CANDS, 'u1'))!;
    expect(r.picks.map((p) => p.code)).toEqual(['8507600010', '8507600090']);
    expect(r.picks[0]).toMatchObject({ confidence: 0.9 });
  });

  it('drops any code the AI invents that is not a candidate', async () => {
    reply({ picks: [
      { code: '8507609999', confidence: 0.95, reason: 'invented' },
      { code: '8507.60.00.10', confidence: 0.8, reason: 'dotted form of a real candidate' },
    ], noneFit: false, concerns: [] });
    const r = (await classifyAmong('e-bike battery', U, CANDS, 'u1'))!;
    expect(r.picks.map((p) => p.code)).toEqual(['8507600010']);
    expect(r.droppedInvented).toBe(1);
  });

  it('reports when none of the candidates fit', async () => {
    reply({ picks: [], noneFit: true, concerns: ['None of the candidates cover bicycle frames'] });
    const r = (await classifyAmong('bicycle frame', U, CANDS, 'u1'))!;
    expect(r.noneFit).toBe(true);
    expect(r.picks).toEqual([]);
  });

  it('returns null when the AI reply is unusable, so the caller can fall back', async () => {
    complete.mockResolvedValueOnce('not json');
    expect(await classifyAmong('x', U, CANDS, 'u1')).toBeNull();
  });

  it('clamps confidence into 0..1', async () => {
    reply({ picks: [{ code: '8507600090', confidence: 7, reason: 'r' }], noneFit: false, concerns: [] });
    expect((await classifyAmong('x', U, CANDS, 'u1'))!.picks[0].confidence).toBe(1);
  });
});

describe('verifyPick', () => {
  beforeEach(() => complete.mockReset());

  it('passes through a confirmed pick', async () => {
    reply({ fits: true, confidence: 0.9, issue: null });
    expect(await verifyPick('e-bike battery', U, CANDS[0], 'u1')).toEqual({ fits: true, confidence: 0.9, issue: null });
  });

  it('reports a disagreement with its reason', async () => {
    reply({ fits: false, confidence: 0.8, issue: 'Primary (non-rechargeable) cells belong in 8506 only if not rechargeable; this is rechargeable.' });
    const v = await verifyPick('rechargeable battery', U, CANDS[2], 'u1');
    expect(v).toMatchObject({ fits: false });
    expect(v!.issue).toMatch(/rechargeable/);
  });

  it('returns null when the check could not run', async () => {
    complete.mockRejectedValueOnce(new Error('timeout'));
    expect(await verifyPick('x', U, CANDS[0], 'u1')).toBeNull();
  });
});
