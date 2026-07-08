/**
 * Multi-factor authentication service.
 *
 * The second-factor engine behind /api/v1/auth/mfa/* (routes wired separately).
 * Primary factor is authenticator-app TOTP (RFC 6238, SHA-1 / 6 digits / 30 s,
 * verify window ±1). Fallbacks: single-use recovery codes and an email OTP.
 *
 * Security properties enforced here:
 *   • Verify-before-activate enrollment — a pending secret (encrypted, 15-min
 *     TTL) only becomes the live secret once the user proves a live code.
 *   • Replay guard — the last accepted TOTP time-step is stored; a matched step
 *     ≤ the stored one is rejected (RFC 6238 §5.2 / NIST "accept an OTP once").
 *   • Secrets encrypted at rest (services/mfaCrypto.ts), never logged.
 *   • Recovery / email codes bcrypt-hashed, single-use / attempt-capped.
 *
 * Error style mirrors services/emailVerification.ts: throw typed errors for
 * flow violations (no pending, expired, cooldown), return result unions for
 * "did the user's code check out" verdicts.
 */

import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { Secret, TOTP } from 'otpauth';
import type { User } from '@prisma/client';
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { decryptSecret, encryptSecret } from './mfaCrypto.js';

// ── Tunables ────────────────────────────────────────────────
const ISSUER = 'MyCargoLens';
const TOTP_ALGORITHM = 'SHA1';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_WINDOW = 1; // accept ±1 step for clock skew
const SECRET_BYTES = 20; // 160-bit secret (RFC 6238 recommendation)

const PENDING_TTL_MS = 15 * 60 * 1000; // enrollment must confirm within 15 min

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_GROUP_LEN = 5; // XXXXX-XXXXX
// Crockford-ish unambiguous alphabet: no I, O, 0, 1.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const EMAIL_CODE_LENGTH = 6;
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const EMAIL_MAX_ATTEMPTS = 5;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

const MAX_MFA_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 min, matches the login lockout

const BCRYPT_ROUNDS = 10;

// ── Typed errors ────────────────────────────────────────────
export type MfaErrorCode =
  | 'no_pending_enrollment'
  | 'pending_expired'
  | 'invalid_code'
  | 'already_enabled'
  | 'cooldown';

export class MfaError extends Error {
  constructor(public readonly code: MfaErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'MfaError';
  }
}

/** Thrown by issueEmailCode when the caller must wait before resending. */
export class MfaCooldownError extends MfaError {
  constructor(public readonly secondsRemaining: number) {
    super('cooldown', `Please wait ${secondsRemaining}s before requesting another code.`);
    this.name = 'MfaCooldownError';
  }
}

// ── Result unions ───────────────────────────────────────────
export interface RecoveryVerifyResult {
  ok: boolean;
  /** Recovery codes still unused after this attempt. */
  remaining: number;
}

export interface EmailVerifyResult {
  ok: boolean;
  reason?: 'invalid' | 'expired' | 'no_active_code' | 'too_many_attempts';
  attemptsRemaining?: number;
}

export interface FailureResult {
  locked: boolean;
  lockedUntil?: Date;
}

// User field subsets each function needs — keeps callers honest and the
// functions independent of how the caller loaded the row.
type EnrollUser = Pick<User, 'id' | 'email'>;
type VerifyUser = Pick<User, 'id' | 'mfaSecretEnc' | 'mfaLastUsedStep'>;
type FailureUser = Pick<User, 'id' | 'mfaFailedAttempts'>;

// ── TOTP helpers ────────────────────────────────────────────
function buildTotp(secretBase32: string, email: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
}

function currentStep(): number {
  return Math.floor(Date.now() / (TOTP_PERIOD * 1000));
}

function normalizeDigits(code: string): string {
  return code.replace(/\s+/g, '').trim();
}

// ── Enrollment ──────────────────────────────────────────────

/**
 * Start (or restart) TOTP enrollment: mint a fresh secret, stash it encrypted
 * in the pending slot with a timestamp, and hand back the provisioning URI +
 * Base32 for the QR / manual-entry UI. Overwrites any prior pending secret.
 */
export async function beginTotpEnrollment(
  user: EnrollUser,
): Promise<{ otpauthUri: string; secretBase32: string }> {
  const secret = new Secret({ size: SECRET_BYTES });
  const secretBase32 = secret.base32;
  const totp = buildTotp(secretBase32, user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaPendingSecretEnc: encryptSecret(secretBase32),
      mfaPendingCreatedAt: new Date(),
    },
  });

  logger.info({ userId: user.id }, '[MFA] TOTP enrollment started');
  return { otpauthUri: totp.toString(), secretBase32 };
}

