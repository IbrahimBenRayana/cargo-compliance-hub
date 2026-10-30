import { describe, it, expect } from 'vitest';
import { seesDashboardV2 } from '../flag.js';

describe('seesDashboardV2', () => {
  it('shows nobody when off, including staff', () => {
    expect(seesDashboardV2('off', true)).toBe(false);
  });
  it('shows platform admins only in staff mode', () => {
    expect(seesDashboardV2('staff', true)).toBe(true);
    expect(seesDashboardV2('staff', false)).toBe(false);
  });
  it('shows everyone when all', () => {
    expect(seesDashboardV2('all', false)).toBe(true);
  });
});
