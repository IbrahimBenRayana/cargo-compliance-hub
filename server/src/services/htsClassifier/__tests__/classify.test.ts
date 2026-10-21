/**
 * Steps 4-5: the AI picks from real candidates only, and an independent
 * pass checks the top pick.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock('../../ai.js', () => ({ complete }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { env } from '../../../config/env.js';
import { classifyAmong, chooseHeadings } from '../classify.js';
import { secondOpinion } from '../verify.js';
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
  missing: [], questions: [], didYouMean: [], searchTerms: [], likelyHeadings: ['8507'], rulingQueries: [],
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

  it('returns the deciding question when a missing fact separates the top lines', async () => {
    reply({ picks: [{ code: '8507600010', confidence: 0.5, reason: 'r' }, { code: '8507600090', confidence: 0.45, reason: 'r' }], noneFit: false, concerns: [], decidingQuestion: 'Is the battery the main power source of an electric vehicle?' });
    const r = (await classifyAmong('li-ion battery', U, CANDS, 'u1', { notes: 'Chapter 85 notes:\nStatistical notes:' }))!;
    expect(r.decidingQuestion).toBe('Is the battery the main power source of an electric vehicle?');
    expect(complete.mock.calls[0][0].userPrompt).toContain('Statistical notes');
  });

  it('has no deciding question when the reply gives none', async () => {
    reply({ picks: [{ code: '8507600010', confidence: 0.9, reason: 'r' }], noneFit: false, concerns: [], decidingQuestion: '' });
    expect((await classifyAmong('x', U, CANDS, 'u1'))!.decidingQuestion).toBeUndefined();
  });

  it('clamps confidence into 0..1', async () => {
    reply({ picks: [{ code: '8507600090', confidence: 7, reason: 'r' }], noneFit: false, concerns: [] });
    expect((await classifyAmong('x', U, CANDS, 'u1'))!.picks[0].confidence).toBe(1);
  });
});

describe('chooseHeadings', () => {
  beforeEach(() => complete.mockReset());
  const HEADINGS = [
    { heading: '8507', text: 'Electric storage batteries', lineCount: 20 },
    { heading: '8506', text: 'Primary cells and primary batteries', lineCount: 12 },
  ];

  it('returns the ranked headings from the list only', async () => {
    reply({ headings: [
      { heading: '8507', confidence: 0.9, reason: 'Rechargeable storage battery' },
      { heading: '8599', confidence: 0.5, reason: 'invented' },
      { heading: '8506', confidence: 0.1, reason: 'Only if not rechargeable' },
    ] });
    const r = (await chooseHeadings('e-bike battery', U, HEADINGS, 'u1'))!;
    expect(r.map((h) => h.heading)).toEqual(['8507', '8506']);
  });

  it('returns null when the reply is unusable', async () => {
    complete.mockResolvedValueOnce('nope');
    expect(await chooseHeadings('x', U, HEADINGS, 'u1')).toBeNull();
  });

  it('gives the AI the precedent rulings and the legal notes', async () => {
    reply({ headings: [{ heading: '8507', confidence: 0.9, reason: 'r' }] });
    await chooseHeadings('e-bike battery', U, HEADINGS, 'u1', { precedent: '1. N311074 (2020-05-01): e-bike battery -> 8507.60.0020', notes: 'Chapter 85 notes:\n1. This chapter does not cover:' });
    const { userPrompt, systemPrompt } = complete.mock.calls[0][0];
    expect(userPrompt).toContain('N311074');
    expect(userPrompt).toContain('Chapter 85 notes');
    expect(systemPrompt).toMatch(/renumbered/);
  });
});

describe('secondOpinion', () => {
  beforeEach(() => complete.mockReset());

  it('returns its own independent pick from the same lines', async () => {
    reply({ code: '8507600090', reason: 'Not shown to be for a vehicle' });
    expect(await secondOpinion('li-ion battery', U, CANDS, 'u1')).toEqual({ code: '8507600090', reason: 'Not shown to be for a vehicle' });
    // it is never told the first pick
    expect(complete.mock.calls[0][0].userPrompt).not.toMatch(/proposed|first pick/i);
  });

  it('runs on the verification model when one is set, so agreement spans two models', async () => {
    const before = env.HTS_AI_VERIFY_MODEL;
    env.HTS_AI_VERIFY_MODEL = 'gpt-4.1';
    try {
      reply({ code: '8507600090', reason: 'r' });
      await secondOpinion('li-ion battery', U, CANDS, 'u1', { precedent: '1. N1 (2020-01-01): x -> 8507.60.0090' });
      expect(complete.mock.calls[0][0].model).toBe('gpt-4.1');
      expect(complete.mock.calls[0][0].userPrompt).toContain('N1 (2020-01-01)');
    } finally {
      env.HTS_AI_VERIFY_MODEL = before;
    }
  });

  it('ignores a code outside the lines', async () => {
    reply({ code: '9999999999', reason: 'x' });
    expect(await secondOpinion('x', U, CANDS, 'u1')).toBeNull();
  });

  it('returns null when it could not run', async () => {
    complete.mockRejectedValueOnce(new Error('timeout'));
    expect(await secondOpinion('x', U, CANDS, 'u1')).toBeNull();
  });
});
