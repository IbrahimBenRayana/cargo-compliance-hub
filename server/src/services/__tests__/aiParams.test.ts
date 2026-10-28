/**
 * Reasoning models (o-series, GPT-5 and later) reject temperature and
 * max_tokens; probed against the staging key on 2026-10-21.
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../config/logger.js', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
import { completionParams } from '../ai.js';

describe('completionParams', () => {
  it('sends temperature and max_tokens to classic chat models', () => {
    expect(completionParams('gpt-4o', { temperature: 0, maxTokens: 800 })).toEqual({ temperature: 0, max_tokens: 800 });
    expect(completionParams('gpt-4.1', { temperature: 0.3, maxTokens: 100 })).toEqual({ temperature: 0.3, max_tokens: 100 });
  });

  it('sends max_completion_tokens (room for reasoning) and effort to reasoning models, never temperature', () => {
    for (const model of ['o3', 'o4-mini', 'gpt-5.5', 'gpt-6-sol']) {
      const p = completionParams(model, { temperature: 0, maxTokens: 800, reasoningEffort: 'high' });
      expect(p).toEqual({ max_completion_tokens: 800 + 8000, reasoning_effort: 'high' });
    }
  });

  it('leaves effort to the model default when none is asked for', () => {
    expect(completionParams('o3', { temperature: 0, maxTokens: 100 })).toEqual({ max_completion_tokens: 8100 });
  });
});
