/**
 * The transport guard (native go-live spec, D6): before anything is sent to
 * or read from CBP, the mq-bridge must prove it is connected to the queue
 * manager this environment requires (CERT = QGC1, PROD = QGP2). Anything
 * else (wrong queue manager, unhealthy or silent bridge, no environment)
 * refuses, so staging can never reach CBP PROD and production never CERT.
 */
import { describe, it, expect } from 'vitest';
import type { AbiTransport, SendReceipt } from '../../../abi-engine/transport/contract.js';
import { MockTransport } from '../../../abi-engine/transport/mockTransport.js';
import {
  guardTransport,
  CbpEnvironmentMismatchError,
  CbpTransportUnavailableError,
} from '../guardedTransport.js';

type Health = { ok: boolean; detail?: string; qmgr?: string };

/** A stand-in for MqiptTransport: records calls, reports a configurable health. */
class FakeBridgeTransport implements AbiTransport {
  readonly kind = 'mqipt' as const;
  health: Health = { ok: true, qmgr: 'QGC1' };
  healthChecks = 0;
  sends: string[][] = [];
  receives = 0;
  verifies = 0;
  async send(lines: string[]): Promise<SendReceipt> {
    this.sends.push(lines);
    return { messageId: 'abc' };
  }
  async receive(): Promise<string[][]> {
    this.receives++;
    return [];
  }
  async healthcheck(): Promise<Health> {
    this.healthChecks++;
    return this.health;
  }
  async verify(): Promise<{ ok: boolean; detail?: string }> {
    this.verifies++;
    return { ok: true, detail: 'echoed' };
  }
  async close(): Promise<void> {}
}

const BATCH = ['A1303S7P', 'Z1303S7P'];

describe('guardTransport on CERT', () => {
  it('sends when the bridge is connected to QGC1', async () => {
    const inner = new FakeBridgeTransport();
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.send(BATCH)).resolves.toEqual({ messageId: 'abc' });
    expect(inner.sends).toHaveLength(1);
  });

  it('refuses to send when the bridge is connected to CBP PROD', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, qmgr: 'QGP2' };
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.send(BATCH)).rejects.toBeInstanceOf(CbpEnvironmentMismatchError);
    expect(inner.sends).toHaveLength(0);
  });

  it('refuses to read the queue when the bridge is on the wrong queue manager', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, qmgr: 'QGP2' };
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.receive()).rejects.toBeInstanceOf(CbpEnvironmentMismatchError);
    expect(inner.receives).toBe(0);
  });

  it('refuses the connectivity probe on the wrong queue manager', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, qmgr: 'QGP2' };
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.verify()).rejects.toBeInstanceOf(CbpEnvironmentMismatchError);
    expect(inner.verifies).toBe(0);
  });

  it('fails closed when the bridge is unhealthy', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: false, detail: 'MQRC 2538 host not available' };
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.send(BATCH)).rejects.toBeInstanceOf(CbpTransportUnavailableError);
    expect(inner.sends).toHaveLength(0);
  });

  it('fails closed when the bridge does not say which queue manager it is on', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, detail: 'connected' };
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.send(BATCH)).rejects.toBeInstanceOf(CbpEnvironmentMismatchError);
    expect(inner.sends).toHaveLength(0);
  });

  it('reads the queue manager from an older bridge health detail', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, detail: 'connected to QGC1' };
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.send(BATCH)).resolves.toEqual({ messageId: 'abc' });
  });
});

describe('guardTransport on PROD', () => {
  it('sends when the bridge is connected to QGP2', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, qmgr: 'QGP2' };
    const guarded = guardTransport(inner, { environment: 'PROD' });
    await expect(guarded.send(BATCH)).resolves.toEqual({ messageId: 'abc' });
  });

  it('refuses to send to CBP CERT', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, qmgr: 'QGC1' };
    const guarded = guardTransport(inner, { environment: 'PROD' });
    await expect(guarded.send(BATCH)).rejects.toBeInstanceOf(CbpEnvironmentMismatchError);
  });
});

describe('guardTransport with no declared environment', () => {
  it('refuses everything on the live transport', async () => {
    const inner = new FakeBridgeTransport();
    const guarded = guardTransport(inner, { environment: 'NONE' });
    await expect(guarded.send(BATCH)).rejects.toBeInstanceOf(CbpEnvironmentMismatchError);
    expect(inner.sends).toHaveLength(0);
  });
});

describe('guardTransport caching', () => {
  it('checks the bridge once per TTL while it stays healthy', async () => {
    let clock = 1_000;
    const inner = new FakeBridgeTransport();
    const guarded = guardTransport(inner, { environment: 'CERT', ttlMs: 60_000, now: () => clock });
    await guarded.send(BATCH);
    await guarded.send(BATCH);
    expect(inner.healthChecks).toBe(1);
    clock += 60_001;
    await guarded.send(BATCH);
    expect(inner.healthChecks).toBe(2);
  });

  it('never caches a refusal, so a fixed bridge is picked up immediately', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, qmgr: 'QGP2' };
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.send(BATCH)).rejects.toBeInstanceOf(CbpEnvironmentMismatchError);
    inner.health = { ok: true, qmgr: 'QGC1' };
    await expect(guarded.send(BATCH)).resolves.toEqual({ messageId: 'abc' });
  });
});

describe('guardTransport healthcheck', () => {
  it('reports the environment, the required queue manager and whether they match', async () => {
    const inner = new FakeBridgeTransport();
    inner.health = { ok: true, qmgr: 'QGP2' };
    const guarded = guardTransport(inner, { environment: 'CERT' });
    await expect(guarded.healthcheck()).resolves.toMatchObject({
      ok: false,
      environment: 'CERT',
      qmgr: 'QGP2',
      expectedQmgr: 'QGC1',
    });
  });
});

describe('guardTransport with the mock loopback', () => {
  it('passes the mock through untouched, since it cannot reach CBP', async () => {
    const mock = new MockTransport();
    const guarded = guardTransport(mock, { environment: 'NONE' });
    await expect(guarded.send(BATCH)).resolves.toHaveProperty('messageId');
    expect(mock.sent).toHaveLength(1);
  });
});
