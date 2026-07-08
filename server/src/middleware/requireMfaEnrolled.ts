/**
 * requireMfaEnrolled — hard gate for MFA-enforced accounts.
 *
 * New users are created with `mfaEnforced = true`. Until they finish TOTP
 * enrollment (`mfaEnabled = true`) they must not be able to run sensitive
 * write paths. This mirrors requireVerifiedEmail: a per-request DB lookup
 * (never trust the JWT, since the flag flips mid-session) and a 403 with a
 * machine-readable `code` the SPA uses to redirect to /mfa-setup.
 *
 * Chained immediately AFTER requireVerifiedEmail on the same routes. It is
 * deliberately NOT applied to the /auth/mfa/* endpoints (enrollment itself
 * must work) nor to /auth/me (the SPA needs to read mfaSetupRequired to know
 * where to send the user).
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from './auth.js';

export async function requireMfaEnrolled(
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
    select: { mfaEnforced: true, mfaEnabled: true },
  });

  if (!row) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  if (row.mfaEnforced && !row.mfaEnabled) {
    res.status(403).json({
      error: 'MFA enrollment required',
      code:  'mfa_enrollment_required',
    });
    return;
  }

  next();
}