/**
 * Confirm enrollment: the pending secret must exist and be < 15 min old, and
 * the submitted code must verify against it. Activation is atomic (guarded on
 * mfaEnabled=false) so a double-submit can't double-enroll. Returns the freshly
 * minted recovery codes (the only time they exist in plaintext).
 */
export async function confirmTotpEnrollment(
  user: EnrollUser,
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  // Read the pending fields fresh — the caller's copy may be stale.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mfaPendingSecretEnc: true, mfaPendingCreatedAt: true, mfaEnabled: true },
  });

  if (!row || !row.mfaPendingSecretEnc || !row.mfaPendingCreatedAt) {
    throw new MfaError('no_pending_enrollment');
  }
  if (row.mfaEnabled) {
    throw new MfaError('already_enabled');
  }
  if (Date.now() - row.mfaPendingCreatedAt.getTime() > PENDING_TTL_MS) {
    throw new MfaError('pending_expired');
  }

  const secretBase32 = decryptSecret(row.mfaPendingSecretEnc);
  const totp = buildTotp(secretBase32, user.email);
  const delta = totp.validate({ token: normalizeDigits(code), window: TOTP_WINDOW });
  if (delta === null) {
    throw new MfaError('invalid_code');
  }
  const matchedStep = currentStep() + delta;

  // Atomic activation: only flips if still un-enabled. count===0 means a
  // concurrent request already enrolled — treat as already_enabled.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, mfaEnabled: false },
    data: {
      mfaEnabled: true,
      mfaSecretEnc: row.mfaPendingSecretEnc,
      mfaPendingSecretEnc: null,
      mfaPendingCreatedAt: null,
      mfaLastUsedStep: matchedStep,
      mfaEnrolledAt: new Date(),
    },
  });
  if (count === 0) {
    throw new MfaError('already_enabled');
  }

  const recoveryCodes = await generateRecoveryCodes(user.id);
  logger.info({ userId: user.id }, '[MFA] TOTP enrollment confirmed');
  return { recoveryCodes };
}

// ── TOTP verification (login) ───────────────────────────────

/**
 * Verify a login-time TOTP code against the user's live secret, enforcing the
 * replay guard. On success the accepted time-step is persisted (guarded so it
 * can only advance) — a code is accepted at most once.
 */
export async function verifyTotp(user: VerifyUser, code: string): Promise<boolean> {
  if (!user.mfaSecretEnc) return false;

  let secretBase32: string;
  try {
    secretBase32 = decryptSecret(user.mfaSecretEnc);
  } catch {
    // A secret we can't decrypt (tampered / wrong key) is not a valid factor.
    logger.error({ userId: user.id }, '[MFA] Failed to decrypt TOTP secret');
    return false;
  }

  // Build without a label — validation doesn't use it, and this avoids needing
  // the email on the verify path.
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });

  const delta = totp.validate({ token: normalizeDigits(code), window: TOTP_WINDOW });
  if (delta === null) return false;

  const matchedStep = currentStep() + delta;

  // Replay guard (in-memory fast path).
  if (user.mfaLastUsedStep != null && matchedStep <= user.mfaLastUsedStep) {
    return false;
  }

  // Persist atomically — the step may only ever move forward. A concurrent
  // request that already advanced past matchedStep makes count===0, which we
  // treat as a replay and reject.
  const { count } = await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: matchedStep } }],
    },
    data: { mfaLastUsedStep: matchedStep },
  });
  return count > 0;
}

// ── Recovery codes ──────────────────────────────────────────

function generateRecoveryCode(): { display: string; canonical: string } {
  let chars = '';
  for (let i = 0; i < RECOVERY_GROUP_LEN * 2; i++) {
    chars += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
  }
  const display = `${chars.slice(0, RECOVERY_GROUP_LEN)}-${chars.slice(RECOVERY_GROUP_LEN)}`;
  return { display, canonical: chars };
}

/** Normalize user input to the canonical 10-char form (uppercase, hyphen/space-agnostic). */
function canonicalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Regenerate the user's recovery codes: wipe the old set, mint 10 fresh
 * single-use codes, store their bcrypt hashes, return the plaintext (shown once).
 */
export async function generateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const rows = await Promise.all(
    codes.map(async (c) => ({ userId, codeHash: await bcrypt.hash(c.canonical, BCRYPT_ROUNDS) })),
  );

  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.mfaRecoveryCode.createMany({ data: rows }),
  ]);

  logger.info({ userId }, '[MFA] Recovery codes generated');
  return codes.map((c) => c.display);
}

/**
 * Verify a recovery code and burn it. Single-use is enforced with a guarded
 * updateMany (usedAt IS NULL) so the same code can't be spent twice, even
 * under concurrent submissions.
 */
