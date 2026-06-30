import { useEffect, useRef } from 'react';
import { getAccessToken } from '@/api/client';
import type { ChatMode, ChatRole } from '@/api/client';

/**
 * Persistent chat events stream (shared by the widget and the admin console).
 *
 * Opens an EventSource to a chat events endpoint and forwards the named
 * events to callbacks. Mirrors useNotificationStream: the access token
 * rides in ?token= (EventSource can't set headers); we re-open when the
 * endpoint url or token changes and close on unmount.
 *
 *   message      → a live agent / system reply (or echoed user message).
 *                  Append it, deduped by messageId.
 *   mode_change  → conversation mode flipped; update badge + composer.
 *   agent_typing → show a brief typing indicator.
 *   queue_update → (admin console only) refetch the queue.
 *   : heartbeat  → comment frame, ignored by EventSource.
 */

/** Payload of a live `message` event. */
export interface ChatStreamMessage {
  messageId: string;
  role: ChatRole;
  content: string;
  agentName?: string;
  createdAt: string;
  /** Admin stream: which conversation this message belongs to. */
  conversationId?: string;
  lastMessageAt?: string;
}

export interface ChatModeChange {
  mode: ChatMode;
  assignedAgentName?: string;
  /** Admin stream: which conversation changed mode. */
  conversationId?: string;
}

export interface ChatQueueUpdate {
  conversationId: string;
  mode: ChatMode;
  lastMessageAt?: string;
  surface: 'app' | 'marketing';
}

export interface ChatStreamCallbacks {
  /** A live agent / system message (or echoed user message) arrived. */
  onMessage?: (msg: ChatStreamMessage) => void;
  /** The conversation mode changed. */
  onModeChange?: (change: ChatModeChange) => void;
  /** The other party is typing. */
  onTyping?: (data: { conversationId?: string }) => void;
  /** Admin console: a conversation in the queue changed — refetch. */
  onQueueUpdate?: (update: ChatQueueUpdate) => void;
}

/**
 * @param url   Full path of the events endpoint (without the token query),
 *              e.g. `/api/v1/chat/conversations/:id/events` or
 *              `/api/v1/chat/admin/stream`. Pass `null` to keep it closed
 *              (e.g. while the widget is shut or no conversation exists yet).
 */
export function useChatEventStream(
  url: string | null,
  callbacks: ChatStreamCallbacks,
): void {
  // Keep callbacks in a ref so the stream isn't torn down + re-opened every
  // render just because a closure identity changed. The effect only depends
  // on the url (and the module-scoped token via getAccessToken).
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;
    const token = getAccessToken();
    if (!token) return; // Logged-out — no stream.

    const apiBase = import.meta.env.VITE_API_URL || '';
    const fullUrl = `${apiBase}${url}?token=${encodeURIComponent(token)}`;

    let cancelled = false;
    let es: EventSource | null = null;
    try {
      es = new EventSource(fullUrl);
      sourceRef.current = es;
    } catch {
      return;
    }

    const parse = <T,>(raw: string): T | null => {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    };

    const onMessage = (ev: MessageEvent) => {
      if (cancelled) return;
      const data = parse<ChatStreamMessage>(ev.data);
      if (data) cbRef.current.onMessage?.(data);
    };
    const onModeChange = (ev: MessageEvent) => {
      if (cancelled) return;
      const data = parse<ChatModeChange>(ev.data);
      if (data) cbRef.current.onModeChange?.(data);
    };
    const onTyping = (ev: MessageEvent) => {
      if (cancelled) return;
      const data = parse<{ conversationId?: string }>(ev.data) ?? {};
      cbRef.current.onTyping?.(data);
    };
    const onQueueUpdate = (ev: MessageEvent) => {
      if (cancelled) return;
      const data = parse<ChatQueueUpdate>(ev.data);
      if (data) cbRef.current.onQueueUpdate?.(data);
    };

    es.addEventListener('message', onMessage as EventListener);
    es.addEventListener('mode_change', onModeChange as EventListener);
    es.addEventListener('agent_typing', onTyping as EventListener);
    es.addEventListener('queue_update', onQueueUpdate as EventListener);

    // EventSource auto-reconnects on transient errors. If it gives up
    // (readyState 2 == CLOSED — e.g. an expired token) close it and let the
    // next mount / token refresh re-open.
    es.onerror = () => {
      if (cancelled) return;
      if (es && es.readyState === 2) es.close();
    };

    return () => {
      cancelled = true;
      es?.removeEventListener('message', onMessage as EventListener);
      es?.removeEventListener('mode_change', onModeChange as EventListener);
      es?.removeEventListener('agent_typing', onTyping as EventListener);
      es?.removeEventListener('queue_update', onQueueUpdate as EventListener);
      es?.close();
      if (sourceRef.current === es) sourceRef.current = null;
    };
  }, [url]);
}
