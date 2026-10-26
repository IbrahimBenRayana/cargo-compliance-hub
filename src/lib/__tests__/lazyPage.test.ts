/** X-04 (testing week): pages load on demand; a stale tab after a deploy reloads once instead of crashing. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadWithReload } from '../lazyPage';

beforeEach(() => sessionStorage.clear());

describe('loadWithReload', () => {
  it('returns the module when the chunk loads, and clears the reload flag', async () => {
    sessionStorage.setItem('mcl-chunk-reload', '1');
    const mod = { default: () => null };
    await expect(loadWithReload(() => Promise.resolve(mod), vi.fn())).resolves.toBe(mod);
    expect(sessionStorage.getItem('mcl-chunk-reload')).toBeNull();
  });

  it('reloads once when a chunk is missing after a deploy', async () => {
    const reload = vi.fn();
    const pending = loadWithReload(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')), reload);
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('mcl-chunk-reload')).toBe('1');
    void pending;
  });

  it('does not loop: a second failure after reloading is thrown', async () => {
    sessionStorage.setItem('mcl-chunk-reload', '1');
    const reload = vi.fn();
    await expect(loadWithReload(() => Promise.reject(new Error('boom')), reload)).rejects.toThrow('boom');
    expect(reload).not.toHaveBeenCalled();
  });
});
