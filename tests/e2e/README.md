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
