# MFA Implementation Plan — TOTP + Email OTP Fallback

**Status:** In implementation (feat/mfa) · **Author:** planned 2026-07-07
**Goal:** Production-grade MFA: authenticator-app TOTP as the primary second factor (QR enrollment at first login for new users), email OTP + recovery codes as fallbacks, in-app prompt for existing users.

## Design decisions (research-backed)

Follows what GitHub/Stripe/Auth0 ship, plus NIST 800-63B / OWASP guidance:

- **TOTP:** RFC 6238 defaults — SHA-1 / 6 digits / 30 s period (Google Authenticator ignores non-default params), 20-byte (160-bit) secret from `crypto.randomBytes`, Base32. Verify window ±1 step. Library: `otpauth` (hectorm — maintained, TS-native, generates `otpauth://` URIs; speakeasy is abandoned).
- **Replay guard:** store the last accepted TOTP time-step (`mfa_last_used_step`); reject any code whose matched step ≤ stored step (RFC 6238 §5.2 / NIST "accept a given OTP only once").
- **Secret storage:** AES-256-GCM app-level encryption, key from env (`MFA_ENC_KEY`, 32 bytes hex), format `v1:<iv b64>:<ct b64>:<tag b64>`. Never logged, never serialized.
- **Enrollment:** verify-before-activate. Pending secret (encrypted, 15-min TTL) → user scans QR → submits a live code → only then `mfaEnabled = true`. On activation, show **10 single-use recovery codes** (format `XXXXX-XXXXX`, bcrypt-hashed at rest) exactly once; regenerable. Security email on enable/disable.
- **Login flow (Auth0 pattern):** password success + `mfaEnabled` → no session tokens; return `{ mfaRequired, mfaToken }` where `mfaToken` is a 5-min JWT with `typ: 'mfa'` that the normal auth middleware **rejects**. `POST /auth/mfa/verify` exchanges mfaToken + code for the real access/refresh pair.
- **Brute force:** 5 failed MFA attempts → reuse existing `lockedUntil` lock (15 min) + reset counter; `authLimiter` (10/min/IP) on all MFA endpoints. Email codes: 6 digits, bcrypt-hashed, 5-min expiry, 5 attempts per code, 60-s resend cooldown, one active code at a time.
- **No enumeration/downgrade:** MFA branch only after correct password; server decides available methods; fallback (email/recovery) use triggers a security email.
- **Email OTP caveat:** NIST doesn't count email as true MFA — it's a pragmatic fallback for users who can't install an authenticator (explicit product requirement). Recovery codes remain the canonical fallback.
- **Enforcement:** new users get `mfa_enforced = true` at creation → hard gate (server 403 `mfa_enrollment_required` + frontend redirect to `/mfa-setup`) at first login. Existing users: soft prompt (dismissible banner + notification-bell item), GitHub-style; can be flipped to enforced later.
- **Public API (`/api/public/v1`):** untouched — API-key auth, no interactive user.
- **Deferred to v1.1:** "remember this device for 30 days" (server-side revocable trust tokens), org-level MFA-required policy flag, platform-admin MFA reset UI.

## Data model (Prisma + hand-written idempotent SQL migration `i_add_mfa`)

`User` additions: `mfaEnabled Bool @default(false)`, `mfaSecretEnc String?`, `mfaPendingSecretEnc String?`, `mfaPendingCreatedAt DateTime?`, `mfaLastUsedStep Int?`, `mfaEnrolledAt DateTime?`, `mfaEnforced Bool @default(false)`, `mfaFailedAttempts Int @default(0)`.

New tables: `mfa_recovery_codes (id, user_id FK cascade, code_hash, used_at, created_at)`, `mfa_email_codes (id, user_id FK cascade, code_hash, expires_at, attempts, consumed_at, created_at)`.

## API contract (all under `/api/v1/auth`, rate-limited by `authLimiter`)

| Endpoint | Auth | Body | Success response |
|---|---|---|---|
| `POST /login` (modified) | — | email, password | if `mfaEnabled`: `{ mfaRequired: true, mfaToken, methods: ['totp','recovery','email'] }` (no tokens/cookie); else unchanged `{ user, accessToken }` |
| `POST /mfa/verify` | mfaToken in body | `{ mfaToken, method: 'totp'\|'recovery'\|'email', code }` | `{ user, accessToken }` + refresh cookie (identical to login success). 401 `code:'mfa_token_invalid'`; 400 invalid code with `attemptsRemaining`; 401 generic when locked |
| `POST /mfa/email/send` | mfaToken in body | `{ mfaToken }` | `{ ok: true, expiresInMin: 5, cooldownSec: 60 }`; 429 during cooldown |
| `POST /mfa/setup` | Bearer | `{ password }` | `{ otpauthUri, secretBase32 }` (pending secret; re-auth via password required) |
| `POST /mfa/enable` | Bearer | `{ code }` | `{ recoveryCodes: string[10] }` — activates only if code valid against pending secret; atomic |
| `POST /mfa/disable` | Bearer | `{ password, code }` (code = TOTP or recovery) | `{ ok: true }`; clears secret + codes, security email |
| `POST /mfa/recovery-codes` | Bearer | `{ password }` | `{ recoveryCodes: string[10] }` (regenerate — invalidates old set) |
| `GET /me` (modified) | Bearer | — | adds `mfaEnabled`, `mfaSetupRequired` (= `mfaEnforced && !mfaEnabled`) |

`otpauth://totp/MyCargoLens:{email}?secret={base32}&issuer=MyCargoLens` — issuer in both label and param.

Server gate: `requireMfaEnrolled` middleware (modeled on `requireVerifiedEmail.ts`) → 403 `{ code: 'mfa_enrollment_required' }`, applied wherever `requireVerifiedEmail` is applied. `authMiddleware` must reject any JWT carrying a `typ` claim (so mfaToken can't hit normal APIs).

## Frontend

- **Login challenge step** (in `LoginPage.tsx`): on `mfaRequired`, swap to code entry (reuse `input-otp` 6-digit pattern from `VerifyEmailPage.tsx`); links: "Use a recovery code" and "Email me a code instead" (send → countdown → resend). mfaToken held in component state only.
- **`/mfa-setup` page** (forced enrollment, whitelisted in `ProtectedRoute` like `/verify-email`): steps QR (client-side `qrcode.react` SVG + manual Base32) → confirm code → recovery codes (copy/download, confirm-saved checkbox) → enter app.
- **`ProtectedRoute` gate**: after email-verify gate — `mfaSetupRequired` → redirect `/mfa-setup`. `apiFetch` gets a 403 `mfa_enrollment_required` branch mirroring `email_not_verified`.
- **Settings** (Profile tab, "Password & Security" card): status badge, enable (dialog reusing the enrollment component), disable (password + code), regenerate recovery codes, remaining-codes count.
- **Existing-user prompt**: dismissible amber banner in `AppLayout` when `!user.mfaEnabled` (localStorage snooze 7 days) + one-time `security_mfa_prompt` bell notification emitted server-side on login when the user has no MFA.

## Testing & rollout

- Unit (vitest, server): crypto round-trip, TOTP verify + replay rejection, recovery-code lifecycle, email-code expiry/attempts, mfaToken type confusion (access token ≠ mfa token both directions).
- E2E (Playwright): enroll → challenge-login happy path with computed TOTP; demo user stays non-enrolled so the existing per-worker login fixture keeps working.
- Deploy: `feat/mfa` → merge into `staging` branch (auto-deploys to staging VPS) → manual test → PR to `main` for prod. **Ops prerequisite: add `MFA_ENC_KEY` to the staging (then prod) server env before deploy.**
