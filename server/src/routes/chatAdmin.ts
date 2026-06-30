/**
 * Live agent console API — MyCargoLens staff only (platform admins). Mounted at
 * /api/v1/chat/admin (registered BEFORE the /api/v1/chat user router).
 *
 *   GET  /stream                       SSE: queue updates + messages for any conv
 *   GET  /queue?status=pending|active  the handoff queue
 *   GET  /conversations/:id            full transcript
 *   POST /conversations/:id/assign     atomic claim → mode 'human'
 *   POST /conversations/:id/messages   agent reply (→ participant over their stream)
 *   POST /conversations/:id/typing     ephemeral typing indicator
 *   POST /conversations/:id/resolve    close it out
 *   POST /conversations/:id/handback   return to the AI
 *
 * /stream uses ?token= (EventSource can't set headers) and is registered before
 * the authMiddleware gate, exactly like /notifications/stream.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { authMiddleware, requirePlatformAdmin, type AuthRequest } from '../middleware/auth.js';
import { registerAdminClient } from '../services/chat/chatStream.js';
import {
  getQueue,
  getTranscript,
  assignConversation,
  agentReply,
  resolveConversation,
  handbackConversation,
  publishAgentTyping,
} from '../services/chat/chatService.js';

const router = Router();

// Express 5 types req.params values as string | string[]; single-segment routes.
function pid(req: Request): string {
  const v = req.params.id;
  return Array.isArray(v) ? v[0] : v;
}

// ─── GET /stream (SSE, ?token=) — must precede authMiddleware ─────────
router.get('/stream', async (req: Request, res: Response): Promise<void> => {
  const token = (req.query.token as string | undefined)?.trim();
  if (!token) {
    res.status(401).json({ error: 'Missing stream token' });
    return;
  }
  let userId: string;
  try {
    userId = (jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string }).sub;
  } catch {
    res.status(401).json({ error: 'Invalid or expired stream token' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true, isActive: true },
  });
  if (!user || !user.isActive || !user.isPlatformAdmin) {
    res.status(403).json({ error: 'Platform administrator access required' });
    return;
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`: connected\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch { /* gone */ }
  }, 25_000);
  const unregister = registerAdminClient(res);
  const close = () => {
    clearInterval(heartbeat);
    unregister();
    try { res.end(); } catch { /* already ended */ }
  };
  req.on('close', close);
  req.on('error', close);
});

// Everything below requires a platform-admin session.
router.use(authMiddleware, requirePlatformAdmin);

// ─── GET /queue ───────────────────────────────────────────────────────
router.get('/queue', async (req: AuthRequest, res: Response): Promise<void> => {
  const status = (req.query.status as string) === 'pending' ? 'pending'
    : (req.query.status as string) === 'active' ? 'active' : 'all';
  const rows = await getQueue(status);
  res.json({ data: rows });
});

// ─── GET /conversations/:id ───────────────────────────────────────────
router.get('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const t = await getTranscript(pid(req));
  if (!t) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json(t);
});

// ─── POST /conversations/:id/assign (atomic claim) ────────────────────
router.post('/conversations/:id/assign', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await assignConversation(pid(req), req.user!.id);
  if (!result.ok) {
    res.status(409).json({ error: 'This conversation is already assigned to another agent.', code: 'already_claimed' });
    return;
  }
  res.json({ assigned: true });
});

// ─── POST /conversations/:id/messages (agent reply) ───────────────────
const replySchema = z.object({ content: z.string().trim().min(1).max(4000) });

router.post('/conversations/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = replySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Message is required (max 4000 chars).' });
    return;
  }
  const conv = await prisma.chatConversation.findUnique({
    where: { id: pid(req) },
    select: { assignedAgentId: true },
  });
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  // Only the assigned agent may reply (prevents two agents talking over each other).
  if (conv.assignedAgentId && conv.assignedAgentId !== req.user!.id) {
    res.status(409).json({ error: 'Assigned to another agent.', code: 'not_assignee' });
    return;
  }
  const msg = await agentReply({ conversationId: pid(req), agentId: req.user!.id, content: parsed.data.content });
  res.status(201).json({ id: msg.id });
});

// ─── POST /conversations/:id/typing ───────────────────────────────────
router.post('/conversations/:id/typing', async (req: AuthRequest, res: Response): Promise<void> => {
  await publishAgentTyping(pid(req));
  res.status(204).end();
});

// ─── POST /conversations/:id/resolve ──────────────────────────────────
router.post('/conversations/:id/resolve', async (req: AuthRequest, res: Response): Promise<void> => {
  await resolveConversation(pid(req));
  res.json({ mode: 'resolved' });
});

// ─── POST /conversations/:id/handback ─────────────────────────────────
router.post('/conversations/:id/handback', async (req: AuthRequest, res: Response): Promise<void> => {
  await handbackConversation(pid(req));
  res.json({ mode: 'ai' });
});

export default router;
