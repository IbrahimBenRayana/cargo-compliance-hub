/**
 * Every cert-console route that sends to or reads from the CBP MQ queues
 * must carry the CERT-only gate (native go-live spec, D6). The gate itself
 * is unit-tested in services/cbp; this pins the wiring, so a new or edited
 * route cannot silently drop it.
 */
import { describe, it, expect } from 'vitest';
import router from '../certConsole.js';

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: { name: string } }[] };
}

const routes = (router as unknown as { stack: Layer[] }).stack
  .filter((l) => l.route)
  .map((l) => ({
    key: `${Object.keys(l.route!.methods)[0].toUpperCase()} ${l.route!.path}`,
    gated: l.route!.stack[0]?.handle.name === 'certOnlyGate',
  }));

const MQ_ROUTES = [
  'POST /transmissions/:id/transmit',
  'POST /transport/receive',
  'POST /transport/attach-logged',
  'POST /transport/amf',
  'POST /transport/amf-bulk',
  'POST /transport/hts-query',
  'POST /transport/adcvd-query',
];

describe('cert console CERT-only wiring', () => {
  it.each(MQ_ROUTES)('%s runs the CERT-only gate first', (key) => {
    const route = routes.find((r) => r.key === key);
    expect(route, `${key} is not registered`).toBeDefined();
    expect(route!.gated).toBe(true);
  });

  it('every other /transport route is a known exception', () => {
    const ungatedTransport = routes.filter((r) => !r.gated && r.key.includes('/transport')).map((r) => r.key);
    expect(ungatedTransport.sort()).toEqual(['GET /transport', 'POST /transport/verify']);
  });
});
