/**
 * Chat persistence + realtime side-effects. Every durable write (message,
 * mode/assignment change) goes through here so it also fires the matching
 * pg_notify via chatStream.publishChatEvent — keeping the DB and the live
 * stream in lockstep. Routes never touch prisma.chat* directly.
 */
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { env } from '../../config/env.js';
import { sendMail } from '../email.js';
import { publishChatEvent } from './chatStream.js';
import type { ChatSurface } from './knowledge/index.js';

export type ChatRole = 'user' | 'assistant' | 'system' | 'agent';
export type ChatMode = 'ai' | 'pending_human' | 'human' | 'resolved';

// ─── Create ───────────────────────────────────────────────────────────
export async function createConversation(input: {
  surface: ChatSurface;
  orgId?: string | null;
  userId?: string | null;
  visitorId?: string | null;
  ipHash?: string | null;
}) {
  return prisma.chatConversation.create({
    data: {
      surface: input.surface,
      orgId: input.orgId ?? null,
      userId: input.userId ?? null,
      visitorId: input.visitorId ?? null,
      ipHash: input.ipHash ?? null,
      mode: 'ai',
      status: 'open',
    },
    select: { id: true, surface: true, mode: true, status: true, createdAt: true },
  });
}

// ─── Transcript ───────────────────────────────────────────────────────
export async function getTranscript(conversationId: string) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true, surface: true, mode: true, status: true,
      visitorName: true, visitorEmail: true, assignedAgentId: true,
      escalationReason: true, createdAt: true,
    },
  });
  if (!conversation) return null;
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, metadata: true, agentId: true, createdAt: true },
  });
  return { conversation, messages };
}

/** Recent messages for the model's context window (oldest→newest, capped). */
export async function getRecentMessages(conversationId: string, limit = env.CHAT_MAX_HISTORY) {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, role: { in: ['user', 'assistant', 'agent'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { role: true, content: true },
  });
  return rows.reverse();
}

// ─── Append a message (+ optional live broadcast) ─────────────────────
export async function appendMessage(input: {
  conversationId: string;
  role: ChatRole;
  content: string;
  toolName?: string | null;
  metadata?: any;
  agentId?: string | null;
  agentName?: string | null;
  /** Broadcast over SSE to the participant (and admins, for queue freshness). */
  broadcast?: boolean;
  notifyAdmins?: boolean;
}) {
  const msg = await prisma.chatMessage.create({
    data: {
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      toolName: input.toolName ?? null,
      metadata: input.metadata ?? undefined,
      agentId: input.agentId ?? null,
    },
    select: { id: true, role: true, content: true, metadata: true, createdAt: true },
  });
  await prisma.chatConversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: msg.createdAt },
  });

  if (input.broadcast) {
    await publishChatEvent({
      conversationId: input.conversationId,
      type: 'message',
      messageId: msg.id,
      role: msg.role,
      content: msg.content,
      agentName: input.agentName ?? undefined,
      createdAt: msg.createdAt.toISOString(),
      notifyAdmins: input.notifyAdmins,
      lastMessageAt: msg.createdAt.toISOString(),
    });
  }
  return msg;
}

// ─── Escalate to a human ──────────────────────────────────────────────
export async function escalateConversation(input: {
  conversationId: string;
  reason: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
}) {
  const conv = await prisma.chatConversation.findUnique({
    where: { id: input.conversationId },
    select: { id: true, mode: true, surface: true, visitorName: true, visitorEmail: true },
  });
  if (!conv) return null;
  // Already with a human (or queued) — don't re-escalate / re-email.
  if (conv.mode === 'human' || conv.mode === 'pending_human') {
    return conv;
  }

  await prisma.chatConversation.update({
    where: { id: input.conversationId },
    data: {
      mode: 'pending_human',
      escalationReason: input.reason.slice(0, 500),
      escalatedAt: new Date(),
      visitorName: input.visitorName ?? conv.visitorName,
      visitorEmail: input.visitorEmail ?? conv.visitorEmail,
    },
  });

  await appendMessage({
    conversationId: input.conversationId,
    role: 'system',
    content: 'Connecting you with a MyCargoLens specialist…',
    broadcast: false,
  });

  await publishChatEvent({
    conversationId: input.conversationId,
    type: 'mode_change',
    mode: 'pending_human',
    notifyAdmins: true,
    surface: conv.surface,
    lastMessageAt: new Date().toISOString(),
  });

  logger.info({ conversationId: input.conversationId, surface: conv.surface }, '[Chat] escalated');

  // Marketing visitors aren't watching an in-app console, so email support too.
  if (conv.surface === 'marketing') {
    void emailEscalation(input.conversationId, input.reason).catch((err) =>
      logger.warn({ err: err?.message }, '[Chat] escalation email failed'),
    );
  }
  return { ...conv, mode: 'pending_human' as const };
}

