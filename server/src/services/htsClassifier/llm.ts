/**
 * Every AI call the HTS classifier makes goes through here: deterministic
 * (temperature 0), JSON replies, its own model setting and daily budget.
 */
import { complete } from '../ai.js';
import { env } from '../../config/env.js';

export const classifierModel = (): string => env.HTS_AI_MODEL || env.AI_MODEL;
export const verifyModel = (): string => env.HTS_AI_VERIFY_MODEL || classifierModel();
export const precedentEnabled = (): boolean => env.HTS_PRECEDENT !== 'off';

export async function askJson(
  userId: string, systemPrompt: string, userPrompt: string, maxTokens = 1200, model = classifierModel(),
): Promise<unknown> {
  const text = await complete({
    userId,
    systemPrompt,
    userPrompt,
    model,
    temperature: 0,
    maxTokens,
    json: true,
    reasoningEffort: env.HTS_AI_REASONING_EFFORT,
    rateBucket: { key: 'hts', limit: env.HTS_AI_DAILY_CALLS },
  });
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
