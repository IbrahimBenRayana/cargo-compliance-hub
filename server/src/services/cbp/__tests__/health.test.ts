import { describe, expect, it } from 'vitest';
import { evaluateCbpHealth } from '../health.js';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const MIN = 60_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('evaluateCbpHealth', () => {
  it('reports disabled when this server has no live CBP transport', () => {
    expect(evaluateCbpHealth({ transport: 'mock', lastSuccessAt: null, uptimeMs: 0, now: NOW }))
      .toEqual({ state: 'disabled', healthy: true, lastSuccessSecondsAgo: null });
  });

  it('is healthy when the inbound pull succeeded recently', () => {
    const out = evaluateCbpHealth({ transport: 'mqipt', lastSuccessAt: ago(MIN), uptimeMs: 60 * MIN, now: NOW });
    expect(out).toEqual({ state: 'ok', healthy: true, lastSuccessSecondsAgo: 60 });
  });

  it('is unhealthy once the last success is older than the window', () => {
    const out = evaluateCbpHealth({ transport: 'mqipt', lastSuccessAt: ago(6 * MIN), uptimeMs: 60 * MIN, now: NOW });
    expect(out).toEqual({ state: 'stalled', healthy: false, lastSuccessSecondsAgo: 360 });
  });

  it('gives a fresh boot a grace period before the first success', () => {
    const out = evaluateCbpHealth({ transport: 'mqipt', lastSuccessAt: null, uptimeMs: 2 * MIN, now: NOW });
    expect(out).toEqual({ state: 'starting', healthy: true, lastSuccessSecondsAgo: null });
  });

  it('is unhealthy when it never succeeded after the grace period', () => {
    const out = evaluateCbpHealth({ transport: 'mqipt', lastSuccessAt: null, uptimeMs: 6 * MIN, now: NOW });
    expect(out).toEqual({ state: 'stalled', healthy: false, lastSuccessSecondsAgo: null });
  });
});
