/**
 * Sentry initialization — MUST be the first import in index.ts.
 *
 * Sentry's docs are emphatic about this: the SDK has to be initialized
 * before any other module loads, otherwise it can't instrument the http
 * layer (Express requests, outbound fetches) or capture errors that
 * happen during module loading.
 *
 * We read DSN/environment/release from process.env directly (NOT from
 * config/env.ts) because env.ts validates with Zod at module load — if
 * that throws we want Sentry already wired so it can capture the error
 * instead of dying silently.
 *
 * Sentry is OFF by default — empty DSN means init() is skipped, no events
 * are sent, the SDK is essentially a no-op. Set SENTRY_DSN in prod via
 * GitHub Secrets → VPS .env to enable.
 */

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN || '';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    release: process.env.SENTRY_RELEASE || undefined,
    // Performance tracing: 10% of requests get a full trace. Bump per
    // route via Sentry.startSpan(...) for endpoints we care about more.
    tracesSampleRate: 0.1,
    // Send PII (cookies, headers) only if we ever explicitly opt in.
    // Default off — JWT secrets, refresh cookies, etc. would leak.
    sendDefaultPii: false,
    // Common noisy errors we don't want to alert on.
    ignoreErrors: [
      'ECONNRESET',
      'ECONNABORTED',
      'AbortError',
    ],
  });

  // eslint-disable-next-line no-console
  console.log(`[Sentry] Initialized (env=${process.env.SENTRY_ENVIRONMENT || 'production'})`);
}
