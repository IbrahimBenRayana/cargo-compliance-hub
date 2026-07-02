/**
 * SSRF guard: literal-IP range classification, synchronous URL syntax checks,
 * and the DNS-resolving public-URL assertion (with a mocked resolver).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { dnsLookup } = vi.hoisted(() => ({ dnsLookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));

import {
  isBlockedIp,
  validateWebhookUrlSyntax,
  assertPublicWebhookUrl,
  SsrfError,
} from '../ssrfGuard.js';

beforeEach(() => {
  vi.clearAllMocks();
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]); // public
});

describe('isBlockedIp', () => {
  it('flags loopback / private / link-local / reserved v4', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.9.9', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1']) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });
  it('allows public v4', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '1.1.1.1']) {
      expect(isBlockedIp(ip)).toBe(false);
    }
  });
  it('flags v6 loopback / ULA / link-local / mapped-private', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });
  it('allows public v6 and mapped-public', () => {
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false);
    expect(isBlockedIp('::ffff:93.184.216.34')).toBe(false);
  });
});

describe('validateWebhookUrlSyntax', () => {
  it('rejects non-http(s) schemes', () => {
    expect(() => validateWebhookUrlSyntax('file:///etc/passwd')).toThrow(SsrfError);
    expect(() => validateWebhookUrlSyntax('gopher://x')).toThrow(SsrfError);
  });
  it('rejects credentials in the URL', () => {
    expect(() => validateWebhookUrlSyntax('https://user:pass@example.com')).toThrow(SsrfError);
  });
  it('rejects literal private IPs and localhost names', () => {
    expect(() => validateWebhookUrlSyntax('http://169.254.169.254/latest/meta-data')).toThrow(SsrfError);
    expect(() => validateWebhookUrlSyntax('http://localhost:3001')).toThrow(SsrfError);
    expect(() => validateWebhookUrlSyntax('http://foo.internal/x')).toThrow(SsrfError);
    expect(() => validateWebhookUrlSyntax('http://[::1]/x')).toThrow(SsrfError);
  });
  it('accepts a normal public https URL', () => {
    expect(() => validateWebhookUrlSyntax('https://hooks.example.com/mcl')).not.toThrow();
  });
});

describe('assertPublicWebhookUrl', () => {
  it('passes for a host that resolves to a public address', async () => {
    await expect(assertPublicWebhookUrl('https://hooks.example.com/mcl')).resolves.toBeUndefined();
  });
  it('rejects a host that resolves to a private address (DNS rebinding)', async () => {
    dnsLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    await expect(assertPublicWebhookUrl('https://rebind.attacker.test/x')).rejects.toBeInstanceOf(SsrfError);
  });
  it('rejects when the host does not resolve', async () => {
    dnsLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertPublicWebhookUrl('https://nope.invalid/x')).rejects.toBeInstanceOf(SsrfError);
  });
  it('short-circuits (no DNS) for a literal public IP', async () => {
    await expect(assertPublicWebhookUrl('https://93.184.216.34/x')).resolves.toBeUndefined();
    expect(dnsLookup).not.toHaveBeenCalled();
  });
});
