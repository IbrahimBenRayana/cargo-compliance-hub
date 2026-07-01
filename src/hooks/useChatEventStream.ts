import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '@/api/client';
import type { ChatMode, ChatRole } from '@/api/client';

/**
 * Resilient chat events stream (shared by the widget and the admin console).
 *
 * Opens an EventSource and forwards named events to callbacks. Unlike a bare
 * EventSource, this:
 *   • auto-reconnects with exponential backoff on ANY drop (including the
 *     CLOSED / auth-failure case a plain EventSource gives up on),
 *   • re-reads the access token on every reconnect (so a token refresh doesn't
 *     leave a permanently-dead stream),
 *   • fires `onOpen` on every (re)connect so the consumer can catch up on any
 *     messages missed while disconnected (this is what makes "you never have to
 *     refresh" true), and
 *   • surfaces a `connected` flag for a subtle status indicator.
 *
 *   message      → a live agent / system reply.
 *   mode_change  → conversation mode flipped; update badge + composer.
 *   agent_typing → show a brief typing indicator.
 *   queue_update → (admin console) refetch the queue.
 *   : heartbeat  → comment frame, ignored by EventSource.
 */

export interface ChatStreamMessage {
  messageId: string;
  /** Client nonce echoed back so the sender can reconcile its optimistic copy. */
  clientId?: string;
  role: ChatRole;
  content: string;
  agentName?: string;
  createdAt: string;
  conversationId?: string;
  lastMessageAt?: string;
}

export interface ChatModeChange {
  mode: ChatMode;
  assignedAgentName?: string;
  conversationId?: string;
}

export interface ChatQueueUpdate {
  conversationId: string;
  mode: ChatMode;
  lastMessageAt?: string;
  surface: 'app' | 'marketing';
}

export interface ChatStreamCallbacks {
  onMessage?: (msg: ChatStreamMessage) => void;
  onModeChange?: (change: ChatModeChange) => void;
  onTyping?: (data: { conversationId?: string }) => void;
  onQueueUpdate?: (update: ChatQueueUpdate) => void;
  /** Fired on every (re)connect — catch up on anything missed while offline. */
  onOpen?: () => void;
}

const MAX_BACKOFF_MS = 15_000;

export function useChatEventStream(
  url: string | null,
  callbacks: ChatStreamCallbacks,
): { connected: boolean } {
  // Keep callbacks in a ref so the stream isn't torn down every render.
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url) {
      setConnected(false);
      return;
    }

    let stopped = false;
    let es: EventSource | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const parse = <T,>(raw: string): T | null => {
      try { return JSON.parse(raw) as T; } catch { return null; }
    };

    const scheduleReconnect = () => {
      if (stopped || timer) return;
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      timer = setTimeout(() => { timer = null; connect(); }, delay);
    };

    const connect = () => {
      if (stopped) return;
      const token = getAccessToken();
      if (!token) {
        // Logged out / token not ready — try again shortly.
        scheduleReconnect();
        return;
      }
      const apiBase = import.meta.env.VITE_API_URL || '';
      const fullUrl = `${apiBase}${url}?token=${encodeURIComponent(token)}`;

      try {
        es = new EventSource(fullUrl);
      } catch {
        scheduleReconnect();
        return;
      }

      es.onopen = () => {
        if (stopped) return;
        attempt = 0;
        setConnected(true);
        cbRef.current.onOpen?.();
      };

      es.addEventListener('message', (ev: MessageEvent) => {
        if (stopped) return;
        const data = parse<ChatStreamMessage>(ev.data);
        if (data) cbRef.current.onMessage?.(data);
      });
      es.addEventListener('mode_change', (ev: MessageEvent) => {
        if (stopped) return;
        const data = parse<ChatModeChange>(ev.data);
        if (data) cbRef.current.onModeChange?.(data);
      });
      es.addEventListener('agent_typing', (ev: MessageEvent) => {
        if (stopped) return;
        cbRef.current.onTyping?.(parse<{ conversationId?: string }>(ev.data) ?? {});
      });
      es.addEventListener('queue_update', (ev: MessageEvent) => {
        if (stopped) return;
        const data = parse<ChatQueueUpdate>(ev.data);
        if (data) cbRef.current.onQueueUpdate?.(data);
      });

      es.onerror = () => {
        if (stopped) return;
        setConnected(false);
        // Recreate ourselves rather than trust the native retry (which gives up
        // permanently on a CLOSED/auth error). Backoff prevents a hot loop.
        try { es?.close(); } catch { /* noop */ }
        es = null;
        scheduleReconnect();
      };
    };

    connect();

    // Reconnect immediately when the tab regains focus / comes back online —
    // onOpen then resyncs, so a backgrounded tab catches up instantly.
    const onWake = () => {
      if (stopped) return;
      if (!es || es.readyState === 2) {
        attempt = 0;
        if (timer) { clearTimeout(timer); timer = null; }
        connect();
      }
    };
    window.addEventListener('online', onWake);
    window.addEventListener('visibilitychange', onWake);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', onWake);
      window.removeEventListener('visibilitychange', onWake);
      try { es?.close(); } catch { /* noop */ }
      setConnected(false);
    };
  }, [url]);

  return { connected };
}
