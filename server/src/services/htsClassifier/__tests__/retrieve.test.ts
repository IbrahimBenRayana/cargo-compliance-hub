/**
 * Candidate retrieval for the native HTS classifier (spec step 3).
 * The fixture is a small slice of the schedule in the shape the loader
 * stores it: 10-digit lines with their full path text.
 */
import { describe, it, expect } from 'vitest';
import { buildIndex, retrieveCandidates, tokenize, type ScheduleLine } from '../retrieve.js';

const line = (code: string, pathText: string, generalRate = '3.4%'): ScheduleLine => ({
  code, pathText, description: pathText.split(' > ').at(-1)!, generalRate, units: ['No.'],
});

const SCHEDULE: ScheduleLine[] = [
  line('8507100030', 'Electric storage batteries, including separators therefor > Lead-acid, of a kind used for starting piston engines > Not exceeding 6 kg in weight', '3.5%'),
  line('8507208031', 'Electric storage batteries, including separators therefor > Other lead-acid storage batteries > Other > 6 V batteries', '3.5%'),
  line('8507600010', 'Electric storage batteries, including separators therefor > Lithium-ion batteries > Of a kind used as the primary source of electrical power for electrically powered vehicles'),
  line('8507600090', 'Electric storage batteries, including separators therefor > Lithium-ion batteries > Other > Other'),
  line('8506500010', 'Primary cells and primary batteries > Lithium > Cylindrical cells', '2.7%'),
  line('8711600010', 'Motorcycles (including mopeds) and cycles fitted with an auxiliary motor > With electric motor for propulsion > Bicycles', 'Free'),
  line('8714910000', 'Parts and accessories of vehicles of headings 8711 to 8713 > Of bicycles and other cycles > Frames and forks, and parts thereof', '3.9%'),
  line('8471300100', 'Automatic data processing machines > Portable automatic data processing machines, weighing not more than 10 kg, consisting of at least a central processing unit, a keyboard and a display', 'Free'),
  line('6109100012', "T-shirts, singlets, tank tops and similar garments, knitted or crocheted > Of cotton > Men's or boys' > T-shirts, all white, short hemmed sleeves", '16.5%'),
  line('6205200016', "Men's or boys' shirts > Of cotton > Other > Dress shirts", '19.7%'),
  line('7318156010', 'Screws, bolts, nuts > Threaded articles > Other screws and bolts, whether or not with their nuts or washers > Bolts and bolts and their nuts or washers entered or exported in the same shipment > Having shanks or threads with a diameter of less than 6 mm', '0%'),
  line('9405110000', 'Luminaires and lighting fittings > Chandeliers and other electric ceiling or wall lighting fittings > Designed for use solely with light-emitting diode (LED) light sources', '3.9%'),
];

describe('tokenize', () => {
  it('lowercases, drops filler words and folds simple plurals', () => {
    expect(tokenize('Batteries for the Bicycles, of cotton')).toEqual(['battery', 'bicycle', 'cotton']);
  });
});

describe('retrieveCandidates', () => {
  const index = buildIndex(SCHEDULE);

  it('finds lines by words that only appear on parent levels', () => {
    // "lithium-ion" lives on the 8-digit parent; the leaf just says "Other".
    const codes = retrieveCandidates(index, ['lithium-ion battery pack']).map((c) => c.code);
    expect(codes.slice(0, 2).sort()).toEqual(['8507600010', '8507600090']);
  });

  it('ranks the more specific match first', () => {
    const top = retrieveCandidates(index, ['lithium-ion batteries', 'electrically powered vehicles'])[0];
    expect(top.code).toBe('8507600010');
  });

  it('keeps several headings in the pool, not just the one with the most matching words', () => {
    const headings = new Set(retrieveCandidates(index, ['electric bicycle battery']).map((c) => c.code.slice(0, 4)));
    expect(headings).toContain('8507');
    expect(headings).toContain('8711');
  });

  it('carries the duty rate and full path for each candidate', () => {
    const c = retrieveCandidates(index, ['cotton t-shirt'])[0];
    expect(c).toMatchObject({ code: '6109100012', generalRate: '16.5%' });
    expect(c.pathText).toContain('knitted or crocheted');
  });

  it('pulls in lines from the headings the AI thinks likely, even with no shared words', () => {
    // "pedelec" appears nowhere in the schedule; the AI's heading guess still lands 8711.
    const codes = retrieveCandidates(index, ['pedelec'], 60, ['8711']).map((c) => c.code);
    expect(codes).toContain('8711600010');
  });

  it('returns nothing when no word matches', () => {
    expect(retrieveCandidates(index, ['zzqx unobtainium'])).toEqual([]);
  });

  it('respects the limit', () => {
    expect(retrieveCandidates(index, ['battery'], 2)).toHaveLength(2);
  });
});
