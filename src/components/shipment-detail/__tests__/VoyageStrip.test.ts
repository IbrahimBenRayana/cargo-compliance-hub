import { describe, it, expect } from 'vitest';
import { sailing } from '../VoyageStrip';

const DAY = 86_400_000;
const at = (d: number) => new Date(Date.UTC(2026, 10, 10) + d * DAY).toISOString();
const NOW = Date.UTC(2026, 10, 10);

describe('sailing', () => {
  it('has nothing to show without a departure date', () => {
    expect(sailing(null, at(10), NOW)).toBeNull();
  });
  it('counts down to departure before it sails', () => {
    expect(sailing(at(2), at(16), NOW)).toEqual({ share: 0, text: 'Sails in 2d' });
  });
  it('places the ship along the way between the estimated dates', () => {
    expect(sailing(at(-5), at(15), NOW)).toEqual({ share: 0.25, text: 'At sea, ETA in 15d' });
  });
  it('says the ETA has passed rather than that the ship arrived', () => {
    expect(sailing(at(-20), at(-1), NOW)?.text).toMatch(/^ETA was /);
  });
  it('does not guess progress without an ETA', () => {
    expect(sailing(at(-3), null, NOW)).toEqual({ share: 0, text: 'Sailed, no ETA on file' });
  });
});