async function emailEscalation(conversationId: string, reason: string) {
  const t = await getTranscript(conversationId);
  if (!t) return;
  const lines = t.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');
  const contact = [t.conversation.visitorName, t.conversation.visitorEmail].filter(Boolean).join(' · ') || 'anonymous visitor';
  await sendMail({
    to: env.CHAT_SUPPORT_EMAIL,
    subject: `[Chat] Visitor needs a human — ${reason.slice(0, 80)}`,
    text: `A marketing-site visitor asked to talk to a human.\n\nContact: ${contact}\nReason: ${reason}\n\nTranscript:\n${lines}\n\nConversation id: ${conversationId}`,
    html: `<p>A marketing-site visitor asked to talk to a human.</p>
<p><strong>Contact:</strong> ${escapeHtml(contact)}<br/><strong>Reason:</strong> ${escapeHtml(reason)}</p>
<pre style="white-space:pre-wrap;font-family:monospace;background:#f6f7f9;padding:12px;border-radius:8px">${escapeHtml(lines)}</pre>
<p style="color:#888">Conversation id: ${conversationId}</p>`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ─── Admin: queue, assign, reply, resolve, handback ───────────────────
export async function getQueue(filter: 'pending' | 'active' | 'all' = 'all') {
  const where: any = { status: 'open' };
  if (filter === 'pending') where.mode = 'pending_human';
  else if (filter === 'active') where.mode = { in: ['pending_human', 'human'] };
  else where.mode = { in: ['pending_human', 'human'] };

  const rows = await prisma.chatConversation.findMany({
    where,
    orderBy: [{ mode: 'asc' }, { lastMessageAt: 'desc' }],
    take: 100,
    select: {
      id: true, surface: true, mode: true, visitorName: true, visitorEmail: true,
      escalationReason: true, lastMessageAt: true, escalatedAt: true, assignedAgentId: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      assignedAgent: { select: { firstName: true, lastName: true } },
    },
  });
  return rows;
}

/** Atomic claim — only succeeds if currently unassigned. Prevents two agents grabbing one chat. */
export async function assignConversation(conversationId: string, agentId: string) {
  const claimed = await prisma.chatConversation.updateMany({
    where: { id: conversationId, assignedAgentId: null, status: 'open' },
    data: { assignedAgentId: agentId, mode: 'human' },
  });
  if (claimed.count === 0) {
    // Either already claimed by someone, or doesn't exist / closed.
    const existing = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { assignedAgentId: true },
    });
    if (existing?.assignedAgentId === agentId) {
      // Re-claim by the same agent is fine (idempotent).
      return { ok: true as const };
    }
    return { ok: false as const, reason: 'already_claimed' as const };
  }
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { firstName: true, lastName: true },
  });
  const agentName = agentName_(agent);
  await appendMessage({
    conversationId,
    role: 'system',
    content: `${agentName} from MyCargoLens has joined the chat.`,
    broadcast: false,
  });
  await publishChatEvent({
    conversationId,
    type: 'mode_change',
    mode: 'human',
    assignedAgentName: agentName,
    notifyAdmins: true,
  });
  return { ok: true as const, agentName };
}

export async function agentReply(input: { conversationId: string; agentId: string; content: string }) {
  const agent = await prisma.user.findUnique({
    where: { id: input.agentId },
    select: { firstName: true, lastName: true },
  });
  return appendMessage({
    conversationId: input.conversationId,
    role: 'agent',
    content: input.content,
    agentId: input.agentId,
    agentName: agentName_(agent),
    broadcast: true,
    notifyAdmins: true,
  });
}

export async function resolveConversation(conversationId: string) {
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { mode: 'resolved', resolvedAt: new Date() },
  });
  await appendMessage({
    conversationId,
    role: 'system',
    content: 'This conversation has been marked resolved. Ask anything else and the AI assistant will help.',
    broadcast: false,
  });
  await publishChatEvent({ conversationId, type: 'mode_change', mode: 'resolved', notifyAdmins: true });
}

export async function handbackConversation(conversationId: string) {
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { mode: 'ai', assignedAgentId: null },
  });
  await appendMessage({
    conversationId,
    role: 'system',
    content: 'You are back with the AI assistant.',
    broadcast: false,
  });
  await publishChatEvent({ conversationId, type: 'mode_change', mode: 'ai', notifyAdmins: true });
}

/** Ephemeral typing indicator from the agent → participant. */
export async function publishAgentTyping(conversationId: string) {
  await publishChatEvent({ conversationId, type: 'agent_typing' });
}

function agentName_(agent: { firstName: string | null; lastName: string | null } | null): string {
  if (!agent) return 'A specialist';
  const name = [agent.firstName, agent.lastName].filter(Boolean).join(' ').trim();
  return name || 'A specialist';
}
