/**
 * Last-run bookkeeping for every background job (BUG-006): /jobs/status used
 * to report only three of them, so a stalled CBP inbound pull or email drain
 * needed log digging. In-process (single VPS); resets on restart.
 */
export interface JobHealth {
  runs: number;
  running: boolean;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

const jobs = new Map<string, JobHealth>();

function entry(name: string): JobHealth {
  let j = jobs.get(name);
  if (!j) {
    j = { runs: 0, running: false, lastStartedAt: null, lastSuccessAt: null, lastErrorAt: null, lastError: null };
    jobs.set(name, j);
  }
  return j;
}

/** Wrap a job body so each run is recorded; errors are recorded and rethrown. */
export function tracked<T>(name: string, fn: () => Promise<T>): () => Promise<T> {
  entry(name);
  return async () => {
    const j = entry(name);
    j.running = true;
    j.lastStartedAt = new Date().toISOString();
    try {
      const out = await fn();
      j.lastSuccessAt = new Date().toISOString();
      j.lastError = null;
      return out;
    } catch (err) {
      j.lastErrorAt = new Date().toISOString();
      j.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      j.running = false;
      j.runs += 1;
    }
  };
}

export function jobHealthSnapshot(): Record<string, JobHealth> {
  return Object.fromEntries([...jobs].map(([k, v]) => [k, { ...v }]));
}
