/**
 * Transport seam tests — mock loopback behavior and factory selection.
 * The mqipt bridge client has its own suite in
 * transport/__tests__/mqiptTransport.test.ts (fake-bridge HTTP tests).
 */
import { describe, it, expect } from 'vitest';
import { createTransport, MockTransport } from '../transport/index.js';

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

  it('mqipt without a bridge URL fails loudly at construction', () => {
    expect(() => createTransport({ ABI_TRANSPORT: 'mqipt' })).toThrow(/not configured/);
  });
});
