/**
 * apiFetch 401 handling.
 *
 * Regression for the staging "login loop": a wrong password on /auth/login
 * returned 401, apiFetch treated it as an expired session, ran a refresh
 * (which failed — there is no session yet) and hard-redirected to /login.
 * The page reloaded and the "Invalid email or password" error was never shown.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadClient() {
  // Fresh module per test — accessToken / lastRefresh are module state.
  vi.resetModules();
  return import('../client');
}

describe('apiFetch 401 handling', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces the server error for a rejected login instead of treating it as session expiry', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'Invalid email or password' }));
    const { authApi } = await loadClient();

    const err = await authApi.login('demo@mycargolens.com', 'wrong').catch((e) => e);

    expect(err.status).toBe(401);
    expect(err.body).toEqual({ error: 'Invalid email or password' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no /auth/refresh attempt
  });

  it('surfaces mfa_token_invalid from /auth/mfa/verify so LoginPage can reset to the password step', async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, { error: 'Your sign-in session expired. Please log in again.', code: 'mfa_token_invalid' }),
    );
    const { authApi } = await loadClient();

    const err = await authApi.mfaVerify('stale-token', 'totp', '123456').catch((e) => e);

    expect(err.status).toBe(401);
    expect(err.body.code).toBe('mfa_token_invalid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still recovers an expired session on authenticated routes via refresh + retry', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'Token expired' })) // GET /auth/me
      .mockResolvedValueOnce(json(200, { accessToken: 'fresh' })) // POST /auth/refresh
      .mockResolvedValueOnce(json(200, { id: 'u1', email: 'demo@mycargolens.com' })); // retry
    const { authApi, getAccessToken } = await loadClient();

    const me = await authApi.me();

    expect(me).toEqual({ id: 'u1', email: 'demo@mycargolens.com' });
    expect(getAccessToken()).toBe('fresh');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/auth/refresh');
  });
});
