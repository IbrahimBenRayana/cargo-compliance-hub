/**
 * Step 1-2 of the native HTS classifier: read the product, judge whether the
 * description is enough, and expand it into tariff vocabulary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock('../../ai.js', () => ({ complete }));
vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { understandProduct } from '../understand.js';

const reply = (o: unknown) => complete.mockResolvedValueOnce(JSON.stringify(o));

describe('understandProduct', () => {
  beforeEach(() => complete.mockReset());

  it('returns the facts, search terms and likely headings for a clear description', async () => {
    reply({
      product: 'lithium-ion battery pack for electric bicycles',
      facts: { material: 'lithium-ion cells', function: 'stores electric energy', use: 'powers e-bike motor', state: 'assembled pack' },
      sufficiency: 'enough', missing: [], questions: [], didYouMean: [],
      searchTerms: ['lithium-ion batteries', 'electric storage batteries', 'electrically powered vehicles'],
      likelyHeadings: ['8507', '8714'],
    });
    const u = await understandProduct('36V 10Ah li-ion battery pack for e-bikes', 'u1');
    expect(u.sufficiency).toBe('enough');
    expect(u.searchTerms).toContain('lithium-ion batteries');
    expect(u.likelyHeadings).toEqual(['8507', '8714']);
  });

  it('flags a vague description with questions and did-you-mean readings', async () => {
    reply({
      product: 'battery', facts: {}, sufficiency: 'too_vague',
      missing: ['chemistry', 'rechargeable or not', 'use'],
      questions: ['Is it rechargeable?', 'What chemistry: lithium-ion, lead-acid, alkaline?'],
      didYouMean: ['Lithium-ion battery pack for electric bicycles', 'Alkaline AA primary batteries'],
      searchTerms: ['batteries'], likelyHeadings: ['8506', '8507'],
    });
    const u = await understandProduct('battery', 'u1');
    expect(u.sufficiency).toBe('too_vague');
    expect(u.questions.length).toBeGreaterThan(0);
    expect(u.didYouMean).toHaveLength(2);
  });

  it('caps the lists and drops anything that is not a 4-digit heading', async () => {
    reply({
      product: 'x', facts: {}, sufficiency: 'enough', missing: [],
      questions: ['1', '2', '3', '4', '5'], didYouMean: ['a', 'b', 'c', 'd', 'e', 'f'],
      searchTerms: Array.from({ length: 30 }, (_, i) => `term ${i}`),
      likelyHeadings: ['8507', '85', '8507.60', 'abcd', '9999', '0101'],
    });
    const u = await understandProduct('x', 'u1');
    expect(u.questions).toHaveLength(3);
    expect(u.didYouMean).toHaveLength(4);
    expect(u.searchTerms).toHaveLength(12);
    expect(u.likelyHeadings).toEqual(['8507', '9999', '0101']);
  });

  it('falls back to the raw description when the AI reply is not usable JSON', async () => {
    complete.mockResolvedValueOnce('Sorry, I cannot help with that.');
    const u = await understandProduct('steel hex bolts M8', 'u1');
    expect(u.sufficiency).toBe('unknown');
    expect(u.searchTerms).toEqual(['steel hex bolts M8']);
    expect(u.likelyHeadings).toEqual([]);
  });

  it('always includes the user\'s own words among the search terms', async () => {
    reply({ product: 'p', facts: {}, sufficiency: 'enough', missing: [], questions: [], didYouMean: [], searchTerms: ['screws and bolts'], likelyHeadings: [] });
    const u = await understandProduct('hex bolts', 'u1');
    expect(u.searchTerms).toEqual(['hex bolts', 'screws and bolts']);
  });
});
