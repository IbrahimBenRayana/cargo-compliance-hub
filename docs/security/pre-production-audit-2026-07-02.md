# MyCargoLens — Pre-Production Security Audit & Deep-Check Plan

**Date:** 2026-07-02
**Scope:** API server (Express + Prisma), app frontend (Vite/React), marketing site (Next.js), and the three environments (staging, production, marketing).
**Goal:** Find and resolve vulnerabilities before/around the production cutover so nothing unexpected surfaces.

> Owner-authorized defensive review. This document is both a findings report (static code audit already performed) and a plan for the remaining live-environment checks + remediation.

---

## 1. Context

The platform is going to production on split infra (prod VPS `app.mycargolens.com` + fresh DB; staging VPS hosting `staging.` and the `mycargolens.com` marketing site). A recently-shipped AI chat + human-handoff feature added new surface (anonymous visitor tokens, SSE streams, agentic tools). This audit verifies the code and the deployed environments are safe to run in production.

**What was done:** static review of authN/authZ, multi-tenant isolation, injection/file/SSRF, the chat subsystem, HTTP security config, API keys, billing, dependencies, secrets, and container/CI infra.
**What still needs live access:** TLS config, actually-emitted headers, open ports/firewall, real env-var values, and OS/dependency patch levels on the VMs (see §5).

---

## 2. Overall posture

The codebase is, on the whole, **well-built defensively**. Strong foundations already in place:

