/**
 * Chat widget API — both the signed-in app surface and the anonymous marketing
 * surface, behind the hybrid chatAuth resolver.
 *
 *   POST /conversations                 create (mints a visitor token for anon)
 *   GET  /config                        feature flags for graceful degradation
 *   POST /conversations/:id/messages    send a message; SSE-streams the AI reply
 *                                        (or 204 + notify the console when a human
 *                                         agent owns the conversation)
 *   GET  /conversations/:id             transcript
 *   GET  /conversations/:id/events      persistent SSE: agent replies + mode flips
 *   POST /conversations/:id/escalate    hand off to a human
 *
 * chatAuth never hard-rejects (so create works for first-time anon visitors),
 * therefore SSE routes don't need the "register before authMiddleware" dance.
 * Every route on an existing conversation calls loadOwnedConversation first.
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import logger from '../config/logger.js';
import { env } from '../config/env.js';
import { isConfigured as aiConfigured } from '../services/ai.js';
import { chatLimiter, chatCreateLimiter } from '../middleware/rateLimiter.js';
import {
  chatAuth,
  loadOwnedConversation,
  type ChatRequest,
  type ChatActor,
} from '../middleware/chatAuth.js';
import {
  createConversation,
  appendMessage,
  getTranscript,
  escalateConversation,
} from '../services/chat/chatService.js';
import { streamAssistant } from '../services/chat/chatAssistant.js';
import {
  newVisitorId,
  issueConversationToken,
  hashIp,
} from '../services/chat/conversationToken.js';
import { registerConversationClient } from '../services/chat/chatStream.js';
import type { ChatSurface } from '../services/chat/knowledge/index.js';

const router = Router();
router.use(chatAuth);

// Express 5 types req.params values as string | string[]; these are all
// single-segment :id routes, so collapse to the string.
function pid(req: ChatRequest): string {
  const v = req.params.id;
  return Array.isArray(v) ? v[0] : v;
}

const SURFACES = ['app', 'marketing'] as const;

// ─── GET /config ──────────────────────────────────────────────────────
router.get('/config', (_req, res: Response) => {
  res.json({ enabled: env.CHAT_ENABLED, aiEnabled: aiConfigured() });
});

// ─── POST /conversations ──────────────────────────────────────────────
const createSchema = z.object({
  surface: z.enum(SURFACES).default('app'),
});

router.post('/conversations', chatCreateLimiter, chatLimiter, async (req: ChatRequest, res: Response): Promise<void> => {
  if (!env.CHAT_ENABLED) {
    res.status(503).json({ error: 'Chat is disabled', code: 'chat_disabled' });
    return;
  }
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }
  const actor = req.chatActor!;
  let surface = parsed.data.surface;

  // A signed-in user always gets the app surface (and org/user scope); everyone
  // else is a marketing visitor and gets a minted visitor token.
  if (actor.kind === 'user') {
    surface = 'app';
    const conv = await createConversation({
      surface,
      orgId: actor.orgId,
      userId: actor.userId,
      ipHash: hashIp(req.ip),
    });
    res.status(201).json({ conversationId: conv.id, mode: conv.mode, surface });
    return;
  }

  // Anonymous (or token-less) → marketing visitor.
  const visitorId = actor.kind === 'anon' ? actor.visitorId : newVisitorId();
  const conv = await createConversation({
    surface: 'marketing',
    visitorId,
    ipHash: hashIp(req.ip),
  });
  res.status(201).json({
    conversationId: conv.id,
    mode: conv.mode,
    surface: 'marketing',
    conversationToken: issueConversationToken(visitorId),
  });
});

// ─── helpers ──────────────────────────────────────────────────────────
function rateKeyFor(actor: ChatActor): { rateKey: string; dailyLimit?: number; orgId: string | null } {
  if (actor.kind === 'user') return { rateKey: actor.userId, orgId: actor.orgId };
  if (actor.kind === 'anon') return { rateKey: `anon:${actor.visitorId}`, dailyLimit: env.CHAT_ANON_DAILY_CAP, orgId: null };
  return { rateKey: 'anon:unknown', dailyLimit: env.CHAT_ANON_DAILY_CAP, orgId: null };
}

// ─── POST /conversations/:id/messages ─────────────────────────────────
const messageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

router.post('/conversations/:id/messages', chatLimiter, async (req: ChatRequest, res: Response): Promise<void> => {
  const actor = req.chatActor!;
  const parsed = messageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Message is required (max 4000 chars).', code: 'invalid_message' });
    return;
  }
  const conv = await loadOwnedConversation(actor, pid(req));
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found', code: 'not_found' });
    return;
  }

  const content = parsed.data.content;
  const humanMode = conv.mode === 'human' || conv.mode === 'pending_human';

  // Persist the user message. When a human owns the chat, this also pings the
  // console so the agent sees it live; the agent's reply comes back over the
  // /events stream — so we just acknowledge with 204 and don't call the AI.
  await appendMessage({
    conversationId: conv.id,
    role: 'user',
    content,
    broadcast: true,
    notifyAdmins: humanMode,
  });

  if (humanMode) {
    res.status(204).end();
    return;
  }

  // AI mode (or resolved → AI resumes). Stream the assistant reply over SSE.
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const { rateKey, dailyLimit, orgId } = rateKeyFor(actor);
  const surface = conv.surface as ChatSurface;
  let fullText = '';
  const deeplinks: Array<{ url: string; label: string }> = [];

  try {
    const events = streamAssistant({
      conversationId: conv.id,
      surface,
      rateKey,
      dailyLimit,
      orgId,
      userText: content,
      escalate: (reason) => escalateConversation({ conversationId: conv.id, reason }).then(() => undefined),
    });
    for await (const ev of events) {
      if (ev.delta) {
        fullText += ev.delta;
        res.write(`data: ${JSON.stringify({ delta: ev.delta })}\n\n`);
      }
      if (ev.deeplink) {
        deeplinks.push(ev.deeplink);
        res.write(`event: deeplink\ndata: ${JSON.stringify(ev.deeplink)}\n\n`);
      }
      if (ev.escalated) {
        res.write(`event: escalated\ndata: {}\n\n`);
      }
    }
    // Persist the assistant's final message (not broadcast — the requester is
    // already receiving it inline over this stream).
    if (fullText.trim()) {
      await appendMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: fullText,
        metadata: deeplinks.length ? { deeplinks } : undefined,
      });
    }
    res.write('event: done\ndata: {}\n\n');
  } catch (err: any) {
    logger.error({ err: err?.message, conversationId: conv.id }, '[Chat] message stream failed');
    if (err?.code === 'ai_rate_limited') {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message, code: 'ai_rate_limited', callsToday: err.callsToday, dailyLimit: err.dailyLimit })}\n\n`);
    } else if (err?.code === 'ai_unavailable') {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'The AI assistant is not available right now. You can connect with a human instead.', code: 'ai_unavailable' })}\n\n`);
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Something went wrong. Please try again.', code: 'chat_error' })}\n\n`);
    }
  } finally {
    res.end();
  }
});

// ─── GET /conversations/:id (transcript) ──────────────────────────────
router.get('/conversations/:id', async (req: ChatRequest, res: Response): Promise<void> => {
  const conv = await loadOwnedConversation(req.chatActor!, pid(req));
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found', code: 'not_found' });
    return;
  }
  const t = await getTranscript(conv.id);
  res.json(t);
});

// ─── GET /conversations/:id/events (persistent SSE) ───────────────────
router.get('/conversations/:id/events', async (req: ChatRequest, res: Response): Promise<void> => {
  const conv = await loadOwnedConversation(req.chatActor!, pid(req));
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found', code: 'not_found' });
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

  const unregister = registerConversationClient(conv.id, res);
  const close = () => {
    clearInterval(heartbeat);
    unregister();
    try { res.end(); } catch { /* already ended */ }
  };
  req.on('close', close);
  req.on('error', close);
});

// ─── POST /conversations/:id/escalate ─────────────────────────────────
const escalateSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  // Honeypot — bots fill hidden fields; humans never do.
  website: z.string().optional(),
});

router.post('/conversations/:id/escalate', chatLimiter, async (req: ChatRequest, res: Response): Promise<void> => {
  const parsed = escalateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }
  // Honeypot tripped → pretend success, drop silently.
  if (parsed.data.website && parsed.data.website.length > 0) {
    res.json({ mode: 'pending_human' });
    return;
  }
  const conv = await loadOwnedConversation(req.chatActor!, pid(req));
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found', code: 'not_found' });
    return;
  }
  const result = await escalateConversation({
    conversationId: conv.id,
    reason: parsed.data.reason || 'User requested a human agent.',
    visitorName: parsed.data.name,
    visitorEmail: parsed.data.email,
  });
  res.json({ mode: result?.mode ?? 'pending_human' });
});

export default router;
