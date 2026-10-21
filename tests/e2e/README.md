# MyCargoLens — End-to-End Tests (Playwright)

Browser-driven E2E tests that log into the real app and exercise the core
customs-compliance flows.

> **Note:** the user originally asked to test with *Maestro*. Maestro is a
> **mobile** (iOS/Android) automation tool and isn't a fit for this React web
> app — and it wasn't actually installed (no CLI/JVM). Playwright was already
> set up in the repo, so the suite uses that instead.

## Prerequisites

1. **Postgres** running locally, schema in sync, demo data seeded:
   ```bash
   cd server
   npx prisma db push          # align schema (uses DATABASE_URL from .env)
   npm run db:seed             # demo@mycargolens.com / password123 + sample data
   ```
2. **App running** (frontend :8080, backend :3001):
   ```bash
   ./dev-start.sh
   ```

## Run

```bash
npx playwright test --config tests/e2e/playwright.e2e.config.ts
npx playwright show-report tests/e2e/report      # open the HTML report
```

## What's covered

| Spec | Area |
|------|------|
| `auth.spec.ts`            | login, invalid creds, protected-route redirect, session-survives-reload |
| `navigation.spec.ts`      | smoke-load every authenticated route + 404 + client-side nav |
| `shipments.spec.ts`       | shipments list, filters, open detail, launch ISF wizard |
| `isf-wizard.spec.ts`      | ISF 6-step wizard: fields, step advance, back |
| `isf-full-submission.spec.ts` | **full** ISF-10 wizard → creates a real draft filing (POST → 201); opt-in CBP cert transmit |
| `api-keys.spec.ts`        | public-API key lifecycle: create + one-time secret reveal + revoke |
| `capability-gates.spec.ts`| tracking / duty / ABI upgrade gates for the ISF-only demo tier |
| `admin-account.spec.ts`   | platform-admin clients, settings, team, API keys, logs, manifest, compliance |

### Opt-in: live CBP submission

`isf-full-submission.spec.ts` has a test that transmits a draft to the **CustomsCity cert/sandbox** gateway. It is **skipped by default** so a normal run never makes an external customs transmission. To run it explicitly:

```bash
RUN_CC_SUBMIT=1 npx playwright test --config tests/e2e/playwright.e2e.config.ts -g "transmits to CBP"
```

## Design notes (why it's built this way)

- **Access token is in-memory only** (deliberate security design) and **refresh
  tokens rotate single-use**, while `/login` is **rate-limited to 10/min/IP**.
  So we log in **once per worker** (`fixtures.ts`) and navigate **client-side**
  via the History API (`gotoAuthed` in `helpers.ts`) — no per-test logins, no
  hard reloads, no refresh round-trips.
- **Serial (`workers: 1`)** because the demo user is a single shared account.
- The demo org is on the **ISF-only tier**, so Container Tracking, Duty/HTS, and
  ABI Entry render upgrade gates rather than the feature. Grant those
  capabilities to the demo org to convert the gate tests into feature tests.

## Helper / recon scripts (not part of the suite)

`recon.mjs`, `net-audit.mjs`, `session-persist.mjs`, `repro-bounce.mjs`,
`login-debug.mjs` are standalone `node` scripts used to map the app and
reproduce issues. Run e.g. `node tests/e2e/recon.mjs`.

## Running against staging (testing week)

The base URL and account come from the environment (`specs/env.ts`); nothing
secret is committed. Accounts with MFA need their authenticator secret.

```sh
E2E_BASE_URL=https://staging.mycargolens.com \
E2E_EMAIL=<qa account> E2E_PASSWORD=<password> E2E_TOTP_SECRET=<base32 secret> \
./node_modules/.bin/playwright test --config tests/e2e/playwright.e2e.config.ts
```

Screen sweep (every route at 1440 / 768 / 390 px, light and dark, with
overflow, console-error, failed-request and axe checks):

```sh
E2E_SWEEP=1 E2E_SWEEP_LABEL=full-owner E2E_BASE_URL=... E2E_EMAIL=... E2E_PASSWORD=... E2E_TOTP_SECRET=... \
./node_modules/.bin/playwright test --config tests/e2e/playwright.e2e.config.ts specs/sweep.spec.ts
```

Screenshots and `report.json` land in `tests/e2e/sweep-output/<label>/` (git-ignored).
Specs that need local DB access (`mfa.spec.ts`) or send real email/CBP traffic stay opt-in.

Account-dependent specs read these (defaults suit the local demo account):

| Variable | Meaning |
|---|---|
| `E2E_TIER` | Plan of the run's account: `isf` (default) runs the capability-gate specs; set `full` to skip them. |
| `E2E_PLATFORM_ADMIN=1` | The account is a platform admin; on a remote URL the `/admin` spec is skipped without it. |
| `E2E_EMAIL_2` / `E2E_PASSWORD_2` / `E2E_TOTP_SECRET_2` | A second account in another org, for `session.spec.ts` (tabs and sign-out). |

On a remote URL the demo-hint check and `mfa.spec.ts` (needs local DB access) are skipped.
