import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { seesRollout } from '../rollout.js';

describe('seesRollout', () => {
  it('shows nobody when off, including staff', () => {
    expect(seesRollout('off', true)).toBe(false);
  });
  it('shows platform admins only in staff mode', () => {
    expect(seesRollout('staff', true)).toBe(true);
    expect(seesRollout('staff', false)).toBe(false);
  });
  it('shows everyone when all', () => {
    expect(seesRollout('all', false)).toBe(true);
  });
});

describe.each(['DASHBOARD_V2', 'SHIPMENTS_V2'])('%s in deployment', (flag) => {
  it('reaches the container on deployed servers, or setting it would do nothing', () => {
    const compose = readFileSync(new URL('../../../../deploy/docker-compose.prod.yml', import.meta.url), 'utf8');
    expect(compose).toContain(`${flag}: \${${flag}:-off}`);
  });
});
