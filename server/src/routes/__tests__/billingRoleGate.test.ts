/**
 * Changing how the org pays (plan, card on file, Stripe portal) is for owners
 * and admins only (testing week BUG-011: operators could do all of it).
 * Runs each route's first handler as each role, so an edit cannot drop the gate.
 */
import { describe, it, expect, vi } from 'vitest';
import router from '../billing.js';

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] };
}

const GATED = ['POST /select-tier', 'POST /setup-intent', 'POST /card', 'POST /portal-session'];

const routes = new Map(
  (router as unknown as { stack: Layer[] }).stack
    .filter((l) => l.route)
    .map((l) => [`${Object.keys(l.route!.methods)[0].toUpperCase()} ${l.route!.path}`, l.route!.stack[0].handle]),
);

function runAs(role: string, handle: (...a: unknown[]) => unknown) {
  const res = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json: vi.fn() };
  const next = vi.fn();
  handle({ user: { id: 'u1', orgId: 'o1', role } }, res, next);
  return { status: res.statusCode, passed: next.mock.calls.length === 1 };
}

describe('billing write routes', () => {
  it.each(GATED)('%s refuses operators', (key) => {
    expect(routes.has(key)).toBe(true);
    expect(runAs('operator', routes.get(key)!)).toEqual({ status: 403, passed: false });
  });

  it.each(GATED.flatMap((k) => [[k, 'owner'], [k, 'admin']]))('%s lets the %s through', (key, role) => {
    expect(runAs(role, routes.get(key)!).passed).toBe(true);
  });
});
