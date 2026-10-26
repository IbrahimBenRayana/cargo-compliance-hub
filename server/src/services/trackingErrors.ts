/**
 * What a container-tracking failure tells the user. Our own credential or
 * account problems (401/403) and provider outages read as "unavailable" and
 * are ours to fix; a request the provider refuses (other 4xx) goes back to
 * the user as written, since it is about what they typed.
 */
export function trackingErrorResponse(err: { status?: number; message?: string } | unknown): {
  status: number; ourFault: boolean; body: { error: string; code?: string };
} {
  const e = (err ?? {}) as { status?: number; message?: string };
  const s = typeof e.status === 'number' ? e.status : 0;
  if (s >= 400 && s < 500 && s !== 401 && s !== 403 && s !== 429) {
    return { status: 400, ourFault: false, body: { error: e.message || 'The tracking request was refused.' } };
  }
  return {
    status: 503,
    ourFault: s === 401 || s === 403,
    body: { error: 'Container tracking is unavailable right now. MyCargoLens support has been alerted; please try again later.', code: 'TRACKING_UNAVAILABLE' },
  };
}
