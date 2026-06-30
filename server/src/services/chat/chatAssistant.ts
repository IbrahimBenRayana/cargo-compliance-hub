/**
 * Assistant orchestration: assemble context → resolve tool calls (bounded) →
 * stream the final answer.
 *
 * Cost shape per user message:
 *   • No tools needed (the common case): ONE non-streaming detection call; its
 *     text is replayed to the client as word-chunked deltas (cheap, still feels
 *     like typing). No second model call.
 *   • Tools needed: up to MAX_TOOL_ROUNDS non-streaming rounds to run the tools,
 *     then ONE streaming call to synthesize the answer with the tool results in
 *     context (true token streaming).
 *
 * The per-key daily cap (services/ai.ts) bounds total spend; MAX_TOOL_ROUNDS
 * bounds a single message.
 */
import type { OpenAI } from 'openai';
import * as ai from '../ai.js';
import logger from '../../config/logger.js';
import { buildSystemPrompt, type ChatSurface } from './knowledge/index.js';
import { toolsForSurface, dispatchTool, type ToolContext } from './tools.js';
import { getRecentMessages } from './chatService.js';

const MAX_TOOL_ROUNDS = 3;

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export interface AssistantEvent {
  delta?: string;
  deeplink?: { url: string; label: string };
  escalated?: boolean;
}

export interface StreamAssistantOptions {
  conversationId: string;
  surface: ChatSurface;
  rateKey: string;
  dailyLimit?: number;
  orgId: string | null;
  userText: string;
  /** Performs the escalation side-effect (chatService.escalateConversation). */
  escalate: (reason: string) => Promise<void>;
}

/** Replay a finished string as small word-grouped chunks for a typing feel. */
async function* wordChunks(text: string): AsyncGenerator<string> {
  const parts = text.match(/\S+\s*/g) ?? [text];
  let buf = '';
  let n = 0;
  for (const p of parts) {
    buf += p;
    if (++n >= 3) {
      yield buf;
      buf = '';
      n = 0;
    }
  }
  if (buf) yield buf;
}

export async function* streamAssistant(opts: StreamAssistantOptions): AsyncGenerator<AssistantEvent> {
  const tools = toolsForSurface(opts.surface);
  const history = await getRecentMessages(opts.conversationId);

  const messages: Msg[] = [
    { role: 'system', content: buildSystemPrompt(opts.surface) },
    ...history.map((m): Msg => ({
      // A human agent's prior turn is context for the model as an assistant turn.
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: opts.userText },
  ];

  const ctx: ToolContext = {
    surface: opts.surface,
    orgId: opts.orgId,
    escalate: opts.escalate,
  };

  let usedTools = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const resp = await ai.chatTurn({
      rateKey: opts.rateKey,
      dailyLimit: opts.dailyLimit,
      messages,
      tools,
    });
    const choice = resp.choices[0]?.message;
    const toolCalls = choice?.tool_calls ?? [];

    if (toolCalls.length === 0) {
      // Final answer already produced and no tools were needed this turn.
      if (!usedTools) {
        // Common path — replay the detection text as chunks (no extra call).
        yield* mapChunks(wordChunks(choice?.content ?? ''));
        return;
      }
      // Tools ran earlier; stream a fresh synthesis with the tool results in context.
      break;
    }

    usedTools = true;
    // Echo the assistant's tool-call turn, then each tool result.
    messages.push({
      role: 'assistant',
      content: choice?.content ?? '',
      tool_calls: toolCalls,
    });
    for (const tc of toolCalls) {
      if (tc.type !== 'function') continue;
      const result = await dispatchTool(tc.function.name, tc.function.arguments, ctx);
      if (result.deeplink) yield { deeplink: result.deeplink };
      if (result.escalated) yield { escalated: true };
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result.content,
      });
    }
  }

  // Stream the final synthesis (messages now include any tool outputs).
  try {
    for await (const delta of ai.streamMessages({
      rateKey: opts.rateKey,
      dailyLimit: opts.dailyLimit,
      messages,
    })) {
      yield { delta };
    }
  } catch (err: any) {
    logger.error({ err: err?.message, conversationId: opts.conversationId }, '[Chat] synthesis stream failed');
    throw err;
  }
}

async function* mapChunks(gen: AsyncGenerator<string>): AsyncGenerator<AssistantEvent> {
  for await (const delta of gen) yield { delta };
}
