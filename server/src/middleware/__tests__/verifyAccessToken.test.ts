/**
 * Every place that accepts an access token (bearer or ?token= streams)
 * must refuse the partial-auth MFA token, which is signed with the same
 * secret (audit BPR-03): otherwise a password alone opens the chat,
 * notification and staff-console streams.
 */
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { verifyAccessToken } from '../auth.js';

describe('verifyAccessToken', () => {
  it('accepts a normal access token', () => {
    const token = jwt.sign({ sub: 'u1', orgId: 'o1' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    expect(verifyAccessToken(token).sub).toBe('u1');
  });

  it('rejects the partial-auth MFA token', () => {
    const token = jwt.sign({ sub: 'u1', typ: 'mfa' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects any token carrying a typ claim', () => {
    const token = jwt.sign({ sub: 'u1', typ: 'refresh' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects a token signed with another secret', () => {
    const token = jwt.sign({ sub: 'u1' }, 'some-other-secret-0123456789', { expiresIn: '5m' });
    expect(() => verifyAccessToken(token)).toThrow();
  });
});
