/**
 * Is the live CBP connection working right now? The inbound pull runs every
 * minute and fails when the MQ channel or bridge is down, so its last success
 * is the signal. Read by the external uptime monitor via GET /api/v1/status/cbp.
 */
const STALL_AFTER_MS = 5 * 60 * 1000;

export interface CbpHealth {
  state: 'ok' | 'starting' | 'stalled' | 'disabled';
  healthy: boolean;
  lastSuccessSecondsAgo: number | null;
}

export function evaluateCbpHealth(input: {
  transport: string;
  lastSuccessAt: string | null;
  uptimeMs: number;
  now: number;
}): CbpHealth {
  const { transport, lastSuccessAt, uptimeMs, now } = input;
  if (transport !== 'mqipt') return { state: 'disabled', healthy: true, lastSuccessSecondsAgo: null };

  if (!lastSuccessAt) {
    const starting = uptimeMs < STALL_AFTER_MS;
    return { state: starting ? 'starting' : 'stalled', healthy: starting, lastSuccessSecondsAgo: null };
  }

  const ageMs = Math.max(0, now - Date.parse(lastSuccessAt));
  const healthy = ageMs < STALL_AFTER_MS;
  return { state: healthy ? 'ok' : 'stalled', healthy, lastSuccessSecondsAgo: Math.floor(ageMs / 1000) };
}
