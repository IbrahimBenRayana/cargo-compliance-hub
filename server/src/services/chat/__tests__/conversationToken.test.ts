/**
 * Anonymous conversation token sign/verify. These tokens are the only thing
 * standing between one marketing visitor and another's conversation, so the
 * verification must reject forged, tampered, and malformed tokens.
 */
import { describe, it, expect } from 'vitest';
import {
  newVisitorId,
  issueConversationToken,
  verifyConversationToken,
  hashIp,
} from '../conversationToken.js';

describe('conversationToken', () => {
  it('round-trips a freshly issued token back to its visitorId', () => {
    const vid = newVisitorId();
    const token = issueConversationToken(vid);
    expect(verifyConversationToken(token)).toBe(vid);
  });

  it('mints high-entropy, unique visitor ids', () => {
    const a = newVisitorId();
    const b = newVisitorId();
    expect(a).not.toBe(b);
    // 24 bytes base64url ⇒ 32 chars.
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it('rejects a tampered signature', () => {
    const token = issueConversationToken(newVisitorId());
    const [vid] = token.split('.');
    expect(verifyConversationToken(`${vid}.deadbeef`)).toBeNull();
  });

  it('rejects a swapped visitorId (forged identity)', () => {
    const token = issueConversationToken(newVisitorId());
    const sig = token.split('.')[1];
    const otherVid = Buffer.from(newVisitorId()).toString('base64url');
    expect(verifyConversationToken(`${otherVid}.${sig}`)).toBeNull();
  });

  it('rejects malformed / empty / null tokens', () => {
    expect(verifyConversationToken(undefined)).toBeNull();
    expect(verifyConversationToken(null)).toBeNull();
    expect(verifyConversationToken('')).toBeNull();
    expect(verifyConversationToken('nodot')).toBeNull();
    expect(verifyConversationToken('.')).toBeNull();
  });

  it('hashes IPs deterministically and skips empty input', () => {
    expect(hashIp(undefined)).toBeNull();
    const h1 = hashIp('203.0.113.7');
    const h2 = hashIp('203.0.113.7');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp('203.0.113.8')).not.toBe(h1);
  });
});
