/**
 * The AD/CVD order table is shared by every org: only platform admins may
 * sync, review, approve or dismiss its candidates (testing week BUG-001).
 * Pins the wiring so an edit cannot drop the gate.
 */
import { describe, it, expect } from 'vitest';
import router from '../compliance.js';

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: { name: string } }[] };
}

const routes = (router as unknown as { stack: Layer[] }).stack
  .filter((l) => l.route?.path.startsWith('/admin/'))
  .map((l) => ({ key: `${Object.keys(l.route!.methods)[0].toUpperCase()} ${l.route!.path}`, first: l.route!.stack[0]?.handle.name }));

describe('compliance admin routes', () => {
  it('exist', () => {
    expect(routes.map((r) => r.key).sort()).toEqual([
      'GET /admin/add-cvd/pending',
      'POST /admin/add-cvd/pending/:id/approve',
      'POST /admin/add-cvd/pending/:id/dismiss',
      'POST /admin/add-cvd/sync',
    ]);
  });

  it.each(routes.map((r) => [r.key, r.first]))('%s runs the platform-admin gate first', (_key, first) => {
    expect(first).toBe('requirePlatformAdmin');
  });
});
