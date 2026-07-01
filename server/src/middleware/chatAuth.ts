/**
 * Hybrid auth for the chat widget — works for BOTH signed-in app users and
 * anonymous marketing visitors.
 *
 *   • Authorization: Bearer <jwt>  → resolve a real user (id, orgId, role,
 *                                     isPlatformAdmin) exactly like authMiddleware.
 *   • X-Chat-Token / ?token=<tok>  → verify the HMAC conversationToken and
 *                                     resolve an anonymous visitor (visitorId).
 *   • neither                      → no actor; only conversation-create is
 *                                     allowed to proceed (it mints an identity).
 *
 * This NEVER rejects on its own (so create works for first-time anon visitors).
 * Routes that operate on an existing conversation must call assertOwnership()
 * to confirm the resolved actor actually owns that conversation.
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { verifyConversationToken } from '../services/chat/conversationToken.js';

export type ChatActor =
  | { kind: 'user'; userId: string; email: string; orgId: string; role: string; isPlatformAdmin: boolean }
  | { kind: 'anon'; visitorId: string }
  | { kind: 'none' };

export interface ChatRequest extends Request {
  chatActor?: ChatActor;
}

/** Read the chat/stream token from the header (JSON requests) or query (EventSource). */
export function readChatToken(req: Request): string | undefined {
  const header = req.headers['x-chat-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const q = req.query.token;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return undefined;
}

export async function chatAuth(req: ChatRequest, _res: Response, next: NextFunction): Promise<void> {
  // A signed-in user's JWT can arrive two ways:
  //   • Authorization: Bearer <jwt>  — normal fetch/XHR (POST message, transcript)
  //   • ?token=<jwt> / X-Chat-Token  — the EventSource /events stream, which
  //     CANNOT set request headers, so it passes the access token in the query.
  // We must try BOTH as a JWT before treating a query token as an anonymous
  // HMAC conversationToken — otherwise the signed-in widget's live stream can
  // never authenticate and silently 404s (looks like "messages only appear
  // after a refresh").
  const authz = req.headers.authorization;
  const bearer = authz?.startsWith('Bearer ') ? authz.slice(7) : undefined;
  const rawToken = readChatToken(req);
  const jwtCandidate = bearer ?? rawToken;

  if (jwtCandidate) {
    try {
      const decoded = jwt.verify(jwtCandidate, env.JWT_ACCESS_SECRET) as { sub: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, email: true, orgId: true, role: true, isActive: true, isPlatformAdmin: true },
      });
      if (user && user.isActive) {
        req.chatActor = {
          kind: 'user',
          userId: user.id,
          email: user.email,
          orgId: user.orgId,
          role: user.role,
          isPlatformAdmin: user.isPlatformAdmin,
        };
        next();
        return;
      }
    } catch {
      // Not a valid JWT — fall through and try it as an anonymous token.
    }
  }

  // 2) conversationToken → anonymous visitor (marketing surface).
  const visitorId = verifyConversationToken(rawToken);
  if (visitorId) {
    req.chatActor = { kind: 'anon', visitorId };
    next();
    return;
  }

  // 3) No identity. Allowed only for conversation-create.
  req.chatActor = { kind: 'none' };
  next();
}

/**
 * Confirm the resolved actor owns this conversation. Returns the conversation
 * row (selected fields) or null. Routes should 404/403 on null. This is the
 * load-bearing check that one anon token can't read another visitor's chat and
 * one user can't read another org's chat.
 */
export async function loadOwnedConversation(actor: ChatActor, conversationId: string) {
  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true, orgId: true, userId: true, visitorId: true, surface: true,
      mode: true, status: true, assignedAgentId: true,
    },
  });
  if (!conv) return null;

  if (actor.kind === 'user') {
    // The user must own it; platform admins go through the admin routes, not here.
    if (conv.userId && conv.userId === actor.userId) return conv;
    return null;
  }
  if (actor.kind === 'anon') {
    if (conv.visitorId && conv.visitorId === actor.visitorId) return conv;
    return null;
  }
  return null;
}
