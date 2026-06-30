/**
 * Anonymous conversation tokens.
 *
 * Marketing-site visitors have no account, so we can't authenticate them with a
 * JWT. Instead, when an anonymous conversation is created we mint a random
 * 192-bit `visitorId` and hand back an opaque, HMAC-signed token:
 *
 *     token = base64url(visitorId) "." base64url(hmac_sha256(visitorId, secret))
 *
 * The client stores the token (localStorage) and sends it back on every request
 * (header `X-Chat-Token` for JSON, `?token=` for the EventSource stream). The
 * server verifies the HMAC, recovers the visitorId, and — critically — the
 * route then also checks that the conversation row's `visitorId` matches, so a
 * valid token only grants access to its OWN conversations.
 *
 * This is deliberately NOT a JWT: anonymous visitors have no `sub`, we want a
 * tiny opaque string, and HMAC verification is constant-time and dependency-free.
 */

import crypto from 'crypto';
import { env } from '../../config/env.js';

/** Mint a fresh, unguessable visitor identity (192 bits of entropy). */
export function newVisitorId(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function sign(visitorId: string): string {
  return crypto
    .createHmac('sha256', env.CHAT_SESSION_SECRET)
    .update(visitorId)
    .digest('base64url');
}

/** Build the opaque token a client sends back to prove ownership of a visitorId. */
export function issueConversationToken(visitorId: string): string {
  return `${Buffer.from(visitorId).toString('base64url')}.${sign(visitorId)}`;
}

/**
 * Verify a token and recover its visitorId, or null if the signature is
 * missing/malformed/forged. Uses a constant-time comparison so the check
 * doesn't leak the expected signature byte-by-byte.
 */
export function verifyConversationToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== 'string') return null;
  const [encodedVid, sig] = token.split('.');
  if (!encodedVid || !sig) return null;

  let visitorId: string;
  try {
    visitorId = Buffer.from(encodedVid, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!visitorId) return null;

  const expected = sign(visitorId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return visitorId;
}

/** sha256(ip + secret) — store on a conversation for abuse forensics without retaining raw IPs. */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${ip}:${env.CHAT_SESSION_SECRET}`).digest('hex');
}
