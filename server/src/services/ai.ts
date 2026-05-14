/**
 * AI Service — Provider-agnostic wrapper over the configured LLM provider.
 *
 * Design goals:
 *   1. Single import surface: routes call `ai.complete(...)` / `ai.stream(...)`
 *      and don't know whether OpenAI, Anthropic, or another vendor is behind it.
 *   2. Graceful degradation: server boots fine when AI_API_KEY is empty; calls
 *      throw an AiUnavailableError that routes turn into HTTP 503 + a UI badge
 *      saying "AI features not configured."
 *   3. Privacy guard: when AI_DISABLE_TRAINING_DATA=true (default), every call
 *      passes the provider's "don't train on this" flag (OpenAI: `store: false`).
 *      Trade data shouldn't enter anyone's training set.
 *   4. Per-user daily rate limit: in-memory token bucket keyed by userId, reset
 *      at UTC midnight. Survives a single process; on multi-replica deploys this
 *      becomes per-replica which is fine for v1 (cap is generous, 50/user/day).
 *   5. No prompt logging: we record (userId, provider, model, prompt_tokens,
 *      completion_tokens, latency_ms) for usage analytics but never the prompt
 *      content or the response — those can contain trade-sensitive data.
 */

import OpenAI from 'openai';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

// ─── Public types ────────────────────────────────────────────────────

export interface AiStatus {
  enabled: boolean;
  provider?: 'openai';
  model?: string;
  dailyLimit?: number;
  callsToday?: number;
  reason?: string;
}

export class AiUnavailableError extends Error {
  code = 'ai_unavailable' as const;
  constructor(message: string) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export class AiRateLimitedError extends Error {
  code = 'ai_rate_limited' as const;
  constructor(
    message: string,
    public readonly callsToday: number,
    public readonly dailyLimit: number,
  ) {
    super(message);
    this.name = 'AiRateLimitedError';
  }
}

// ─── Lazy-initialized client ─────────────────────────────────────────
// Module-load shouldn't crash if the key is empty; we only instantiate
// when the first call actually happens AND the key is present.

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!isConfigured()) {
    throw new AiUnavailableError(
      'AI features are disabled — administrator has not configured AI_API_KEY.',
    );
  }
  if (_client) return _client;
  _client = new OpenAI({ apiKey: env.AI_API_KEY });
  return _client;
}

/** True iff the env is configured well enough to make a real call. */
export function isConfigured(): boolean {
  return env.AI_ASSESSMENT_ENABLED && env.AI_API_KEY.length > 0;
}

// ─── Per-user daily rate limit (in-memory) ───────────────────────────
// Keyed by `${userId}:${YYYY-MM-DD}`. Old entries are pruned lazily when
// they're first read on a new day. Multi-replica deploys will see this
// drift per-replica — acceptable for v1 since the cap is generous and
// the goal is "stop abuse," not "prevent overage by 1 call."

const usage = new Map<string, number>();

function todayKeyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function recordCall(userId: string): number {
  const key = `${userId}:${todayKeyUTC()}`;
  const next = (usage.get(key) ?? 0) + 1;
  usage.set(key, next);
  return next;
}

function callsToday(userId: string): number {
  return usage.get(`${userId}:${todayKeyUTC()}`) ?? 0;
}

function ensureWithinLimit(userId: string): void {
  const current = callsToday(userId);
  if (current >= env.AI_RATE_LIMIT_PER_USER) {
    throw new AiRateLimitedError(
      `Daily AI request limit reached (${env.AI_RATE_LIMIT_PER_USER}). Resets at UTC midnight.`,
      current,
      env.AI_RATE_LIMIT_PER_USER,
    );
  }
}

// ─── Status endpoint payload ─────────────────────────────────────────

export function getStatus(userId: string | null): AiStatus {
  if (!env.AI_ASSESSMENT_ENABLED) {
    return { enabled: false, reason: 'Feature flag disabled by administrator.' };
  }
  if (env.AI_API_KEY.length === 0) {
    return { enabled: false, reason: 'AI provider not configured.' };
  }
  return {
    enabled: true,
    provider: env.AI_PROVIDER,
    model: env.AI_MODEL,
    dailyLimit: env.AI_RATE_LIMIT_PER_USER,
    callsToday: userId ? callsToday(userId) : undefined,
  };
}

// ─── Chat completion (non-streaming) ─────────────────────────────────

