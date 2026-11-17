import { describe, it, expect } from 'vitest';
import { countdownLabel, formatDuration, urgencyOf } from '../countdown';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('urgencyOf', () => {
  it.each([
    [-1, 'overdue'],
    [0, 'urgent'],
    [DAY, 'urgent'],
    [DAY + 1, 'soon'],
    [3 * DAY, 'soon'],
    [3 * DAY + 1, 'calm'],
  ])('%i ms left is %s', (ms, level) => {
    expect(urgencyOf(ms)).toBe(level);
  });
});

describe('formatDuration', () => {
  it.each([
    [30_000, '<1m'],
    [45 * MIN, '45m'],
    [HOUR, '1h'],
    [4 * HOUR + 12 * MIN, '4h 12m'],
    [2 * DAY, '2d'],
    [2 * DAY + 3 * HOUR, '2d 3h'],
  ])('%i ms reads %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
  it('reads the same past the deadline', () => {
    expect(formatDuration(-3 * HOUR)).toBe('3h');
  });
});

describe('countdownLabel', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  const at = (ms: number) => new Date(now + ms).toISOString();
  it('is plain for an exact cutoff', () => {
    expect(countdownLabel(at(4 * HOUR), 'LADING', now)).toBe('4h');
  });
  it('marks an estimate, because the lading date is unknown', () => {
    expect(countdownLabel(at(4 * HOUR), 'ETD_ESTIMATE', now)).toBe('Est. 4h');
  });
  it('says when a cutoff has passed, estimate or not', () => {
    expect(countdownLabel(at(-3 * HOUR), 'ETD_ESTIMATE', now)).toBe('3h over');
  });
});
