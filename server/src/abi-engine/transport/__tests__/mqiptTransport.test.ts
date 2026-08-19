/**
 * MqiptTransport is an HTTP client to the mq-bridge sidecar (the Debian
 * container that owns the IBM MQ binding — see server/mq-bridge/). These
 * tests run against an in-process fake bridge; the real bridge is verified
 * live with CBP's TRADE.VERIFY round-trip.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { MqiptTransport } from '../mqiptTransport.js';
import { createTransport } from '../index.js';

interface RecordedRequest {
  method: string;
  url: string;
  token: string | undefined;
  body: unknown;
}

let server: http.Server;
let baseUrl: string;
let requests: RecordedRequest[];
let respond: (req: RecordedRequest) => { status: number; body: unknown };

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const recorded: RecordedRequest = {
        method: req.method ?? '',
        url: req.url ?? '',
        token: req.headers['x-bridge-token'] as string | undefined,
        body: raw ? JSON.parse(raw) : undefined,
      };
      requests.push(recorded);
      const { status, body } = respond(recorded);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  requests = [];
  respond = () => ({ status: 200, body: {} });
});

describe('MqiptTransport (bridge client)', () => {
  it('refuses to construct without a bridge URL', () => {
    expect(() => new MqiptTransport({ bridgeUrl: '' })).toThrow(/MQIPT_BRIDGE_URL/);
  });

  it('sends a batch via POST /send with the auth token and returns the MQ message id', async () => {
    respond = () => ({ status: 200, body: { messageId: 'abc123' } });
    const t = new MqiptTransport({ bridgeUrl: baseUrl, token: 'sekrit' });
    const receipt = await t.send(['A-LINE', 'Z-LINE'], { correlationId: 'corr-9' });
    expect(receipt.messageId).toBe('abc123');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: '/send',
      token: 'sekrit',
      body: { lines: ['A-LINE', 'Z-LINE'], correlationId: 'corr-9' },
    });
  });

  it('receives batches via POST /receive', async () => {
    respond = () => ({ status: 200, body: { batches: [['A1', 'Z1'], ['A2', 'Z2']] } });
    const t = new MqiptTransport({ bridgeUrl: baseUrl });
    const batches = await t.receive({ timeoutMs: 5000, max: 2 });
    expect(batches).toEqual([['A1', 'Z1'], ['A2', 'Z2']]);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: '/receive',
      body: { timeoutMs: 5000, max: 2 },
    });
  });

  it('passes the bridge healthcheck through verbatim', async () => {
    respond = () => ({ status: 200, body: { ok: true, detail: 'connected to QGC1' } });
    const t = new MqiptTransport({ bridgeUrl: baseUrl });
    await expect(t.healthcheck()).resolves.toEqual({ ok: true, detail: 'connected to QGC1' });
  });

  it('surfaces bridge-level MQ failures as errors on send', async () => {
    respond = () => ({ status: 502, body: { error: 'MQRC 2538 (host not available)' } });
    const t = new MqiptTransport({ bridgeUrl: baseUrl });
    await expect(t.send(['A-LINE'])).rejects.toThrow(/MQRC 2538/);
  });

  it('reports an unreachable bridge as an unhealthy check, not a crash', async () => {
    const t = new MqiptTransport({ bridgeUrl: 'http://127.0.0.1:1' });
    const health = await t.healthcheck();
    expect(health.ok).toBe(false);
    expect(health.detail).toMatch(/bridge/i);
  });

  it('runs the CBP TRADE.VERIFY round-trip via POST /verify', async () => {
    respond = () => ({ status: 200, body: { ok: true, detail: 'round-trip verified', echoed: 'PROBE' } });
    const t = new MqiptTransport({ bridgeUrl: baseUrl, token: 'sekrit' });
    await expect(t.verify()).resolves.toMatchObject({ ok: true, detail: 'round-trip verified' });
    expect(requests[0]).toMatchObject({ method: 'POST', url: '/verify', token: 'sekrit' });
  });
});

describe('createTransport env wiring', () => {
  it('builds an MqiptTransport from MQIPT_BRIDGE_URL', () => {
    const t = createTransport({ ABI_TRANSPORT: 'mqipt', MQIPT_BRIDGE_URL: baseUrl });
    expect(t.kind).toBe('mqipt');
  });

  it('fails loudly when mqipt is selected but the bridge URL is missing', () => {
    expect(() => createTransport({ ABI_TRANSPORT: 'mqipt' })).toThrow(/MQIPT_BRIDGE_URL/);
  });

  it('still defaults to the mock transport', () => {
    expect(createTransport({}).kind).toBe('mock');
  });
});