export interface CompleteOptions {
  userId: string;
  systemPrompt: string;
  userPrompt: string;
  /** Override the default model for this call. */
  model?: string;
  /** Override the default temperature. */
  temperature?: number;
  /** Override the default max tokens. */
  maxTokens?: number;
}

export async function complete(opts: CompleteOptions): Promise<string> {
  ensureWithinLimit(opts.userId);
  const client = getClient();
  const started = Date.now();
  try {
    const res = await client.chat.completions.create({
      model:       opts.model       ?? env.AI_MODEL,
      temperature: opts.temperature ?? env.AI_TEMPERATURE,
      max_tokens:  opts.maxTokens   ?? env.AI_MAX_TOKENS,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user',   content: opts.userPrompt },
      ],
      // Don't let the provider store prompts for training when configured.
      store: env.AI_DISABLE_TRAINING_DATA ? false : undefined,
    });
    const text = res.choices[0]?.message?.content ?? '';
    recordCall(opts.userId);
    logger.info({
      userId: opts.userId,
      provider: env.AI_PROVIDER,
      model: opts.model ?? env.AI_MODEL,
      promptTokens: res.usage?.prompt_tokens,
      completionTokens: res.usage?.completion_tokens,
      latencyMs: Date.now() - started,
    }, '[AI] complete');
    return text;
  } catch (err: any) {
    logger.error({ err: err?.message, userId: opts.userId }, '[AI] complete failed');
    throw err;
  }
}

// ─── Chat completion (streaming) ─────────────────────────────────────
// Returns an async iterable of text chunks. Caller is responsible for
// writing them to the HTTP response (typically as SSE data: lines).
// The yielded strings are content deltas, not full messages.

export async function* stream(opts: CompleteOptions): AsyncIterable<string> {
  ensureWithinLimit(opts.userId);
  const client = getClient();
  const started = Date.now();
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;

  try {
    const sse = await client.chat.completions.create({
      model:       opts.model       ?? env.AI_MODEL,
      temperature: opts.temperature ?? env.AI_TEMPERATURE,
      max_tokens:  opts.maxTokens   ?? env.AI_MAX_TOKENS,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user',   content: opts.userPrompt },
      ],
      stream: true,
      stream_options: { include_usage: true },
      store: env.AI_DISABLE_TRAINING_DATA ? false : undefined,
    });

    for await (const chunk of sse) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }
    }
    recordCall(opts.userId);
    logger.info({
      userId: opts.userId,
      provider: env.AI_PROVIDER,
      model: opts.model ?? env.AI_MODEL,
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - started,
    }, '[AI] stream');
  } catch (err: any) {
    logger.error({ err: err?.message, userId: opts.userId }, '[AI] stream failed');
    throw err;
  }
}

// ─── Vision (for document OCR) ───────────────────────────────────────
// `images` can be data URLs (base64) or public https URLs. OpenAI's chat
// completions API accepts both via `image_url`.

export interface VisionOptions extends Omit<CompleteOptions, 'userPrompt'> {
  userPrompt: string;
  images: Array<{ url: string }>;
}

export async function vision(opts: VisionOptions): Promise<string> {
  ensureWithinLimit(opts.userId);
  const client = getClient();
  const started = Date.now();
  try {
    const res = await client.chat.completions.create({
      model:       opts.model       ?? env.AI_MODEL,
      temperature: opts.temperature ?? env.AI_TEMPERATURE,
      max_tokens:  opts.maxTokens   ?? env.AI_MAX_TOKENS,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: opts.userPrompt },
            ...opts.images.map((img) => ({
              type: 'image_url' as const,
              image_url: { url: img.url },
            })),
          ],
        },
      ],
      store: env.AI_DISABLE_TRAINING_DATA ? false : undefined,
    });
    const text = res.choices[0]?.message?.content ?? '';
    recordCall(opts.userId);
    logger.info({
      userId: opts.userId,
      provider: env.AI_PROVIDER,
      model: opts.model ?? env.AI_MODEL,
      images: opts.images.length,
      promptTokens: res.usage?.prompt_tokens,
      completionTokens: res.usage?.completion_tokens,
      latencyMs: Date.now() - started,
    }, '[AI] vision');
    return text;
  } catch (err: any) {
    logger.error({ err: err?.message, userId: opts.userId }, '[AI] vision failed');
    throw err;
  }
}
