/** TOOL-02 (testing week): a bad provider credential showed users "invalid API token". */
import { describe, it, expect } from 'vitest';
import { trackingErrorResponse } from '../trackingErrors.js';

describe('trackingErrorResponse', () => {
  it('hides our own credential failure behind an outage message', () => {
    const r = trackingErrorResponse({ status: 401, message: 'invalid API token' });
    expect(r).toEqual({ status: 503, ourFault: true, body: { error: 'Container tracking is unavailable right now. MyCargoLens support has been alerted; please try again later.', code: 'TRACKING_UNAVAILABLE' } });
  });
  it('passes a request problem back to the user', () => {
    const r = trackingErrorResponse({ status: 422, message: 'Request number is not a valid container number' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Request number is not a valid container number');
    expect(r.ourFault).toBe(false);
  });
  it('treats provider outages as unavailable', () => {
    expect(trackingErrorResponse({ status: 503 }).status).toBe(503);
    expect(trackingErrorResponse(new Error('fetch failed')).body.code).toBe('TRACKING_UNAVAILABLE');
  });
});
