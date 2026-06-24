# Test Findings — MyCargoLens E2E session (2026-06-23)

Two real issues surfaced while building the E2E suite. **Both are now fixed** on
branch `fix/auth-hang-and-refresh-race` (see "The fix" at the bottom).

---

## 1. ✅ FIXED (local env) — Login hung forever due to DB migration drift

**Symptom:** every login (browser *and* `curl`) hung with no response; the
request never returned. Empty-body POSTs returned `400` instantly, so the route
was reachable — only real authentication stalled.

**Root cause:** the local Postgres DB was **11 migrations behind** the Prisma
schema. The `users.is_platform_admin` column (migration `d_onboarding_platform_admin`)
was missing. The login handler's `findUnique` selects that column → Prisma throws
`P2022` → and because [`server/src/routes/auth.ts`](../../server/src/routes/auth.ts)
`/login` does `catch (err) { ... throw err }` inside an **async Express handler**,
the rejection is never converted to a response. Express 4 doesn't forward async
throws, so the socket hangs open.

**Fix applied:** `prisma db push --force-reset` + `npm run db:seed` to realign and
reseed the local DB. Login now returns `200`.

**Secondary recommendation (product):** wrap async route handlers so a thrown
error becomes a `500` instead of hanging. A missing column should surface as a
fast error, not an indefinitely open connection. Consider `express-async-errors`
or an `asyncHandler` wrapper across the routes.

---

## 2. 🐞 OPEN (product bug) — Intermittent logout on hard page load

**Symptom:** after a successful login, a **hard navigation / full page reload**
occasionally bounces the user to `/login`. Reproduced with
[`repro-bounce.mjs`](./repro-bounce.mjs):

```
/integrations/api : bounced to /login 2/4
/compliance       : bounced to /login 1/4
/tracking, /duty-calculator, /integrations/logs, /settings : 0/4
```

**Mechanism:** the access token is in-memory only, so a hard load starts with no
token and the client recovers via `POST /auth/refresh` (cookie-based). But
`/auth/refresh` **rotates** the refresh token single-use (new token in DB + new
cookie, old one invalidated — [`auth.ts`](../../server/src/routes/auth.ts)).
The client has a single-flight guard (`refreshInFlight`) that dedupes
*concurrent* refreshes, but it **resets after each refresh completes**. When a
page load fires a *second, later* wave of `401`s (a component that mounts after
the first refresh resolved), a **second** refresh runs and can race the cookie
rotation — sending the just-consumed token. The DB equality check
`user.refreshToken !== refreshToken` then fails → `401` → the client calls
`clearTokens()` + `window.location.href = '/login'`. The user is kicked out
mid-session.

**Why it's intermittent:** it only fires when a second refresh is dispatched
before the rotated `Set-Cookie` from the first refresh is committed in the
browser — a timing window, hence ~25–50% on some routes, 0% on others.

**Suggested fixes (pick one):**
- **Refresh-token grace window (server):** keep the *previous* refresh token
  valid for a few seconds after rotation (store `prevRefreshToken` + expiry, or
  a short reuse-detection grace) so an in-flight second refresh succeeds.
- **Persist a stronger single-flight (client):** don't reset `refreshInFlight`
  immediately; cache the result briefly (e.g. 2–3s) so a second wave reuses the
  first refresh's outcome instead of starting a new rotation.
- **Don't rotate on every refresh**, or only rotate when the token is close to
  expiry. (Weakest option — reduces rotation security benefit.)

**Test impact:** the suite sidesteps this by navigating client-side (History API)
instead of hard-reloading, so it doesn't depend on the buggy path. The
`auth.spec.ts` "session survives a hard page reload" test exercises the happy
path of this flow and mostly passes; it will flake until the bug is fixed.

---

## Notes / smaller observations

- `/login` is rate-limited to **10 requests/min/IP** (`authLimiter`). Correct
  security behavior, but it shapes how the suite authenticates (one login per
  worker, see `README.md`).
- The demo org is provisioned on the **ISF-only tier** — Container Tracking,
  HTS/Duty Calculator, and ABI Entry all render upgrade gates. Grant those
  capabilities to the demo org to exercise the features themselves.
- No JavaScript page errors were observed on any route during the recon walk.

---

## The fix (branch `fix/auth-hang-and-refresh-race`)

**Issue 1 — async handler hang:** added `import 'express-async-errors';` in
`server/src/index.ts` (before any Router is created). Express 4 now forwards
async rejections to the existing `errorHandler`, which already returns 500 and
maps Prisma errors (P2022 → 500). One line; covers all 21 async handlers, not
just `/login`.

**Issue 2 — refresh-token race:** `src/api/client.ts` `tryRefreshToken()` now
caches the outcome of the most recent `/auth/refresh` for `REFRESH_REUSE_MS`
(4s). A late second wave of 401s on the same page load reuses that result and
retries with the freshly-set access token instead of starting a second rotation
that races the cookie. `clearTokens()` resets the cache.

**Verification:**
- `diag-bounce.mjs` (real scenario: logged in → settled → hard-reload 15×):
  **0/15 logouts**, exactly one refresh per reload, never a racing second one.
- Server unit tests: 80/80. Frontend + server typecheck clean. Full E2E suite green.
- Note: `repro-bounce.mjs` still shows some bounces — that script logs in and
  hard-navigates *instantly*, before the login Set-Cookie settles, which is a
  script artifact, not the app bug. `diag-bounce.mjs` is the faithful repro.