export async function verifyRecoveryCode(
  userId: string,
  code: string,
): Promise<RecoveryVerifyResult> {
  const canonical = canonicalizeRecoveryCode(code);
  const unused = await prisma.mfaRecoveryCode.findMany({
    where: { userId, usedAt: null },
  });

  for (const row of unused) {
    // eslint-disable-next-line no-await-in-loop -- small fixed set (≤10)
    if (await bcrypt.compare(canonical, row.codeHash)) {
      const { count } = await prisma.mfaRecoveryCode.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) break; // lost the race — code already spent
      const remaining = await prisma.mfaRecoveryCode.count({
        where: { userId, usedAt: null },
      });
      logger.info({ userId, remaining }, '[MFA] Recovery code used');
      return { ok: true, remaining };
    }
  }

  const remaining = await prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
  return { ok: false, remaining };
}

// ── Email OTP fallback ──────────────────────────────────────

function generateEmailCode(): string {
  return String(randomInt(0, 10 ** EMAIL_CODE_LENGTH)).padStart(EMAIL_CODE_LENGTH, '0');
}

/**
 * Issue a fresh email OTP for the user. Enforces a 60-s resend cooldown,
 * invalidates any prior active code, and returns the plaintext for the caller
 * to email (never logged).
 */
export async function issueEmailCode(
  user: Pick<User, 'id'>,
): Promise<{ code: string; expiresAt: Date }> {
  const latest = await prisma.mfaEmailCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (latest) {
    const elapsed = Date.now() - latest.createdAt.getTime();
    if (elapsed < EMAIL_RESEND_COOLDOWN_MS) {
      throw new MfaCooldownError(Math.ceil((EMAIL_RESEND_COOLDOWN_MS - elapsed) / 1000));
    }
  }

  const code = generateEmailCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);

  await prisma.$transaction([
    prisma.mfaEmailCode.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.mfaEmailCode.create({ data: { userId: user.id, codeHash, expiresAt } }),
  ]);

  return { code, expiresAt };
}

/**
 * Verify an email OTP. Attempts are counted before the compare; the 6th
 * attempt (or an expired / consumed code) burns the code. On success the code
 * is consumed so it can't be replayed.
 */
export async function verifyEmailCode(
  user: Pick<User, 'id'>,
  code: string,
): Promise<EmailVerifyResult> {
  const normalized = normalizeDigits(code);

  const row = await prisma.mfaEmailCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!row || row.consumedAt) return { ok: false, reason: 'no_active_code' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  const nextAttempts = row.attempts + 1;
  if (nextAttempts > EMAIL_MAX_ATTEMPTS) {
    // Attempt cap hit — burn the code so it can't be probed further.
    await prisma.mfaEmailCode.update({
      where: { id: row.id },
      data: { attempts: nextAttempts, consumedAt: new Date() },
    });
    return { ok: false, reason: 'too_many_attempts' };
  }

  const matches = await bcrypt.compare(normalized, row.codeHash);
  if (!matches) {
    await prisma.mfaEmailCode.update({
      where: { id: row.id },
      data: { attempts: nextAttempts },
    });
    return {
      ok: false,
      reason: 'invalid',
      attemptsRemaining: Math.max(0, EMAIL_MAX_ATTEMPTS - nextAttempts),
    };
  }

  await prisma.mfaEmailCode.update({
    where: { id: row.id },
    data: { attempts: nextAttempts, consumedAt: new Date() },
  });
  logger.info({ userId: user.id }, '[MFA] Email code verified');
  return { ok: true };
}

// ── Brute-force lockout ─────────────────────────────────────

/**
 * Record a failed MFA attempt. At the 5th failure the account is locked for
 * 15 minutes (reusing User.lockedUntil, same semantics as the login lockout)
 * and the counter resets.
 */
export async function recordMfaFailure(user: FailureUser): Promise<FailureResult> {
  const nextAttempts = user.mfaFailedAttempts + 1;
  if (nextAttempts >= MAX_MFA_FAILURES) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaFailedAttempts: 0, lockedUntil },
    });
    logger.warn({ userId: user.id }, '[MFA] Account locked after repeated MFA failures');
    return { locked: true, lockedUntil };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaFailedAttempts: nextAttempts },
  });
  return { locked: false };
}

/** Clear the MFA failure counter (call on a successful second factor). */
export async function resetMfaFailures(user: Pick<User, 'id'>): Promise<void> {
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaFailedAttempts: 0 },
  });
}

// Exported for tests to assert against instead of hardcoding magic numbers.
export const MFA_CONSTANTS = {
  TOTP_PERIOD,
  TOTP_WINDOW,
  PENDING_TTL_MS,
  RECOVERY_CODE_COUNT,
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_TTL_MS,
  EMAIL_MAX_ATTEMPTS,
  EMAIL_RESEND_COOLDOWN_MS,
  MAX_MFA_FAILURES,
  LOCKOUT_MS,
} as const;
