// Client-side Sentry entry (audit Phase 10). Next.js runs this before the
// app hydrates; the dsn is baked in via NEXT_PUBLIC_SENTRY_DSN at build time.
//
// The SDK itself (lib/sentry-client.ts) is loaded lazily once the page is idle
// so it stays out of first-load JS. Until then this shim buffers uncaught
// errors and rejections from first paint, and the first one pulls the SDK in
// immediately, so nothing is lost while it loads.
type SentryClient = typeof import("./lib/sentry-client");

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sdk: SentryClient | undefined;
let loading: Promise<void> | undefined;
const early: Array<[unknown, "onerror" | "onunhandledrejection"]> = [];

function onError(event: ErrorEvent) {
  early.push([event.error ?? event.message, "onerror"]);
  loadSentry();
}

function onRejection(event: PromiseRejectionEvent) {
  early.push([event.reason, "onunhandledrejection"]);
  loadSentry();
}

function loadSentry() {
  if (!dsn || loading) return;
  loading = import("./lib/sentry-client").then((client) => {
    client.initSentry(dsn);
    // Sentry.init installed its own global handlers synchronously above, so
    // hand over in the same tick: no gap and no double reporting.
    removeEventListener("error", onError);
    removeEventListener("unhandledrejection", onRejection);
    sdk = client;
    for (const [error, type] of early.splice(0)) client.captureEarlyError(error, type);
  });
}

if (dsn && typeof window !== "undefined") {
  addEventListener("error", onError);
  addEventListener("unhandledrejection", onRejection);

  const whenIdle = () => {
    if ("requestIdleCallback" in window) requestIdleCallback(loadSentry, { timeout: 3000 });
    else setTimeout(loadSentry, 1000);
  };
  if (document.readyState === "complete") whenIdle();
  else addEventListener("load", whenIdle, { once: true });
}

// Track router transitions in App Router pages (once the SDK is loaded; the
// pageload span still covers the initial navigation).
export function onRouterTransitionStart(href: string, navigationType: string) {
  sdk?.onRouterTransitionStart(href, navigationType);
}
