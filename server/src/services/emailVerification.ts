/**
 * Email Verification Service
 *
 * Big-tech-style 6-digit code flow (Stripe / Linear / Vercel pattern).
 *
 *   request(userId)           → invalidate prior unconsumed → store fresh
 *                                hashed code → return { code, expiresAt }
 *   confirm(userId, code)     → bcrypt-compare against most-recent active
 *                                token → mark user verified & consumed
 *   getStateFor(userId)       → "can this user request another code now?"
 *                                returns cooldown info for the UI
 *
 * Defenses:
 *   • 15-minute expiry (matches our auth refresh window)
 *   • 5 attempts per token, after which the token is locked and the user
 *     must resend
 *   • 60s cooldown between resend requests (per user)
 *   • bcrypt hashing of the stored code (defense in depth)
 *
 * The route layer (auth.ts) applies rate-limit middleware on top of this
 * — see `verificationLimiter`.
 */

import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';

const CODE_LENGTH = 6;
const CODE_TTL_MS = 15 * 60 * 1000;        // 15 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;      // 60 seconds
const BCRYPT_ROUNDS = 10;

export interface RequestResult {
  code: string;          // plaintext code — caller emails it, never logs it
  expiresAt: Date;
}

export interface ResendState {
  canResend: boolean;
  /** Seconds until the user is allowed to request another code. */
  cooldownRemainingSec: number;
}

export interface ConfirmResult {
  ok: boolean;
  /** Human-readable code for the UI: 'invalid' | 'expired' | 'locked' | 'no_active_token' */
  reason?: 'invalid' | 'expired' | 'locked' | 'no_active_token';
  attemptsRemaining?: number;
}

/** Generate a 6-digit numeric code with cryptographic randomness. */
function generateCode(): string {
  // randomInt is uniform; padStart guards against codes like '000123' losing
  // their leading zeros when stringified.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

/**
 * Issue a fresh verification code for the user. Invalidates any prior
 * un-consumed tokens — only the most recent code works.
 *
 * Callers should respect getResendState() before invoking this (or pass
 * `bypassCooldown: true` for the initial post-register email).
 */
export async function requestVerificationCode(
  userId: string,
  opts: { bypassCooldown?: boolean } = {},
): Promise<RequestResult> {
  if (!opts.bypassCooldown) {
    const state = await getResendState(userId);
    if (!state.canResend) {
      const err = new Error(
        `Please wait ${state.cooldownRemainingSec}s before requesting another code.`,
      );
      (err as any).code = 'COOLDOWN';
      (err as any).cooldownRemainingSec = state.cooldownRemainingSec;
      throw err;
    }
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // Atomic: invalidate prior unconsumed tokens + insert new one in one
  // transaction. If something fails halfway we don't end up with two
  // valid codes for the same user.
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data:  { consumedAt: new Date() },   // soft-invalidate by consuming
    }),
    prisma.emailVerificationToken.create({
      data: { userId, codeHash, expiresAt },
    }),
  ]);

  return { code, expiresAt };
}

/**
 * Validate a code submitted by the user. On success the user's
 * emailVerified flag is flipped to true and the token is marked consumed
 * so it can't be reused.
 */
export async function confirmVerificationCode(
  userId: string,
  submittedCode: string,
): Promise<ConfirmResult> {
  const normalized = submittedCode.replace(/\s+/g, '').trim();
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false, reason: 'invalid' };
  }

  // Most-recent token for the user, regardless of consumed state — we need
  // to surface "your code expired, please resend" vs "no code on file".
  const token = await prisma.emailVerificationToken.findFirst({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) {
    return { ok: false, reason: 'no_active_token' };
  }

  if (token.consumedAt) {
    // Token was either successfully used OR invalidated by a fresh request.
    // From the user's perspective it's "no active token" — they should
    // request a new one.
    return { ok: false, reason: 'no_active_token' };
  }

  if (token.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  if (token.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'locked' };
  }

  const matches = await bcrypt.compare(normalized, token.codeHash);
  if (!matches) {
    const nextAttempts = token.attempts + 1;
    await prisma.emailVerificationToken.update({
      where: { id: token.id },
      data:  { attempts: nextAttempts },
    });
    return {
      ok: false,
      reason: 'invalid',
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - nextAttempts),
    };
  }

  // Success: mark token consumed AND flip the user flag atomically.
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: token.id },
      data:  { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data:  { emailVerified: true },
    }),
  ]);

  logger.info({ userId }, '[Verification] User email verified');
  return { ok: true };
}

/**
 * "Can this user request another code right now?" — used by the resend
 * endpoint and surfaced to the UI as a countdown.
 */
export async function getResendState(userId: string): Promise<ResendState> {
  const latest = await prisma.emailVerificationToken.findFirst({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
    select:  { createdAt: true },
  });

  if (!latest) return { canResend: true, cooldownRemainingSec: 0 };

  const elapsed = Date.now() - latest.createdAt.getTime();
  if (elapsed >= RESEND_COOLDOWN_MS) {
    return { canResend: true, cooldownRemainingSec: 0 };
  }
  return {
    canResend: false,
    cooldownRemainingSec: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
  };
}

// Test/debug constants — exported so unit tests can assert against them
// instead of hardcoding magic numbers.
export const VERIFICATION_CONSTANTS = {
  CODE_LENGTH,
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} as const;
