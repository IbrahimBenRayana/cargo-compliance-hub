import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  chatApi,
  type ChatConfig,
  type ChatDeeplink,
  type ChatMessage,
  type ChatMode,
} from '@/api/client';
import { useChatEventStream } from '@/hooks/useChatEventStream';

const STORAGE_KEY = 'mcl_app_chat';

/**
 * A message as the widget renders it. Mirrors the API ChatMessage but adds a
 * client-only `pending` flag for the optimistic user bubble and a `streaming`
 * flag for the live assistant bubble currently receiving deltas.
 */
export interface UiMessage {
  id: string;
  role: ChatMessage['role'];
  content: string;
  deeplinks?: ChatDeeplink[];
  agentName?: string;
  createdAt: string;
  pending?: boolean;
  streaming?: boolean;
  /** Client nonce for optimistic-message reconciliation (admin replies). */
  clientId?: string;
  /** Delivery state of an optimistic message. */
  status?: 'sending' | 'sent' | 'failed';
}

interface ChatState {
  conversationId: string | null;
  mode: ChatMode;
  agentName: string | null;
  messages: UiMessage[];
  /** Streaming a reply / awaiting the server. Disables the composer. */
  busy: boolean;
  /** Other party (agent) is typing. */
  agentTyping: boolean;
  config: ChatConfig | null;
  loading: boolean;
  error: string | null;
  /** ai_unavailable surfaced — offer the human CTA prominently. */
  aiUnavailable: boolean;
}

type Action =
  | { type: 'init'; conversationId: string; mode: ChatMode; messages: UiMessage[] }
  | { type: 'resync'; mode: ChatMode; messages: UiMessage[] }
  | { type: 'config'; config: ChatConfig }
  | { type: 'loading'; loading: boolean }
  | { type: 'addMessage'; message: UiMessage }
  | { type: 'upsertMessage'; message: UiMessage }
  | { type: 'appendDelta'; id: string; text: string }
  | { type: 'addDeeplink'; id: string; link: ChatDeeplink }
  | { type: 'finishStream'; id: string }
  | { type: 'busy'; busy: boolean }
  | { type: 'mode'; mode: ChatMode; agentName?: string | null }
  | { type: 'typing'; typing: boolean }
  | { type: 'error'; error: string | null; aiUnavailable?: boolean };

const initialState: ChatState = {
  conversationId: null,
  mode: 'ai',
  agentName: null,
  messages: [],
  busy: false,
  agentTyping: false,
  config: null,
  loading: false,
  error: null,
  aiUnavailable: false,
};

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'init':
      return {
        ...state,
        conversationId: action.conversationId,
        mode: action.mode,
        messages: action.messages,
        loading: false,
        error: null,
      };
    case 'resync': {
      // Server transcript is the source of truth; preserve only an in-flight
      // streaming assistant bubble (not yet persisted). This heals any message
      // missed while the stream was disconnected — no manual refresh needed.
      const streaming = state.messages.filter((m) => m.streaming);
      return { ...state, mode: action.mode, messages: [...action.messages, ...streaming] };
    }
    case 'config':
      return { ...state, config: action.config };
    case 'loading':
      return { ...state, loading: action.loading };
    case 'addMessage':
      return { ...state, messages: [...state.messages, action.message] };
    case 'upsertMessage': {
      // Dedupe by id — the events stream may echo a message we already have.
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      return { ...state, messages: [...state.messages, action.message] };
    }
    case 'appendDelta':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, content: m.content + action.text } : m,
        ),
      };
    case 'addDeeplink':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? { ...m, deeplinks: [...(m.deeplinks ?? []), action.link] }
            : m,
        ),
      };
    case 'finishStream':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, streaming: false } : m,
        ),
      };
    case 'busy':
      return { ...state, busy: action.busy };
    case 'mode':
      return {
        ...state,
        mode: action.mode,
        agentName: action.agentName !== undefined ? action.agentName : state.agentName,
        // Leaving an AI-unavailable state when a human picks up clears the flag.
        aiUnavailable: action.mode === 'ai' ? state.aiUnavailable : false,
      };
    case 'typing':
      return { ...state, agentTyping: action.typing };
    case 'error':
      return {
        ...state,
        error: action.error,
        aiUnavailable: action.aiUnavailable ?? state.aiUnavailable,
      };
    default:
      return state;
  }
}

function toUiMessage(m: ChatMessage): UiMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    deeplinks: m.metadata?.deeplinks,
    createdAt: m.createdAt,
  };
}

let uid = 0;
const localId = (prefix: string) => `${prefix}-${Date.now()}-${uid++}`;

/**
 * Encapsulates the signed-in chat widget's conversation lifecycle: lazy
 * creation (with localStorage restore), streamed sends, escalation, and the
 * live events stream (agent replies, mode changes, typing).
 *
 * @param active Whether the widget is open. The conversation is created /
 *               restored on the first time this flips true, and the events
 *               stream only runs while active.
 */
