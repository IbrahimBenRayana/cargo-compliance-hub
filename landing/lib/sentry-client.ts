// Client-side Sentry SDK (audit Phase 10). Loaded lazily by
// instrumentation-client.ts, never imported statically: the SDK plus Replay
// is ~105 KB gzipped, which roughly doubled first-load JS on every route.
import * as Sentry from "@sentry/nextjs";

export function initSentry(dsn: string) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    tracesSampleRate: 0.1,
    // Replay sessions on errors only — landing has fewer interactions to
    // record than the app, but a marketing-site crash is high-impact, so
    // turning replay on gives us a free recording when one happens.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false, // marketing copy is public
        blockAllMedia: false,
      }),
    ],
  });
}

// Report an error the shim caught before the SDK finished loading, tagged
// with the same mechanism Sentry's own global handlers use.
export function captureEarlyError(
  error: unknown,
  type: "onerror" | "onunhandledrejection",
) {
  Sentry.captureException(error, {
    mechanism: { type: `auto.browser.global_handlers.${type}`, handled: false },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
