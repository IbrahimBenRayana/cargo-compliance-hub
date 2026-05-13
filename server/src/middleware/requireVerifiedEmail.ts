/**
 * requireVerifiedEmail — apply to mutating routes that should not run for
 * an unverified user (filing submit, ABI submit, billing checkout, etc.).
 *
 * Reads operate freely so the user can navigate the app while verifying.
 * We do a per-request DB lookup of `users.emailVerified` rather than
 * trusting the JWT, because the flag flips during a session and we don't
 * want a stale token to bypass the gate.
 *
 * Response shape on rejection (403) mirrors auth-middleware errors so
 * the frontend's existing error handling lights up automatically; the
 * extra `code: 'email_not_verified'` lets the client redirect to
 * /verify-email instead of showing the generic toast.
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from './auth.js';

export async function requireVerifiedEmail(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const row = await prisma.user.findUnique({
    where:  { id: userId },
    select: { emailVerified: true },
  });

  if (!row) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  if (!row.emailVerified) {
    res.status(403).json({
      error: 'Please verify your email address before continuing.',
      code:  'email_not_verified',
    });
    return;
  }

  next();
}
