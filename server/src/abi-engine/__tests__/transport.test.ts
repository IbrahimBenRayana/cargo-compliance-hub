/**
 * Transport seam tests — mock loopback behavior, factory selection, and
 * the MQIPT scaffold's fail-loudly contract while CBP parameters are
 * pending.
 */
import { describe, it, expect } from 'vitest';
import { createTransport, MockTransport, MqiptTransport } from '../transport/index.js';

describe('MockTransport', () => {
  it('records sends and returns primed responses in order', async () => {
    const t = new MockTransport();
    t.prime(['A...', 'B...', 'Y...', 'Z...']);
    const receipt = await t.send(['A1', 'B1', 'Y1', 'Z1'], { correlationId: '001' });
    expect(receipt.messageId).toMatch(/[0-9a-f-]{36}/);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].correlationId).toBe('001');

    const batches = await t.receive();
    expect(batches).toEqual([['A...', 'B...', 'Y...', 'Z...']]);
    expect(await t.receive()).toEqual([]); // drained
  });

  it('fabricates responses via respondWith', async () => {
    const t = new MockTransport();
    t.respondWith((sent) => [`ECHO ${sent.length} LINES`]);
    await t.send(['A', 'Z']);
    expect(await t.receive()).toEqual([['ECHO 2 LINES']]);
  });

  it('reports healthy', async () => {
    expect((await new MockTransport().healthcheck()).ok).toBe(true);
  });
});

describe('createTransport', () => {
  it('defaults to mock', () => {
    expect(createTransport({}).kind).toBe('mock');
  });

  it('rejects unknown kinds', () => {
    expect(() => createTransport({ ABI_TRANSPORT: 'carrier-pigeon' })).toThrow(/Unknown ABI_TRANSPORT/);
  });

  it('mqipt without CBP parameters fails loudly at construction', () => {
    expect(() => createTransport({ ABI_TRANSPORT: 'mqipt' })).toThrow(/not configured/);
  });
});

describe('MqiptTransport scaffold', () => {
  const config = {
    queueManager: 'CBPQM01',
    host: 'mqipt.cbp.dhs.gov',
    port: 1414,
    channel: 'CBP.TRADE.CH',
    sendQueue: 'CBP.ABI.IN',
    receiveQueue: 'SP7.ABI.OUT',
  };

  it('accepts complete config but refuses network calls until the binding ships', async () => {
    const t = new MqiptTransport(config);
    expect((await t.healthcheck()).ok).toBe(false);
    await expect(t.send(['A'])).rejects.toThrow(/binding pending/);
    await expect(t.receive()).rejects.toThrow(/binding pending/);
  });

  it('names the missing parameters', () => {
    expect(() => new MqiptTransport({ ...config, sendQueue: '' })).toThrow(/sendQueue/);
  });
});
