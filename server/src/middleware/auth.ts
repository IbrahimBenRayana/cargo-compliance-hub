import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';



const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Writes a viewer may make about themselves (session, own profile, MFA, inbox, chat). */
const VIEWER_SELF_SERVICE = [
  /^\/api\/v1\/auth(\/|$)/,
  /^\/api\/v1\/settings\/(profile|change-password)(\/|\?|$)/,
  /^\/api\/v1\/notifications(\/|\?|$)/,
  /^\/api\/v1\/chat(\/|\?|$)/,
];
function isViewerSelfService(url: string | undefined): boolean {
  return !!url && VIEWER_SELF_SERVICE.some((re) => re.test(url));
}

export interface AccessTokenClaims {
  sub: string;
  email?: string;
  orgId?: string;
  role?: string;
}

export class InvalidTokenTypeError extends Error {}

/**
 * Verify an access token. A normal access token carries NO `typ` claim;
 * partial-auth MFA tokens (typ: 'mfa') are signed with the same
 * JWT_ACCESS_SECRET, so without this check an mfaToken would grant a full
 * session before the second factor is proven. Every bearer and ?token=
 * stream entry point must use this, never jwt.verify directly.
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims & { typ?: string };
  if (decoded.typ !== undefined) throw new InvalidTokenTypeError('Invalid token type');
  return decoded;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    orgId: string;
    role: string;
    isPlatformAdmin: boolean;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = header.split(' ')[1];
    let decoded: AccessTokenClaims;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err instanceof InvalidTokenTypeError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      throw err;
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, orgId: true, role: true, isActive: true, isPlatformAdmin: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
      isPlatformAdmin: user.isPlatformAdmin,
    };

    // The viewer role is read-only: no filing, transmitting, billing or
    // settings writes. Only self-service writes stay open to viewers.
    if (user.role === 'viewer' && !SAFE_METHODS.has(req.method) && !isViewerSelfService(req.originalUrl)) {
      res.status(403).json({ error: 'Your role is view-only. Ask an admin for operator access.', code: 'VIEWER_READ_ONLY' });
      return;
    }

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Role-based access control middleware
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// Platform-admin gate — MyCargoLens staff only (provisioning client orgs).
// Distinct from the org-scoped requireRole: an org "owner" is NOT a platform
// admin. Apply after authMiddleware.
export function requirePlatformAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!req.user.isPlatformAdmin) {
    res.status(403).json({ error: 'Platform administrator access required' });
    return;
  }
  next();
}