- JWT access/refresh with **separate secrets**, both `min(16)` and **no insecure defaults** (server won't boot without them). User is **re-loaded from the DB** on every request, so a stale token can't carry a stale role/org.
- `bcryptjs` cost 12, login lockout (5→15 min), constant-time anti-enumeration responses, invite-only registration.
- Multi-tenant isolation via a consistent `findFirst { id, orgId }` guard; `req.user.orgId` is DB-sourced, never from the request body. No raw `...req.body` mass-assignment.
- Injection surface effectively **closed**: all DB access through Prisma (no raw SQL), no `child_process`, XXE-safe parser (`fast-xml-parser`, entities off).
- Stripe webhook signature **properly verified** against the raw Buffer; charge amounts are **server-derived** from plan config (client can never set price).
- API keys: CSPRNG 192-bit, stored **hashed** (SHA-256), returned once.
- Refresh token in **httpOnly** cookie + Origin-checked CSRF defense; access token kept **in memory only** (never localStorage).
- Containers run **non-root**; prod DB **not exposed** to host; CORS is a strict explicit allowlist.
- Secrets hygiene clean: no `.env` ever committed; git history clean.

The findings below are the deltas from that strong baseline — mostly hardening, with one genuinely important item (SSRF).

---

## 3. Findings (prioritized)

### HIGH

**H1 — Blind SSRF via tenant-configured webhook URLs**
`server/src/routes/webhooks.ts:26,33` (validation) → `server/src/services/webhooks.ts:81` (delivery)
Webhook URL is validated only as `z.string().url().max(2048)` — no scheme restriction and no block on `localhost`, `127.0.0.1`, `169.254.169.254` (cloud metadata), or RFC-1918 ranges. Any authenticated org owner/admin can register a webhook pointing at internal infrastructure; the server will POST signed payloads to it (blind SSRF — responses aren't returned, but internal endpoints can be reached/triggered and cloud metadata is a real risk on many hosts).
**Fix:** at registration (and again at delivery time, to defeat DNS rebinding) require `https:` scheme, resolve the host, and reject loopback/link-local/private/reserved IP ranges. Prefer validating the *resolved* address, not just the hostname string. Optionally allow an env-configured allowlist. Add a unit test with `http://169.254.169.254/…` and `http://localhost` expecting rejection.

### MEDIUM

**M1 — Marketing site ships zero security headers**
`landing/next.config.ts` (no `headers()` function)
The Next.js site on `mycargolens.com` sends no CSP, HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options, or Referrer-Policy at the app layer. Clickjacking + weaker XSS posture on the public marketing surface. (Confirm whether the live nginx adds any — the repo template does not.)
**Fix:** add a `headers()` block in `next.config.ts` (or set them at nginx) with at minimum `Content-Security-Policy` (scoped to what the site loads + the API origin for `connect-src`), `Strict-Transport-Security`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

**M2 — Header injection via unescaped user-derived `Content-Disposition` filenames**
`server/src/routes/documents.ts:226`; `server/src/routes/export.ts` (filenames built from `houseBol`/`masterBol`/original filename)
User-controlled values are interpolated into the `Content-Disposition` header (`filename="${…}"`) without escaping quotes/CRLF. Depending on the runtime this enables header/response splitting or breaking the filename directive.
**Fix:** sanitize (strip CR/LF and `"`), or use RFC 5987 `filename*=UTF-8''<pct-encoded>` encoding. A tiny helper reused by both routes.

**M3 — Possible missing entitlement gate on integrations routes**
`server/src/routes/integrations.ts` (`hts-classify` ~:28, `mid-list` ~:107)
These are not wrapped in `requireCapability(...)` although HTS classification is documented as a tier-gated feature. Potential feature/tier bypass (lower-severity than data exposure, but a paywall/entitlement leak). **Needs confirmation** that gating isn't intentionally applied elsewhere.
**Fix:** if HTS/MID are meant to be tier-gated, add `requireCapability(CAPABILITIES.…)` to these routes.

**M4 — Public API-key surface & admin routes have no dedicated rate limit**
`server/src/middleware/rateLimiter.ts` applied in `server/src/index.ts` — `/api/public/v1` and admin routes are covered only by the global 100/min `generalLimiter`.
No per-key throttle on the machine-to-machine API. A single leaked/abused key can consume the whole global budget and there's no per-key fairness or abuse ceiling.
**Fix:** add a per-API-key limiter (keyed on `key.id`) on the public API router; consider a stricter admin limiter.

**M5 — CSP allows `'unsafe-inline'` scripts (app)**
`server/src/index.ts:59`
`script-src` includes `'unsafe-inline'`, which substantially weakens the CSP as an XSS mitigation.
**Fix:** move to nonce/hash-based inline scripts if any are needed, or drop `'unsafe-inline'` if the Vite build doesn't require it. Verify against the built SPA before shipping.

### LOW / Hardening

- **L1 — Non-atomic mutations (TOCTOU shape).** `filings.ts:361/397`, `documents.ts:266`, `organization.ts:91`, `templates.ts:109/128` update/delete with `where:{ id }` alone after a scoped `findFirst`. Cross-tenant-safe today, but harden to atomic `updateMany/deleteMany { id, orgId }` (pattern already used at `filings.ts:1330`).
- **L2 — Rate limiter is in-memory** (`express-rate-limit`, no shared store). Fine for the current single-container deployment; **will silently bypass per-instance if ever horizontally scaled.** Note for scaling; move to a Redis store then.
- **L3 — Access token in SSE query string** (`notifications.ts` `?token=`, chat `/events?token=`). Intentional (EventSource can't set headers) but tokens can land in proxy/access logs. Mitigate by keeping access-token TTL short (already 15m) and ensuring nginx doesn't log query strings for those paths.
- **L4 — Minor info disclosure in errors.** `errorHandler.ts` returns Zod field details and Prisma unique-constraint target field names to clients in all envs. No stack traces leak in prod (good). Consider genericizing in prod.
- **L5 — `CHAT_SESSION_SECRET` dev-default only enforced when `CHAT_ENABLED`** (`env.ts:106`). Edge case; make prod enforcement unconditional (chat is on by default anyway).
- **L6 — Single-token refresh rotation** (no reuse-detection family). A replayed rotated token 401s but doesn't proactively kill the live session. Optional upgrade: token-family reuse detection.
- **L7 — Dev `docker-compose.yml` exposes Postgres to host with a default password** (`:19-21,47`). Dev-only, but the fallback `mycargolens_dev_password` is a real default — ensure it's never reused on any shared/staging box.
- **L8 — CI writes provider secrets to a plaintext `.env` on the VPS** (`ci-cd.yml` `upsert_env`). Standard for VPS deploys, but confirm the file is `chmod 600`, owned by the app user, and VM SSH access is tightly controlled.

### Dependencies (npm audit)

- **Landing:** `postcss` (moderate, XSS in CSS stringify) via a transitive under `next`. Build-time/low real risk. Update `next`/`postcss` on a branch and smoke-test.
- **Root app & server:** `esbuild`/`vite` (moderate/high) and server `esbuild` (low) — all **dev-server-only** advisories, not production-runtime exposure. Patch opportunistically; not release-blocking.
- Action: run `npm audit` in all three packages, apply non-breaking fixes, and document any intentionally-deferred advisories.

---

## 3a. Phase A — COMPLETED (2026-07-02)

All four release-blocking items are fixed, typechecked, and tested (server suite 115/115 green).

- **H1 SSRF** — new `server/src/services/ssrfGuard.ts` (blocks loopback/private/link-local/reserved IPv4+IPv6, non-http(s) schemes, credentials, and localhost-ish names; resolves DNS to catch rebinding). Enforced at registration (`routes/webhooks.ts` create + update) **and** before each delivery (`services/webhooks.ts` `deliverOne`). Tests: `services/__tests__/ssrfGuard.test.ts` + new cases in `webhooks.test.ts`.
- **M2 header injection** — new `server/src/utils/httpHeaders.ts` `contentDispositionAttachment()` (sanitized ASCII fallback + RFC 5987 `filename*`). Applied in `routes/documents.ts` (download) and `routes/export.ts` (all three exports). Tests: `utils/__tests__/httpHeaders.test.ts`.
- **M1 marketing headers** — `landing/next.config.ts` now sets CSP (with API origin + Sentry in `connect-src`, dev relaxations for HMR), HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, and `poweredByHeader:false`. **Smoke-test on staging** — CSP tightening to script nonces is a follow-up.
- **M3 entitlement gate** — `routes/integrations.ts` `/hts-classify` now `requireCapability(HTS_CLASSIFICATION)`, `/mid-list` now `requireCapability(ABI_ENTRY)`.

## 3b. Phase B — COMPLETED (2026-07-02)

Hardening pass; typecheck clean, server suite 115/115 green.

- **M4 per-API-key rate limit** — `middleware/rateLimiter.ts` new `apiKeyLimiter` (300/min keyed on `apiContext.keyId`), applied in `routes/publicApi.ts` after `apiKeyAuth`. Bounds each key independently of the per-IP `generalLimiter`.
- **M5 tighten app CSP** — `index.ts` drops `'unsafe-inline'` from `script-src` (built SPA has only external hashed module scripts — verified). `style-src` keeps it (injected component styles). **Smoke-test on staging.**
- **L1 atomic org-scoped mutations** — updates → `updateMany({id,orgId})` + refetch; deletes → `deleteMany({id,orgId})`. Applied in `filings.ts`, `templates.ts`, `organization.ts`, `documents.ts`.
- **L5 chat secret** — `config/env.ts` now fails prod boot on the dev-default `CHAT_SESSION_SECRET` unconditionally (no longer gated on `CHAT_ENABLED`).
- **L4 error genericization** — `middleware/errorHandler.ts` no longer returns Prisma constraint target field names in production.

## 3c. Phase C (dependencies) — COMPLETED (2026-07-02)

GitHub Dependabot flagged highs on `main` that local `npm audit` did not — because a prior remediation bumped the deps in the working tree but never committed the lockfiles. This phase commits them.

- **Resolved highs:** `multer ^2.1.1→^2.2.0` (upload DoS), `nodemailer ^8.0.5→^9.0.1` (raw-option file read/SSRF), `form-data`→4.0.6 (via `jsdom`, test-only; lockfile), `postcss ^8.5.6→^8.5.16` (CSS-stringify XSS). Server vite (8.1.0) already > patched 8.0.16.
- **Deferred (documented):** root **vite 5.4.21 → 6.4.3 is a MAJOR bump** and the advisories (`server.fs.deny` bypass, optimized-deps path traversal) affect only the **Vite dev server on Windows** — never the production static build. Not a prod exposure; not worth a breaking build-tool upgrade at cutover. Revisit post-launch.
- Prod-runtime dependency exposure after this phase: none outstanding.

## 4. Remediation plan (code)

**Phase A — Fix now (release-blocking):** ✅ DONE (see §3a)
1. H1 SSRF webhook host validation (+ test).
2. M2 Content-Disposition sanitization helper (+ test).
3. M1 marketing-site security headers.
4. M3 confirm & (if needed) add `requireCapability` to integrations routes.

**Phase B — Hardening (this cycle):**
5. M4 per-API-key rate limit; M5 tighten CSP.
6. L1 atomic org-scoped mutations; L5 unconditional chat-secret enforcement; L4 prod error genericization.

**Phase C — Deferred / scaling:**
7. L2 Redis-backed rate limiting (when scaling beyond one instance); L6 refresh reuse-detection; dependency bumps.

Each fix lands with a focused test where practical; run the server (`tsc --noEmit -p tsconfig.build.json`) and frontend (`tsc --noEmit -p tsconfig.app.json`) typechecks and the vitest suite before merging.

---

## 5. Live environment checks (need VM/DNS access — can't be done from the repo)

These verify the *deployed* state, which the code can't prove. Run against `app.mycargolens.com`, `staging.mycargolens.com`, and `mycargolens.com`.

1. **TLS:** protocol/cipher scan (TLS 1.2+ only, no weak ciphers), valid cert + chain, HSTS present at the edge. (`testssl.sh` or SSL Labs.)
2. **Emitted headers:** `curl -sI https://<host>` on each surface — confirm CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy actually ship (esp. marketing per M1).
3. **Open ports / firewall:** confirm only 80/443 are reachable publicly; app (3001/3000) and Postgres (5432) are NOT exposed on either VM (prod compose doesn't publish DB; verify the host firewall too).
4. **Env-var sanity on each VM:** `NODE_ENV=production`, real `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (rotated, not shared with staging), `CHAT_SESSION_SECRET` set to a real value, `STRIPE_WEBHOOK_SECRET` set, `CC_ENVIRONMENT`/`CC_API_TOKEN` correct for prod, staging pointed at test Stripe.
5. **`.env` file perms:** `600`, app-user owned, on both VMs.
6. **DB:** backups running + restore-tested (`deploy/scripts/backup-db.sh`), backup storage access-controlled, DB not reachable from the internet.
7. **OS/runtime patch level:** `apt` updates current, Docker base images rebuilt recently.
8. **Live behavior spot-checks:** rate limiter returns 429 under burst; a bogus/expired chat token is rejected on `/events`; cross-tenant object access returns 404 (pick two real IDs from different orgs in staging).
9. **nginx:** confirm the live config force-redirects HTTP→HTTPS and does not log SSE query strings (L3).

> I can run the non-invasive external checks (2, and read-only header/TLS probes) against the live domains if you authorize it. Items needing SSH (3–7) require VM access or you running the commands.

---

## 5a. Live check RESULTS (2026-07-02, non-invasive external probes)

Ran against `mycargolens.com`, `app.mycargolens.com`, `staging.mycargolens.com`.

**TLS / transport — PASS.** All three: HTTP→HTTPS 301; certs verify (`ssl_verify_result=0`); **TLS 1.1 refused**, TLS 1.2 accepted (1.3 not testable from local LibreSSL but expected on). Edge is nginx/1.24.0 (Ubuntu). Note: HTTP/2 not negotiated (served over HTTP/1.1) — perf, not security.

**Headers — findings:**
- **Marketing (`mycargolens.com`)**: nginx emits HSTS + `X-Frame-Options: SAMEORIGIN` + `X-Content-Type-Options: nosniff`, but **NO CSP, NO Referrer-Policy, NO Permissions-Policy**, and leaks `X-Powered-By: Next.js`. → Confirms M1; fixed by this PR (adds CSP/Referrer-Policy/Permissions-Policy + `poweredByHeader:false`).
- **Header-source conflict (acted on):** because the edge already sets HSTS/XFO/nosniff, the initial `next.config.ts` would have produced a **conflicting duplicate** `X-Frame-Options` (nginx SAMEORIGIN + app DENY). Config revised to add only the missing headers; clickjacking now covered by CSP `frame-ancestors 'none'`.
- **App (`app.mycargolens.com`)**: helmet CSP present; but helmet **and** nginx BOTH set HSTS/XFO/nosniff → these appear **duplicated** (helmet XFO DENY + nginx SAMEORIGIN). Pre-existing, low impact, but header ownership should be consolidated to one layer. `Referrer-Policy: no-referrer` (fine).

**Still needs SSH / infra access (not doable externally):**
- Open-port/firewall check (only 80/443 public; app 3001/3000 + Postgres 5432 not exposed).
- Env-var sanity on each VM (`NODE_ENV=production`, real & distinct JWT/CHAT secrets, `STRIPE_WEBHOOK_SECRET` set, staging→test Stripe).
- `.env` perms (600, app-user), backup restore test, OS/Docker patch level.
- **Config drift:** repo `deploy/nginx.conf` is a bare template — the live nginx (HSTS/XFO/nosniff, TLS policy) is hand-configured on the VMs and not tracked in the repo. Recommend capturing the real nginx config into the repo so header ownership and TLS policy are reviewable/reproducible.

## 6. Verification (definition of done)

- Phase A fixes merged with passing tests + both typechecks green.
- `npm audit` reviewed in all three packages; non-breaking fixes applied, deferrals documented.
- Live checklist §5 completed on all three environments with results recorded here.
- A short re-test of H1/M1/M2 against staging confirming the fix behaves (SSRF payload rejected; marketing headers present; malicious filename neutralized).
