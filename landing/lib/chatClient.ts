/**
 * Standalone chat client for the MyCargoLens marketing site.
 *
 * The marketing surface is anonymous: there's no account, so identity is an
 * opaque `conversationToken` the backend issues on conversation create. We
 * persist `{ conversationId, conversationToken }` in localStorage under
 * `mcl_chat` so the conversation survives reloads, and send the token back as
 * the `X-Chat-Token` header on JSON/stream POSTs and as `?token=` on the
 * EventSource.
 *
 * No React in here — this is a plain module. The widget components own all
 * state; this just owns the token/id and the wire protocol.
 */

// Marketing site → API base URL. Configured per-deploy via NEXT_PUBLIC_API_URL
// (e.g. https://app.mycargolens.com). Falls back to the dev server. Mirrors the
// pattern in app/contact/page.tsx.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

const CHAT_BASE = `${API_URL}/api/v1/chat`;
const STORAGE_KEY = "mcl_chat";

// ── Wire types ───────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system" | "agent";
export type ChatMode = "ai" | "human" | "pending_human";

export interface ChatConfig {
  enabled: boolean;
  aiEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  metadata?: unknown;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: {
    id: string;
    surface: string;
    mode: ChatMode;
    status: string;
    visitorName: string | null;
    visitorEmail: string | null;
    escalationReason: string | null;
    createdAt: string;
  };
  messages: ChatMessage[];
}

/** A unit yielded by `sendMessage`. */
export type SendEvent =
  | { type: "delta"; text: string }
  | { type: "escalated" }
  | { type: "human_mode" }
  | { type: "error"; code?: string; message: string };

export interface EscalateInput {
  reason?: string;
  name?: string;
  email?: string;
  /** Honeypot — kept blank by real users, populated by bots. */
  website?: string;
}

// Live events streamed over the EventSource.
export interface LiveMessageEvent {
  messageId: string;
  role: ChatRole;
  content: string;
  agentName?: string;
  createdAt: string;
}

export interface ModeChangeEvent {
  mode: ChatMode;
  assignedAgentName?: string;
}

// ── Persistence ──────────────────────────────────────────────────────────────

interface StoredSession {
  conversationId: string;
  conversationToken: string;
}

let session: StoredSession | null = null;

function loadStored(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      parsed &&
      typeof parsed.conversationId === "string" &&
      typeof parsed.conversationToken === "string"
    ) {
      return {
        conversationId: parsed.conversationId,
        conversationToken: parsed.conversationToken,
      };
    }
  } catch {
    // Corrupt entry — drop it.
  }
  return null;
}

function persist(s: StoredSession | null) {
  session = s;
  if (typeof window === "undefined") return;
  try {
    if (s) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode). The in-memory copy still
    // works for the lifetime of the page.
  }
}

// ── Getters ──────────────────────────────────────────────────────────────────

export function getConversationId(): string | null {
  return session?.conversationId ?? null;
}

export function getConversationToken(): string | null {
  return session?.conversationToken ?? null;
}

export function hasSession(): boolean {
  return session !== null;
}

/** Build the EventSource URL for the live events stream. Null if no session. */
export function eventsUrl(): string | null {
  if (!session) return null;
  return `${CHAT_BASE}/conversations/${session.conversationId}/events?token=${encodeURIComponent(
    session.conversationToken
  )}`;
}

// ── API ──────────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<ChatConfig> {
  const res = await fetch(`${CHAT_BASE}/config`, {
    method: "GET",
    credentials: "omit",
  });
  if (!res.ok) throw new Error(`config ${res.status}`);
  return (await res.json()) as ChatConfig;
}

/**
 * Reuse a stored conversation if one exists (and restore its transcript via
 * GET); if that 404s or the token is stale, create a fresh one. Returns the
 * conversation detail when an existing transcript was restored, otherwise
 * null (a brand new conversation has no messages worth returning).
 */
export async function createOrRestoreConversation(): Promise<ConversationDetail | null> {
  const stored = loadStored();
  if (stored) {
    session = stored;
    try {
      const detail = await getConversation();
      return detail;
    } catch {
      // 404 / stale token — fall through to create a new conversation.
      persist(null);
    }
  }
  await createConversation();
  return null;
}

