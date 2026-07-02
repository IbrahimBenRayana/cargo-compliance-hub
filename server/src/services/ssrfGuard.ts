/**
 * SSRF guard for outbound requests to user/tenant-supplied URLs (webhook
 * callback endpoints). A tenant that could register `http://169.254.169.254/…`
 * or `http://localhost:…` would otherwise turn our webhook dispatcher into a
 * proxy into cloud-metadata and internal services.
 *
 * Two layers:
 *  - validateWebhookUrlSyntax(): synchronous — scheme + literal-IP + obvious
 *    hostname checks. Cheap; run at registration and again before each delivery.
 *  - assertPublicWebhookUrl(): resolves DNS and rejects if the hostname maps to
 *    any private/reserved address. Run at registration AND before delivery so a
 *    record that later rebinds to a private IP is caught at send time.
 */
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

const ipToLong = (ip: string): number =>
  ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;

// IPv4 ranges that must never be reachable from a tenant webhook.
const BLOCKED_V4_CIDRS: Array<[string, number]> = [
  ['0.0.0.0', 8],       // "this" network
  ['10.0.0.0', 8],      // private
  ['100.64.0.0', 10],   // CGNAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local (cloud metadata: 169.254.169.254)
  ['172.16.0.0', 12],   // private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.0.2.0', 24],    // TEST-NET-1
  ['192.168.0.0', 16],  // private
  ['198.18.0.0', 15],   // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24],  // TEST-NET-3
  ['224.0.0.0', 4],     // multicast
  ['240.0.0.0', 4],     // reserved
];

function isBlockedV4(ip: string): boolean {
  const addr = ipToLong(ip);
  return BLOCKED_V4_CIDRS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (addr & mask) === (ipToLong(base) & mask);
  });
}

function isBlockedV6(ip: string): boolean {
  const addr = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) → validate the embedded v4 address.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  if (addr === '::1' || addr === '::') return true;      // loopback / unspecified
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique-local fc00::/7
  if (addr.startsWith('fe8') || addr.startsWith('fe9') ||
      addr.startsWith('fea') || addr.startsWith('feb')) return true; // link-local fe80::/10
  return false;
}

/** True if the literal IP is loopback/private/link-local/reserved. */
export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedV4(ip);
  if (kind === 6) return isBlockedV6(ip);
  return false; // not an IP literal
}

/**
 * Synchronous checks: valid http(s) URL, no credentials, and if the host is an
 * IP literal or an obvious internal name, reject. Returns the parsed URL.
 */
export function validateWebhookUrlSyntax(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError('Invalid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError('Webhook URL must use http or https.');
  }
  if (url.username || url.password) {
    throw new SsrfError('Webhook URL must not contain credentials.');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new SsrfError('Webhook URL host is not allowed (private/reserved address).');
  }
  if (host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal')) {
    throw new SsrfError('Webhook URL host is not allowed.');
  }
  return url;
}

/**
 * Full check: syntax + DNS resolution. Rejects if the hostname resolves to any
 * private/reserved address. Call at registration and before each delivery.
 */
export async function assertPublicWebhookUrl(raw: string): Promise<void> {
  const url = validateWebhookUrlSyntax(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return; // literal IP already validated by syntax check

  let results: Array<{ address: string }>;
  try {
    results = await lookup(host, { all: true });
  } catch {
    throw new SsrfError('Webhook URL host could not be resolved.');
  }
  if (results.length === 0) {
    throw new SsrfError('Webhook URL host could not be resolved.');
  }
  for (const { address } of results) {
    if (isBlockedIp(address)) {
      throw new SsrfError('Webhook URL resolves to a private/reserved address.');
    }
  }
}
