/**
 * Real-time notification streaming (Phase 7).
 *
 *   ┌──────────────────────────┐
 *   │ notify() inserts rows    │
 *   └──────────┬───────────────┘
 *              │ pg_notify('notifications', payload)
 *              ▼
 *   ┌──────────────────────────┐
 *   │ Postgres LISTEN socket   │  (one dedicated `pg` client per process)
 *   └──────────┬───────────────┘
 *              │ event { userId, kind, severity }
 *              ▼
 *   ┌──────────────────────────┐
 *   │ ConnectionRegistry       │  Map<userId, Set<Response>>
 *   └──────────┬───────────────┘
 *              │ writes "event: notification\ndata: {...}\n\n"
 *              ▼
 *   ┌──────────────────────────┐
 *   │ Browser EventSource      │  → invalidates TanStack Query cache
 *   └──────────────────────────┘
 *
 * One LISTEN client per process multiplexes to many users — Postgres only
 * supports a few hundred LISTEN sockets, so we never want one per user.
 *
 * The notification payload is intentionally tiny (userId + kind + severity
 * only). The client uses it as a *signal* to refetch via the regular GET
 * endpoint, which keeps auth / preference filtering / pagination in one
 * place. We don't try to push the full Notification body through pg_notify
 * — the 8000-byte payload limit makes it fragile.
 */

import { Client as PgClient } from 'pg';
import type { Response } from 'express';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

const CHANNEL = 'notifications';

// userId → connected SSE responses for that user (multiple tabs supported).
const registry = new Map<string, Set<Response>>();

let listenClient: PgClient | null = null;
let isListening = false;

interface NotificationStreamPayload {
  userId: string;
  kind: string;
  severity?: string;
}

// ─── LISTEN client lifecycle ─────────────────────────────────────────

export async function startNotificationStream(): Promise<void> {
  if (isListening) return;
  try {
    listenClient = new PgClient({ connectionString: env.DATABASE_URL });
    await listenClient.connect();
    await listenClient.query(`LISTEN ${CHANNEL}`);

    listenClient.on('notification', msg => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        const payload = JSON.parse(msg.payload) as NotificationStreamPayload;
        broadcast(payload);
      } catch (err) {
        logger.warn({ err, payload: msg.payload }, '[Stream] Bad pg_notify payload');
      }
    });

    listenClient.on('error', err => {
      logger.error({ err }, '[Stream] LISTEN client error — will attempt reconnect');
      // Best-effort reconnect after a short delay. If the process is
      // shutting down, isListening is false and we no-op.
      isListening = false;
      setTimeout(() => {
        if (!isListening) startNotificationStream().catch(() => {});
      }, 5000);
    });

    isListening = true;
    logger.info('[Stream] LISTEN active on channel "notifications"');
  } catch (err) {
    logger.error({ err }, '[Stream] Failed to start LISTEN client');
    isListening = false;
  }
}

export async function stopNotificationStream(): Promise<void> {
  if (!isListening) return;
  isListening = false;
  try {
    await listenClient?.query(`UNLISTEN ${CHANNEL}`);
    await listenClient?.end();
  } catch (err) {
    logger.warn({ err }, '[Stream] Error during shutdown');
  }
  listenClient = null;
}

// ─── Connection registry ─────────────────────────────────────────────

export function registerStreamClient(userId: string, res: Response): () => void {
  let set = registry.get(userId);
  if (!set) {
    set = new Set();
    registry.set(userId, set);
  }
  set.add(res);

  // Return an unregister function the route handler should call on close.
  return () => {
    const s = registry.get(userId);
    if (!s) return;
    s.delete(res);
    if (s.size === 0) registry.delete(userId);
  };
}

function broadcast(payload: NotificationStreamPayload): void {
  const set = registry.get(payload.userId);
  if (!set || set.size === 0) return;

  const chunk = `event: notification\ndata: ${JSON.stringify({
    kind:     payload.kind,
    severity: payload.severity,
  })}\n\n`;

  for (const res of set) {
    try {
      res.write(chunk);
    } catch (err) {
      // Connection probably already closed; let the close handler clean up.
      logger.debug({ err }, '[Stream] Write failed (client likely gone)');
    }
  }
}

// ─── Publish (called from notify()) ──────────────────────────────────

/**
 * Fire pg_notify with one payload per user the dispatcher just inserted
 * a notification for. Tiny payload — the client treats it as "refetch
 * the bell" signal, not as the notification body itself.
 */
export async function publishNotificationEvents(events: Array<{
  userId: string;
  kind: string;
  severity: string;
}>): Promise<void> {
  if (events.length === 0) return;
  // We use the existing Prisma client for $executeRaw — no need to share
  // the LISTEN socket. Postgres delivers across connections via the
  // channel internally.
  const { prisma } = await import('../config/database.js');
  try {
    // pg_notify takes (channel, payload) — payload max 8000 bytes.
    // We send one notify per user so the listener can route accordingly
    // without parsing arrays.
    await Promise.all(events.map(e =>
      prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(e)})`
    ));
  } catch (err) {
    logger.warn({ err }, '[Stream] pg_notify failed (clients will still poll)');
  }
}

// ─── Stats / health ──────────────────────────────────────────────────

export function getStreamStats() {
  let totalConnections = 0;
  for (const set of registry.values()) totalConnections += set.size;
  return {
    isListening,
    users:       registry.size,
    connections: totalConnections,
  };
}
