/**
 * Real-time chat fan-out — the chat analogue of services/notificationStream.ts.
 *
 *   write path (chatService) ──pg_notify('chat_events', payload)──▶ Postgres
 *                                                                      │ LISTEN
 *                                                                      ▼
 *   one dedicated pg client per process ──▶ broadcast() ──▶ two registries:
 *     • convRegistry  Map<conversationId, Set<Response>>  (the participant)
 *     • adminRegistry Set<Response>                       (every staff console)
 *                                                                      │
 *                                                            SSE "event: <type>\ndata: …"
 *
 * Why a separate channel from notifications: chat routes by conversationId (and
 * additionally fans queue-relevant events to ALL connected admins), and anon
 * visitors aren't userIds. Reusing the pattern, not the channel, keeps the two
 * LISTEN consumers independent. LISTEN/NOTIFY (not in-memory) so it works across
 * replicas — each process's LISTEN client receives the notify and fans out to
 * its own connected sockets.
 *
 * Payloads are kept under Postgres's 8000-byte NOTIFY limit. Message content is
 * usually small (chat turns), but `publishChatEvent` truncates defensively.
 */

import { Client as PgClient } from 'pg';
import type { Response } from 'express';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';

const CHANNEL = 'chat_events';

// conversationId → SSE responses of the participant (user/visitor, multi-tab).
const convRegistry = new Map<string, Set<Response>>();
// Every connected platform-admin console socket.
const adminRegistry = new Set<Response>();

let listenClient: PgClient | null = null;
let isListening = false;

export type ChatEventType =
  | 'message'        // a new chat message (assistant final, agent reply, system note)
  | 'mode_change'    // conversation mode flipped (ai ⇄ pending_human ⇄ human ⇄ resolved)
  | 'agent_typing'   // ephemeral typing indicator from the human agent
  | 'queue_update';  // signal to admin consoles to refetch the queue

export interface ChatStreamPayload {
  conversationId: string;
  type: ChatEventType;
  /** True for events the admin queue cares about (also fanned to adminRegistry). */
  notifyAdmins?: boolean;
  /**
   * When false, the event is NOT written to the conversation participant's own
   * stream — only to admins. Used so a user's own message isn't echoed back to
   * their widget (they already rendered it optimistically), which would
   * otherwise duplicate it. Defaults to true.
   */
  participantEcho?: boolean;
  // message fields
  messageId?: string;
  /** Client-generated nonce, echoed so the sender can reconcile its optimistic copy. */
  clientId?: string;
  role?: string;
  content?: string;
  agentName?: string;
  createdAt?: string;
  // mode_change fields
  mode?: string;
  assignedAgentName?: string;
  // queue_update fields
  surface?: string;
  lastMessageAt?: string;
}

// ─── LISTEN client lifecycle ─────────────────────────────────────────

export async function startChatStream(): Promise<void> {
  if (isListening) return;
  try {
    listenClient = new PgClient({ connectionString: env.DATABASE_URL });
    await listenClient.connect();
    await listenClient.query(`LISTEN ${CHANNEL}`);

    listenClient.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        broadcast(JSON.parse(msg.payload) as ChatStreamPayload);
      } catch (err) {
        logger.warn({ err, payload: msg.payload }, '[ChatStream] Bad pg_notify payload');
      }
    });

    listenClient.on('error', (err) => {
      logger.error({ err }, '[ChatStream] LISTEN client error — will attempt reconnect');
      isListening = false;
      setTimeout(() => {
        if (!isListening) startChatStream().catch(() => {});
      }, 5000);
    });

    isListening = true;
    logger.info('[ChatStream] LISTEN active on channel "chat_events"');
  } catch (err) {
    logger.error({ err }, '[ChatStream] Failed to start LISTEN client');
    isListening = false;
  }
}

export async function stopChatStream(): Promise<void> {
  if (!isListening) return;
  isListening = false;
  try {
    await listenClient?.query(`UNLISTEN ${CHANNEL}`);
    await listenClient?.end();
  } catch (err) {
    logger.warn({ err }, '[ChatStream] Error during shutdown');
  }
  listenClient = null;
}

// ─── Connection registries ───────────────────────────────────────────

export function registerConversationClient(conversationId: string, res: Response): () => void {
  let set = convRegistry.get(conversationId);
  if (!set) {
    set = new Set();
    convRegistry.set(conversationId, set);
  }
  set.add(res);
  return () => {
    const s = convRegistry.get(conversationId);
    if (!s) return;
    s.delete(res);
    if (s.size === 0) convRegistry.delete(conversationId);
  };
}

export function registerAdminClient(res: Response): () => void {
  adminRegistry.add(res);
  return () => {
    adminRegistry.delete(res);
  };
}

function writeEvent(res: Response, payload: ChatStreamPayload): void {
  // The SSE `event:` name is the type; data carries the rest. Internal routing
  // flags (notifyAdmins / participantEcho) are stripped — they're server-only.
  const { type, notifyAdmins: _n, participantEcho: _p, ...rest } = payload;
  const chunk = `event: ${type}\ndata: ${JSON.stringify(rest)}\n\n`;
  try {
    res.write(chunk);
  } catch (err) {
    logger.debug({ err }, '[ChatStream] Write failed (client likely gone)');
  }
}

function broadcast(payload: ChatStreamPayload): void {
  // Write to the conversation participant unless explicitly suppressed.
  if (payload.participantEcho !== false) {
    const set = convRegistry.get(payload.conversationId);
    if (set) for (const res of set) writeEvent(res, payload);
  }

  if (payload.notifyAdmins) {
    for (const res of adminRegistry) writeEvent(res, payload);
  }
}

// ─── Publish (called from chatService) ───────────────────────────────

export async function publishChatEvent(payload: ChatStreamPayload): Promise<void> {
  // Defensive truncation to stay well under the 8000-byte NOTIFY ceiling.
  const safe: ChatStreamPayload = { ...payload };
  if (safe.content && safe.content.length > 6000) {
    safe.content = `${safe.content.slice(0, 6000)}…`;
  }
  const { prisma } = await import('../../config/database.js');
  try {
    await prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(safe)})`;
  } catch (err) {
    logger.warn({ err }, '[ChatStream] pg_notify failed (clients will rely on refetch)');
  }
}

// ─── Stats / health ──────────────────────────────────────────────────

export function getChatStreamStats() {
  let convConnections = 0;
  for (const set of convRegistry.values()) convConnections += set.size;
  return {
    isListening,
    conversations: convRegistry.size,
    convConnections,
    adminConnections: adminRegistry.size,
  };
}
