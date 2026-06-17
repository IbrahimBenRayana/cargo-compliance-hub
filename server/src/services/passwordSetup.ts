/**
 * Password setup tokens — single-use, hashed link tokens for sales-led
 * onboarding (a provisioned client owner sets their first password) and, by
 * extension, password resets.
 *
 * The raw token only ever lives in the emailed link; the DB stores its SHA-256
 * hash. Issuing invalidates any prior unconsumed token for the user.
 */
import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../config/database.js';

const TOKEN_TTL_DAYS = 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issuePasswordSetupToken(
  userId: string,
): Promise<{ token: string; expiresAt: Date; expiresInDays: number }> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    // Burn any outstanding tokens so only the newest link works.
    prisma.passwordSetupToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordSetupToken.create({ data: { userId, tokenHash, expiresAt } }),
  ]);

  return { token, expiresAt, expiresInDays: TOKEN_TTL_DAYS };
}

/** Validate a token WITHOUT consuming it; returns the user's id+email or null. */
export async function peekPasswordSetupToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  const row = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { email: true } } },
  });
  if (!row || row.consumedAt || row.expiresAt < new Date()) return null;
  return { userId: row.userId, email: row.user.email };
}

/** Validate AND consume a token; returns the userId or null if invalid. */
export async function consumePasswordSetupToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const row = await prisma.passwordSetupToken.findUnique({ where: { tokenHash } });
  if (!row || row.consumedAt || row.expiresAt < new Date()) return null;
  await prisma.passwordSetupToken.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return row.userId;
}
