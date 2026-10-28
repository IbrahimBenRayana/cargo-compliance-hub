/** BUG-006: every background job reports when it last ran and whether it failed. */
import { describe, it, expect } from 'vitest';
import { tracked, jobHealthSnapshot } from '../jobHealth.js';

describe('jobHealth', () => {
  it('records a successful run', async () => {
    await tracked('t-ok', async () => 'done')();
    const j = jobHealthSnapshot()['t-ok'];
    expect(j.runs).toBe(1);
    expect(j.lastSuccessAt).not.toBeNull();
    expect(j.lastError).toBeNull();
    expect(j.running).toBe(false);
  });

  it('records a failure and still rethrows it', async () => {
    await expect(tracked('t-fail', async () => { throw new Error('queue down'); })()).rejects.toThrow('queue down');
    const j = jobHealthSnapshot()['t-fail'];
    expect(j.lastError).toBe('queue down');
    expect(j.lastErrorAt).not.toBeNull();
    expect(j.lastSuccessAt).toBeNull();
  });

  it('clears the error after the next success', async () => {
    await tracked('t-flip', async () => { throw new Error('x'); })().catch(() => undefined);
    await tracked('t-flip', async () => undefined)();
    expect(jobHealthSnapshot()['t-flip'].lastError).toBeNull();
    expect(jobHealthSnapshot()['t-flip'].runs).toBe(2);
  });
});
