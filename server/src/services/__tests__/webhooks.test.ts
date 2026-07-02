/**
 * Covers the webhook delivery service: secret generation, HMAC signing, and the
 * dispatch selection logic (active + event-subscription filtering) with a mocked
 * prisma + global fetch. Delivery is fire-and-forget in prod; we test the
 * await-able dispatchWebhook.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

const { prisma, dnsLookup } = vi.hoisted(() => ({
  prisma: { webhookEndpoint: { findMany: vi.fn(), update: vi.fn() } },
  dnsLookup: vi.fn(),
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
// The delivery path now runs an SSRF check that resolves the target host.
// Default the resolver to a public address so existing delivery tests pass.
vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));

import { dispatchWebhook, signPayload, generateWebhookSecret } from '../webhooks.js';

const ACTIVE_ALL = { id: 'w1', url: 'https://hook.test/all', secret: 's1', events: [], active: true };
const ACTIVE_FILING = { id: 'w2', url: 'https://hook.test/filing', secret: 's2', events: ['filing.accepted'], active: true };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.webhookEndpoint.update.mockResolvedValue({});
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]); // public
  // @ts-expect-error — install a fetch stub for the test
  global.fetch = vi.fn(async () => ({ ok: true, status: 200 }));
});

describe('generateWebhookSecret', () => {
  it('produces a whsec_-prefixed secret and a matching display prefix', () => {
    const { secret, prefix } = generateWebhookSecret();
    expect(secret.startsWith('whsec_')).toBe(true);
    expect(secret.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBe(12);
  });
});

describe('signPayload', () => {
  it('is a deterministic sha256= HMAC of the body', () => {
    const body = JSON.stringify({ event: 'filing.accepted' });
    const expected = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
    expect(signPayload('secret', body)).toBe(expected);
  });
});

describe('dispatchWebhook', () => {
  it('delivers to endpoints subscribed to the event (incl. catch-all) and signs the body', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([ACTIVE_ALL, ACTIVE_FILING]);
    await dispatchWebhook('o1', 'filing.accepted', { filingId: 'f1' });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [, opts] = (global.fetch as any).mock.calls[0];
    expect(opts.headers['X-MCL-Event']).toBe('filing.accepted');
    expect(opts.headers['X-MCL-Signature']).toMatch(/^sha256=/);
    // signature matches the endpoint's secret over the exact body sent
    expect(opts.headers['X-MCL-Signature']).toBe(signPayload('s1', opts.body));
  });

  it('skips endpoints not subscribed to the event', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([ACTIVE_FILING]);
    await dispatchWebhook('o1', 'entry.sent', { abiDocumentId: 'a1' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('records the delivery outcome on the endpoint', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([ACTIVE_ALL]);
    await dispatchWebhook('o1', 'entry.accepted', { abiDocumentId: 'a1' });
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1' }, data: expect.objectContaining({ lastStatus: 200 }) }),
    );
  });

  it('no-ops when the org has no endpoints', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([]);
    await dispatchWebhook('o1', 'filing.submitted', {});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks delivery (no fetch) when the target resolves to a private address', async () => {
    dnsLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]); // cloud metadata
    prisma.webhookEndpoint.findMany.mockResolvedValue([ACTIVE_ALL]);
    await dispatchWebhook('o1', 'filing.accepted', { filingId: 'f1' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastError: expect.stringContaining('blocked') }) }),
    );
  });

  it('blocks delivery to a literal private IP without needing DNS', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([
      { id: 'w3', url: 'http://127.0.0.1:8080/hook', secret: 's3', events: [], active: true },
    ]);
    await dispatchWebhook('o1', 'filing.accepted', { filingId: 'f1' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
