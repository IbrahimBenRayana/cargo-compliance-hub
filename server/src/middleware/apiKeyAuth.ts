/**
 * apiKeyAuth — authentication for the public API (/api/public/v1).
 *
 * Resolves a customer API key (Authorization: Bearer mcl_… or X-API-Key) to its
 * organization, scopes, and tier capabilities. Requests then run under that
 * org's entitlements exactly like the app UI — the public API can only do what
 * the org's plan unlocks. Keys are matched by SHA-256 hash (the raw key is only
 * ever shown once at creation).
 */
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from '../config/database.js';
import { getOrgEntitlements } from '../services/entitlements.js';
import type { Capability } from '../config/plans.js';

export interface ApiRequest extends Request {
  apiContext?: {
    orgId: string;
    keyId: string;
    /** The user who created the key — actions taken via the API are attributed to them. */
    actorUserId: string;
    scopes: string[];
    capabilities: Capability[];
    planId: string | null;
  };
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function extractKey(req: Request): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const x = req.headers['x-api-key'];
  if (typeof x === 'string' && x.length > 0) return x.trim();
  return null;
}

export async function apiKeyAuth(req: ApiRequest, res: Response, next: NextFunction): Promise<void> {
  const raw = extractKey(req);
  if (!raw || !raw.startsWith('mcl_')) {
    res.status(401).json({ error: 'Missing or invalid API key.', code: 'api_key_required' });
    return;
  }

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } });
  if (!key || key.revokedAt) {
    res.status(401).json({ error: 'Invalid or revoked API key.', code: 'api_key_invalid' });
    return;
  }

  const ent = await getOrgEntitlements(key.orgId);
  req.apiContext = {
    orgId: key.orgId,
    keyId: key.id,
    actorUserId: key.createdById,
    scopes: key.scopes,
    capabilities: ent.capabilities,
    planId: ent.planId,
  };

  // Best-effort last-used stamp; never blocks the request.
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => { /* noop */ });

  next();
}

/** Gate a public-API route on an API-key scope (e.g. "filings:read"). */
export function requireScope(scope: string) {
  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    if (!req.apiContext) {
      res.status(401).json({ error: 'Not authenticated.', code: 'api_key_required' });
      return;
    }
    if (!req.apiContext.scopes.includes(scope)) {
      res.status(403).json({ error: `API key is missing the required scope: ${scope}.`, code: 'insufficient_scope' });
      return;
    }
    next();
  };
}
