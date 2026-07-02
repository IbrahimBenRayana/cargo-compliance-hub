import type { NextConfig } from "next";

// ── Security headers ──────────────────────────────────────────
// The marketing site previously shipped no security headers at the app layer.
// connect-src must include the API origin (chat SSE + contact/demo POSTs) and
// Sentry ingest. Dev adds 'unsafe-eval' + ws: so React Refresh / HMR still work.
const isProd = process.env.NODE_ENV === "production";
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `img-src 'self' data: https:`,
  `font-src 'self' data:`,
  `style-src 'self' 'unsafe-inline'`,
  // 'unsafe-inline' is required for Next's hydration/streaming inline scripts.
  // Tightening to nonces is a follow-up (see docs/security).
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isProd ? "" : " 'unsafe-eval'"}`,
  `connect-src 'self' ${apiUrl} https://*.sentry.io${isProd ? "" : " ws: http://localhost:3001"}`,
  `frame-src 'self' https://js.stripe.com`,
  `worker-src 'self' blob:`,
  `form-action 'self'`,
].join("; ");

// NOTE: the live nginx edge already emits Strict-Transport-Security,
// X-Frame-Options, and X-Content-Type-Options. We deliberately DON'T set those
// here to avoid duplicate/conflicting headers (nginx sends X-Frame-Options:
// SAMEORIGIN; a second DENY from the app would be an undefined-behavior
// duplicate). Clickjacking is covered by CSP `frame-ancestors 'none'` above,
// which supersedes X-Frame-Options in modern browsers. We add only what the
// edge is missing: CSP, Referrer-Policy, Permissions-Policy (poweredByHeader:
// false below strips the X-Powered-By disclosure).
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Phase 1 IA shift: /features/<slug> deep-pages move to /platform/<slug>.
      // Keep /features as the overview hub.
      {
        source: "/features/isf-filing",
        destination: "/platform/filings",
        permanent: true,
      },
      {
        source: "/features/compliance",
        destination: "/platform/compliance",
        permanent: true,
      },
      {
        source: "/features/team",
        destination: "/platform/automation#team",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
