/** The mock queue models at-least-once receive: browse leaves messages until acked. */
import { describe, it, expect } from 'vitest';
import { MockTransport } from '../mockTransport.js';

describe('MockTransport browse/ack', () => {
  it('returns the same message again until it is acked', async () => {
    const t = new MockTransport();
    t.prime(['A1', 'Z1']);
    const first = await t.browse();
    const again = await t.browse();
    expect(again[0].msgId).toBe(first[0].msgId);
    await t.ack([first[0].msgId]);
    expect(await t.browse()).toEqual([]);
  });

  it('reports ids that are already gone as missing', async () => {
    const t = new MockTransport();
    expect(await t.ack(['f'.repeat(48)])).toEqual({ acked: [], missing: ['f'.repeat(48)] });
  });
});