export function useChat(active: boolean) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  // ── Lazy create / restore on first open ──
  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    (async () => {
      dispatch({ type: 'loading', loading: true });
      // Config first — drives graceful degradation.
      try {
        const config = await chatApi.getConfig();
        if (cancelled) return;
        dispatch({ type: 'config', config });
        if (!config.enabled) {
          dispatch({ type: 'loading', loading: false });
          return;
        }
      } catch {
        // Treat a config failure as "enabled" so the widget still works.
      }

      // Try to restore the last conversation; fall back to a fresh one.
      const saved = (() => {
        try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
      })();

      if (saved) {
        try {
          const res = await chatApi.getConversation(saved);
          if (cancelled) return;
          dispatch({
            type: 'init',
            conversationId: res.conversation.id,
            mode: res.conversation.mode,
            messages: res.messages.map(toUiMessage),
          });
          if (res.conversation.assignedAgentId) {
            dispatch({ type: 'mode', mode: res.conversation.mode });
          }
          return;
        } catch {
          // Stale / expired id — drop it and create a new conversation.
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        }
      }

      try {
        const created = await chatApi.createConversation();
        if (cancelled) return;
        try { localStorage.setItem(STORAGE_KEY, created.conversationId); } catch { /* ignore */ }
        dispatch({
          type: 'init',
          conversationId: created.conversationId,
          mode: created.mode,
          messages: [],
        });
      } catch {
        if (!cancelled) {
          dispatch({ type: 'loading', loading: false });
          dispatch({ type: 'error', error: 'Could not start a chat. Please try again.' });
          startedRef.current = false; // allow a retry on next open
        }
      }
    })();

    return () => { cancelled = true; };
  }, [active]);

  // ── Live events: agent / system messages, mode changes, typing ──
  const eventUrl =
    active && state.conversationId
      ? `/api/v1/chat/conversations/${state.conversationId}/events`
      : null;

  // Refs so the resync closure isn't stale and doesn't clobber an in-flight send.
  const busyRef = useRef(state.busy);
  busyRef.current = state.busy;
  const convIdRef = useRef(state.conversationId);
  convIdRef.current = state.conversationId;

  // Catch up on anything missed while the stream was disconnected. Runs on every
  // (re)connect and on tab focus. Skipped mid-send so it can't reorder a live
  // AI stream.
  const resync = useCallback(async () => {
    const cid = convIdRef.current;
    if (!cid || busyRef.current) return;
    try {
      const res = await chatApi.getConversation(cid);
      dispatch({ type: 'resync', mode: res.conversation.mode, messages: res.messages.map(toUiMessage) });
    } catch { /* transient — the next reconnect will retry */ }
  }, []);

  const { connected } = useChatEventStream(eventUrl, {
    onOpen: resync,
    onMessage: (msg) => {
      // User messages aren't echoed back to their own stream; only agent /
      // system messages arrive here. Dedupe by id to be safe.
      dispatch({
        type: 'upsertMessage',
        message: {
          id: msg.messageId,
          role: msg.role,
          content: msg.content,
          agentName: msg.agentName,
          createdAt: msg.createdAt,
        },
      });
      dispatch({ type: 'typing', typing: false });
    },
    onModeChange: (change) => {
      dispatch({ type: 'mode', mode: change.mode, agentName: change.assignedAgentName ?? null });
    },
    onTyping: () => {
      dispatch({ type: 'typing', typing: true });
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => dispatch({ type: 'typing', typing: false }), 4000);
    },
  });

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  // ── Send a message ──
  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !state.conversationId || state.busy) return;

      const userMsg: UiMessage = {
        id: localId('u'),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      dispatch({ type: 'addMessage', message: userMsg });
      dispatch({ type: 'busy', busy: true });
      dispatch({ type: 'error', error: null });

      // In a human/pending mode the send is fire-and-forget (204) — the
      // agent's reply arrives over the events stream.
      const humanMode = state.mode === 'human' || state.mode === 'pending_human';
      const assistantId = localId('a');
      if (!humanMode) {
        dispatch({
          type: 'addMessage',
          message: {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            streaming: true,
          },
        });
      }

      try {
        let sawDelta = false;
        for await (const ev of chatApi.sendMessage(state.conversationId, text)) {
          switch (ev.type) {
            case 'delta':
              sawDelta = true;
              dispatch({ type: 'appendDelta', id: assistantId, text: ev.text });
              break;
            case 'deeplink':
              dispatch({ type: 'addDeeplink', id: assistantId, link: { url: ev.url, label: ev.label } });
              break;
            case 'escalated':
              dispatch({ type: 'mode', mode: 'pending_human' });
              break;
            case 'error':
              dispatch({
                type: 'error',
                error: ev.message,
                aiUnavailable: ev.code === 'ai_unavailable',
              });
              if (!sawDelta) {
                dispatch({ type: 'finishStream', id: assistantId });
              }
              break;
          }
        }
      } catch (err: unknown) {
        dispatch({
          type: 'error',
          error: err instanceof Error ? err.message : 'Something went wrong sending your message.',
        });
      } finally {
        dispatch({ type: 'finishStream', id: assistantId });
        dispatch({ type: 'busy', busy: false });
      }
    },
    [state.conversationId, state.busy, state.mode],
  );

  // ── Escalate to a human ──
  const escalate = useCallback(
    async (reason?: string) => {
      if (!state.conversationId) return;
      try {
        const res = await chatApi.escalate(state.conversationId, reason);
        dispatch({ type: 'mode', mode: res.mode });
        dispatch({ type: 'error', error: null, aiUnavailable: false });
      } catch {
        dispatch({ type: 'error', error: 'Could not connect you to a specialist. Please try again.' });
      }
    },
    [state.conversationId],
  );

  return { state, send, escalate, connected };
}
