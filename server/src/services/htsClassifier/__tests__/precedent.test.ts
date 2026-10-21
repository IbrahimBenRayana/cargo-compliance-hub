/**
 * CBP CROSS precedent: search, merge, exclude (evaluation honesty), excerpt,
 * cache, and failing soft.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../config/logger.js', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { excerptOf, findPrecedents, formatPrecedents, precedentHeadings, resetPrecedentCache } from '../precedent.js';

const hit = (rulingNumber: string, tariffs: string, extra: Record<string, unknown> = {}) => ({
  rulingNumber, subject: `The tariff classification of goods ${rulingNumber}`, rulingDate: '2024-01-02T00:00:00',
  collection: 'ny', relatedRulings: [], revokedBy: [], operationallyRevoked: false, tariffs, ...extra,
});

const TEXT = (n: string, extra = '') =>
  `${n} January 8, 2010 CLA-2-63 TARIFF NO.: 6307.90.7500 RE: The tariff classification of cat toy from Taiwan Dear Mr. Pacis: In your letter dated January 5, 2010, you requested a tariff classification ruling. The submitted sample is a textile cat toy. The cat toy is made of knit pile polyester fabric stuffed with catnip. ${extra}The applicable subheading for the cat toy will be 6307.90.7500, HTSUS, which provides for toys for pets, of textile materials. The duty rate will be 4.3% ad valorem. This ruling is being issued under 19 CFR Part 177.`;

let searches: Record<string, unknown[]>;
let texts: Record<string, string>;
const fetchMock = vi.fn(async (url: string) => {
  const u = new URL(url);
  if (u.pathname === '/api/search') {
    const rulings = searches[u.searchParams.get('term')!] ?? [];
    return { ok: true, json: async () => ({ rulings, totalHits: rulings.length }) };
  }
  const n = u.pathname.split('/').pop()!;
  return { ok: true, json: async () => ({ rulingNumber: n, text: texts[n] ?? TEXT(n) }) };
});

beforeEach(() => {
  resetPrecedentCache();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  texts = {};
  searches = {
    'cat toy': [hit('N089919', '6307.90.7500'), hit('N360066', '3924.90.5650'), hit('K84084', '9503.49.0000')],
    'pet toy': [hit('N360066', '3924.90.5650'), hit('N111111', '6307.90.7500, 9903.88.15')],
  };
});
afterEach(() => vi.unstubAllGlobals());

describe('findPrecedents', () => {
  it('merges queries, ranking rulings found by several queries first', async () => {
    const ps = await findPrecedents(['cat toy', 'pet toy']);
    expect(ps[0].ruling).toBe('N360066');
    expect(ps.map((p) => p.ruling)).toEqual(expect.arrayContaining(['N089919', 'K84084', 'N111111']));
    // chapter 99 numbers are not classification precedent
    expect(ps.find((p) => p.ruling === 'N111111')!.codes).toEqual(['6307907500']);
  });

  it('prefers recent rulings, whose codes match today\'s schedule more often', async () => {
    searches['cat toy'] = [hit('889270', '6405.90.9000', { rulingDate: '1993-05-01T00:00:00' }), hit('N350000', '6405.90.9000', { rulingDate: '2024-05-01T00:00:00' })];
    const ps = await findPrecedents(['cat toy']);
    expect(ps.map((p) => p.ruling)).toEqual(['N350000', '889270']);
  });

  it('drops revoked rulings and rulings without a tariff number', async () => {
    searches['cat toy'] = [hit('N1', '6307.90.7500', { revokedBy: ['H2'] }), hit('N3', ''), hit('N4', '6307.90.7500', { operationallyRevoked: true }), hit('N5', '9503.00.0073')];
    const ps = await findPrecedents(['cat toy']);
    expect(ps.map((p) => p.ruling)).toEqual(['N5']);
  });

  it('excludes the ruling under evaluation and any ruling that cites it', async () => {
    searches['cat toy'] = [
      hit('N360066', '3924.90.5650'),
      hit('N222222', '3924.90.5650', { relatedRulings: ['N360066'] }),
      hit('N333333', '3924.90.5650'),
      hit('N444444', '6307.90.7500'),
    ];
    texts.N333333 = TEXT('N333333', 'Consistent with New York ruling N360066, ');
    const ps = await findPrecedents(['cat toy'], { exclude: ['n360066'] });
    expect(ps.map((p) => p.ruling)).toEqual(['N444444']);
  });

  it('adds an excerpt (the goods and the holding) for the best few', async () => {
    const ps = await findPrecedents(['cat toy'], { withText: 1 });
    expect(ps[0].excerpt).toMatch(/knit pile polyester/);
    expect(ps[0].excerpt).toMatch(/applicable subheading/);
    expect(ps[0].excerpt).not.toMatch(/duty rate|19 CFR/);
    expect(ps[1].excerpt).toBeUndefined();
  });

  it('caches searches and ruling texts', async () => {
    await findPrecedents(['cat toy'], { withText: 1 });
    const calls = fetchMock.mock.calls.length;
    await findPrecedents(['cat toy'], { withText: 1 });
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('fails soft: a CROSS outage means no precedent, not an error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(findPrecedents(['cat toy'])).resolves.toEqual([]);
  });

  it('skips empty queries without calling CROSS', async () => {
    await expect(findPrecedents(['', '  '])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('precedent helpers', () => {
  it('lists the headings the precedent points to, most supported first', () => {
    const ps = [
      { ruling: 'A', date: '2024-01-01', subject: 's', codes: ['3924905650'] },
      { ruling: 'B', date: '2024-01-01', subject: 's', codes: ['6307907500'] },
      { ruling: 'C', date: '2024-01-01', subject: 's', codes: ['6307907500', '9503000073'] },
    ];
    expect(precedentHeadings(ps)).toEqual(['6307', '3924', '9503']);
  });

  it('formats precedent for a prompt, with codes dotted and excerpts', () => {
    const text = formatPrecedents([{ ruling: 'N089919', date: '2010-01-08', subject: 'The tariff classification of cat toy from Taiwan', codes: ['6307907500'], excerpt: 'Textile cat toy.' }]);
    expect(text).toContain('N089919 (2010-01-08)');
    expect(text).toContain('6307.90.7500');
    expect(text).toContain('Textile cat toy.');
  });

  it('excerpts the goods and holding from a ruling text', () => {
    const e = excerptOf(TEXT('N089919'));
    expect(e).toMatch(/textile cat toy/);
    expect(e).toMatch(/applicable subheading/);
    expect(e).not.toMatch(/letter dated/);
    expect(e.length).toBeLessThanOrEqual(900);
  });
});
