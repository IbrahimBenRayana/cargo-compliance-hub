/**
 * Dashboard acceptance rate (testing week BUG-013): with no ISF accepted or
 * rejected yet there is no rate to show, not a perfect 100%.
 */
import { describe, it, expect } from 'vitest';
import { acceptanceRate } from '../acceptanceRate';

const f = (status: string) => ({ status });

describe('acceptanceRate', () => {
  it('has no value until an ISF is accepted or rejected', () => {
    expect(acceptanceRate([])).toBeNull();
    expect(acceptanceRate([f('draft'), f('submitted')])).toBeNull();
  });

  it('is accepted over accepted + rejected, rounded', () => {
    expect(acceptanceRate([f('accepted'), f('accepted'), f('rejected'), f('draft')])).toBe(67);
    expect(acceptanceRate([f('rejected')])).toBe(0);
    expect(acceptanceRate([f('accepted')])).toBe(100);
  });
});