async function createConversation(): Promise<void> {
  const res = await fetch(`${CHAT_BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ surface: "marketing" }),
  });
  if (!res.ok) throw new Error(`create ${res.status}`);
  const data = (await res.json()) as {
    conversationId: string;
    conversationToken: string;
  };
  persist({
    conversationId: data.conversationId,
    conversationToken: data.conversationToken,
  });
}

export async function getConversation(): Promise<ConversationDetail> {
  if (!session) throw new Error("no session");
  const res = await fetch(
    `${CHAT_BASE}/conversations/${session.conversationId}`,
    {
      method: "GET",
      headers: { "X-Chat-Token": session.conversationToken },
      credentials: "omit",
    }
  );
  if (!res.ok) throw new Error(`get ${res.status}`);
  return (await res.json()) as ConversationDetail;
}

/**
 * Send a visitor message. When mode is 'ai' the server replies with a
 * text/event-stream; we parse SSE frames and yield deltas. When mode is
 * 'human'/'pending_human' the server returns HTTP 204 (no stream): the
 * message went to a live agent and their reply will arrive over the events
 * stream — we yield `human_mode` and return.
 */
export async function* sendMessage(content: string): AsyncGenerator<SendEvent> {
  if (!session) {
    yield { type: "error", message: "No active conversation." };
    return;
  }

  let res: Response;
  try {
    res = await fetch(
      `${CHAT_BASE}/conversations/${session.conversationId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Chat-Token": session.conversationToken,
        },
        credentials: "omit",
        body: JSON.stringify({ content }),
      }
    );
  } catch {
    yield {
      type: "error",
      message: "Couldn't reach the server. Please try again.",
    };
    return;
  }

  // 204 (and any non-stream success) means the turn went to a live agent.
  if (res.status === 204) {
    yield { type: "human_mode" };
    return;
  }

  if (!res.ok) {
    if (res.status === 429) {
      yield {
        type: "error",
        code: "ai_rate_limited",
        message: "You're sending messages too quickly. Please wait a moment.",
      };
    } else {
      yield {
        type: "error",
        code: "chat_error",
        message: "Something went wrong. Please try again.",
      };
    }
    return;
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !res.body) {
    // Not a stream — treat as a handoff to a human.
    yield { type: "human_mode" };
    return;
  }

  // ── SSE reader loop ─────────────────────────────────────────────────────
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const rawFrame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        const frame = parseSseFrame(rawFrame);
        if (!frame) continue;

        if (frame.event === "escalated") {
          yield { type: "escalated" };
          continue;
        }
        if (frame.event === "done") {
          return;
        }
        if (frame.event === "error") {
          let code: string | undefined;
          let message = "Something went wrong.";
          try {
            const parsed = JSON.parse(frame.data) as {
              error?: string;
              code?: string;
            };
            code = parsed.code;
            if (parsed.error) message = parsed.error;
          } catch {
            // keep defaults
          }
          if (code === "ai_unavailable") {
            message =
              "Our AI assistant is unavailable right now. You can talk to a human instead.";
          } else if (code === "ai_rate_limited") {
            message =
              "You're sending messages too quickly. Please wait a moment.";
          }
          yield { type: "error", code, message };
          continue;
        }

        // Default (no explicit event) → a delta frame.
        if (frame.data) {
          try {
            const parsed = JSON.parse(frame.data) as { delta?: string };
            if (typeof parsed.delta === "string" && parsed.delta.length > 0) {
              yield { type: "delta", text: parsed.delta };
            }
          } catch {
            // Ignore non-JSON data frames (e.g. heartbeat comments handled
            // below at the line level).
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // already closed
    }
  }
}

/**
 * Parse a single SSE frame into { event, data }. A frame may have multiple
 * `data:` lines (joined by "\n") and an optional `event:` line. Comment lines
 * (starting with ":") — used for heartbeats — are ignored.
 */
function parseSseFrame(raw: string): { event?: string; data: string } | null {
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue; // blank / heartbeat comment
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }

  if (event === undefined && dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export async function escalate(input: EscalateInput): Promise<ModeChangeEvent> {
  if (!session) throw new Error("no session");
  const res = await fetch(
    `${CHAT_BASE}/conversations/${session.conversationId}/escalate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Chat-Token": session.conversationToken,
      },
      credentials: "omit",
      body: JSON.stringify({
        reason: input.reason,
        name: input.name,
        email: input.email,
        website: input.website ?? "",
      }),
    }
  );
  if (!res.ok) throw new Error(`escalate ${res.status}`);
  return (await res.json()) as ModeChangeEvent;
}
