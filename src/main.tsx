import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Sentry init (audit Phase 10). Driven by Vite build-time env vars so the
// DSN is baked into the bundle for prod and absent in dev. Without the DSN
// Sentry.init() is skipped and the SDK is a no-op.
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "production",
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    // 10% of sessions get a transaction trace; bump per-route if needed.
    tracesSampleRate: 0.1,
    // Replay sessions on errors only — keeps the bundle + bandwidth small
    // while still giving us a recording when something actually breaks.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text + media by default — customs data is regulated.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

createRoot(document.getElementById("root")!).render(<App />);
