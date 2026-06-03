// Next.js instrumentation hook (audit Phase 10).
// Called once per runtime — node and edge. We branch on NEXT_RUNTIME so
// the right Sentry SDK loads for each environment.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || "production",
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || "production",
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

// Capture unhandled errors in Server Components / route handlers.
export const onRequestError = Sentry.captureRequestError;
