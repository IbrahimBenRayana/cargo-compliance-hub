// Client-side Sentry init (audit Phase 10). Next.js picks this up
// automatically as the browser bundle's entry; the dsn is baked in via
// NEXT_PUBLIC_SENTRY_DSN at build time.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
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

// Track router transitions in App Router pages.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
