/**
 * Core MFA service. The security-critical behaviours are:
 *   • TOTP verify accepts the current code and the ±1 window, but REJECTS a
 *     replay of an already-accepted time-step (RFC 6238 §5.2).
 *   • Recovery codes are single-use — a guarded update means a matched code
 *     that's already spent can't be spent again.
 *   • Email codes expire and cap attempts.
 *
 * Prisma is mocked; TOTP codes are minted with the real `otpauth` library and
 * the real `mfaCrypto` (so we exercise the encrypt→store→decrypt→verify path).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { Secret, TOTP } from 'otpauth';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    mfaRecoveryCode: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    mfaEmailCode: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  verifyTotp,
  generateRecoveryCodes,
  verifyRecoveryCode,
  issueEmailCode,
  verifyEmailCode,
  recordMfaFailure,
  resetMfaFailures,
  MfaCooldownError,
  MFA_CONSTANTS,
} from '../mfa.js';
import { encryptSecret } from '../mfaCrypto.js';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
});

function buildTotp(secret: Secret): TOTP {
  return new TOTP({
    issuer: 'MyCargoLens',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
}

// ── TOTP verification + replay guard ────────────────────────
describe('verifyTotp', () => {
  const FIXED = new Date('2026-07-07T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the current code and advances the stored step', async () => {
    const secret = new Secret({ size: 20 });
    const totp = buildTotp(secret);
    const token = totp.generate();

    const ok = await verifyTotp(
      { id: 'u1', mfaSecretEnc: encryptSecret(secret.base32), mfaLastUsedStep: null },
      token,
    );

    expect(ok).toBe(true);
    const step = Math.floor(FIXED.getTime() / 30000);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { mfaLastUsedStep: step } }),
    );
  });

  it('accepts a code from the ±1 window (clock skew)', async () => {
    const secret = new Secret({ size: 20 });
    const totp = buildTotp(secret);
    const prevToken = totp.generate({ timestamp: FIXED.getTime() - 30_000 });

    const ok = await verifyTotp(
      { id: 'u1', mfaSecretEnc: encryptSecret(secret.base32), mfaLastUsedStep: null },
      prevToken,
    );
    expect(ok).toBe(true);
  });

  it('rejects a code outside the window (±2 steps away)', async () => {
    const secret = new Secret({ size: 20 });
    const totp = buildTotp(secret);
    const farToken = totp.generate({ timestamp: FIXED.getTime() - 60_000 });

    const ok = await verifyTotp(
      { id: 'u1', mfaSecretEnc: encryptSecret(secret.base32), mfaLastUsedStep: null },
      farToken,
    );
    expect(ok).toBe(false);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('REJECTS replay of an already-accepted step', async () => {
    const secret = new Secret({ size: 20 });
    const totp = buildTotp(secret);
    const token = totp.generate();
    const step = Math.floor(FIXED.getTime() / 30000);

    const ok = await verifyTotp(
      // Stored step == the step this code maps to ⇒ replay ⇒ reject.
      { id: 'u1', mfaSecretEnc: encryptSecret(secret.base32), mfaLastUsedStep: step },
      token,
    );
    expect(ok).toBe(false);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('returns false when the user has no secret', async () => {
    const ok = await verifyTotp({ id: 'u1', mfaSecretEnc: null, mfaLastUsedStep: null }, '000000');
    expect(ok).toBe(false);
  });

  it('rejects when the atomic step-advance loses the race (count 0)', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const secret = new Secret({ size: 20 });
    const token = buildTotp(secret).generate();

    const ok = await verifyTotp(
      { id: 'u1', mfaSecretEnc: encryptSecret(secret.base32), mfaLastUsedStep: null },
      token,
    );
    expect(ok).toBe(false);
  });
});

// ── Recovery codes ──────────────────────────────────────────
describe('recovery codes', () => {
  let stored: { userId: string; codeHash: string }[] = [];

  beforeEach(() => {
    stored = [];
    prisma.mfaRecoveryCode.deleteMany.mockResolvedValue({ count: 0 });
    prisma.mfaRecoveryCode.createMany.mockImplementation(
      async ({ data }: { data: { userId: string; codeHash: string }[] }) => {
        stored = data;
        return { count: data.length };
      },
    );
  });

  it('generates 10 unambiguous, well-formatted codes', async () => {
    const codes = await generateRecoveryCodes('u1');
    expect(codes).toHaveLength(MFA_CONSTANTS.RECOVERY_CODE_COUNT);
    for (const c of codes) {
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    }
    // Old set wiped first.
    expect(prisma.mfaRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('verifies a freshly generated code and burns it (single-use)', async () => {
    const codes = await generateRecoveryCodes('u1');
    prisma.mfaRecoveryCode.findMany.mockResolvedValue(
      stored.map((s, i) => ({ id: `r${i}`, codeHash: s.codeHash, usedAt: null })),
    );
    prisma.mfaRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.mfaRecoveryCode.count.mockResolvedValue(9);

    const res = await verifyRecoveryCode('u1', codes[0]);
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(9);
    // Burn is guarded on usedAt: null.
    expect(prisma.mfaRecoveryCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r0', usedAt: null } }),
    );
  });

  it('accepts a code typed without its hyphen', async () => {
    const codes = await generateRecoveryCodes('u1');
    prisma.mfaRecoveryCode.findMany.mockResolvedValue(
      stored.map((s, i) => ({ id: `r${i}`, codeHash: s.codeHash, usedAt: null })),
    );
    prisma.mfaRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.mfaRecoveryCode.count.mockResolvedValue(9);

    const res = await verifyRecoveryCode('u1', codes[0].replace('-', '').toLowerCase());
    expect(res.ok).toBe(true);
  });

  it('rejects a wrong code', async () => {
    await generateRecoveryCodes('u1');
    prisma.mfaRecoveryCode.findMany.mockResolvedValue(
      stored.map((s, i) => ({ id: `r${i}`, codeHash: s.codeHash, usedAt: null })),
    );
    prisma.mfaRecoveryCode.count.mockResolvedValue(10);

    const res = await verifyRecoveryCode('u1', 'ZZZZZ-ZZZZZ');
    expect(res.ok).toBe(false);
    expect(res.remaining).toBe(10);
    expect(prisma.mfaRecoveryCode.updateMany).not.toHaveBeenCalled();
  });

  it('does not double-spend when the guarded update loses the race', async () => {
    const codes = await generateRecoveryCodes('u1');
    prisma.mfaRecoveryCode.findMany.mockResolvedValue(
      stored.map((s, i) => ({ id: `r${i}`, codeHash: s.codeHash, usedAt: null })),
    );
    // Another request spent it first ⇒ guarded update matches nothing.
    prisma.mfaRecoveryCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.mfaRecoveryCode.count.mockResolvedValue(9);

    const res = await verifyRecoveryCode('u1', codes[0]);
    expect(res.ok).toBe(false);
  });
});

// ── Email OTP fallback ──────────────────────────────────────
describe('issueEmailCode', () => {
  it('issues a 6-digit code and invalidates prior active codes', async () => {
    prisma.mfaEmailCode.findFirst.mockResolvedValue(null);
    prisma.mfaEmailCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.mfaEmailCode.create.mockResolvedValue({});

    const { code, expiresAt } = await issueEmailCode({ id: 'u1' });
    expect(code).toMatch(/^\d{6}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(prisma.mfaEmailCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', consumedAt: null } }),
    );
  });

  it('throws a cooldown error inside the resend window', async () => {
    prisma.mfaEmailCode.findFirst.mockResolvedValue({ createdAt: new Date() });
    await expect(issueEmailCode({ id: 'u1' })).rejects.toBeInstanceOf(MfaCooldownError);
  });
});

describe('verifyEmailCode', () => {
  async function rowFor(code: string, over: Record<string, unknown> = {}) {
    return {
      id: 'e1',
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      consumedAt: null,
      ...over,
    };
  }

  it('accepts the right code and consumes it', async () => {
    prisma.mfaEmailCode.findFirst.mockResolvedValue(await rowFor('123456'));
    prisma.mfaEmailCode.update.mockResolvedValue({});
    const res = await verifyEmailCode({ id: 'u1' }, '123456');
    expect(res.ok).toBe(true);
    expect(prisma.mfaEmailCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consumedAt: expect.any(Date) }) }),
    );
  });

  it('rejects a wrong code and reports remaining attempts', async () => {
    prisma.mfaEmailCode.findFirst.mockResolvedValue(await rowFor('123456', { attempts: 1 }));
    prisma.mfaEmailCode.update.mockResolvedValue({});
    const res = await verifyEmailCode({ id: 'u1' }, '000000');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('invalid');
    expect(res.attemptsRemaining).toBe(MFA_CONSTANTS.EMAIL_MAX_ATTEMPTS - 2);
  });

  it('reports expiry', async () => {
    prisma.mfaEmailCode.findFirst.mockResolvedValue(
      await rowFor('123456', { expiresAt: new Date(Date.now() - 1000) }),
    );
    const res = await verifyEmailCode({ id: 'u1' }, '123456');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('expired');
  });

  it('caps attempts and burns the code on the 6th try', async () => {
    prisma.mfaEmailCode.findFirst.mockResolvedValue(
      await rowFor('123456', { attempts: MFA_CONSTANTS.EMAIL_MAX_ATTEMPTS }),
    );
    prisma.mfaEmailCode.update.mockResolvedValue({});
    const res = await verifyEmailCode({ id: 'u1' }, '123456');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('too_many_attempts');
    expect(prisma.mfaEmailCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consumedAt: expect.any(Date) }) }),
    );
  });

  it('reports no active code when none exists', async () => {
    prisma.mfaEmailCode.findFirst.mockResolvedValue(null);
    const res = await verifyEmailCode({ id: 'u1' }, '123456');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('no_active_code');
  });
});

// ── Lockout ─────────────────────────────────────────────────
describe('recordMfaFailure / resetMfaFailures', () => {
  it('increments below the threshold without locking', async () => {
    prisma.user.update.mockResolvedValue({});
    const res = await recordMfaFailure({ id: 'u1', mfaFailedAttempts: 1 });
    expect(res.locked).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { mfaFailedAttempts: 2 } }),
    );
  });

  it('locks and resets the counter on the 5th failure', async () => {
    prisma.user.update.mockResolvedValue({});
    const res = await recordMfaFailure({ id: 'u1', mfaFailedAttempts: 4 });
    expect(res.locked).toBe(true);
    expect(res.lockedUntil).toBeInstanceOf(Date);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mfaFailedAttempts: 0, lockedUntil: expect.any(Date) }),
      }),
    );
  });

  it('resets the failure counter', async () => {
    prisma.user.update.mockResolvedValue({});
    await resetMfaFailures({ id: 'u1' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { mfaFailedAttempts: 0 } }),
    );
  });
});
