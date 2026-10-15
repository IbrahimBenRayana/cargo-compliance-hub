# Implementation Plan: Native ABI Go-Live

Spec: `docs/abi-engine/NATIVE_GO_LIVE_SPEC.md` (approved with decisions 2026-10-15).
Phases 1-5 are expanded after the platform audit (`docs/audit/2026-10-platform-audit.md`) lands,
so its findings fold into the right tasks. Phase 0 is fully specified and starts now.

## Phase 0: Safety rails (CERT vs PROD can never be crossed)

Goal: before prod is ever given an MQ connection, make it structurally impossible for staging
to reach CBP PROD, for prod to send a certification scenario, or for an environment to run a
bridge built from the other branch. Everything fails closed.

### Task 0.1: Explicit CBP environment in server config

**Description:** Add `ABI_TRANSPORT` (`mock|mqipt`), `CBP_ENVIRONMENT` (`NONE|CERT|PROD`),
`MQIPT_BRIDGE_URL` and `MQIPT_BRIDGE_TOKEN` to the zod env schema, and a small
`services/cbp/environment.ts` module that is the single source of truth: current environment,
the queue manager it requires (`CERT→QGC1`, `PROD→QGP2`), and whether certification traffic
is allowed (CERT only).

**Acceptance criteria:**
- [ ] `ABI_TRANSPORT=mqipt` with `CBP_ENVIRONMENT=NONE` fails boot with a clear message.
- [ ] In production, `ABI_TRANSPORT=mqipt` without `MQIPT_BRIDGE_TOKEN` fails boot.
- [ ] `expectedQueueManager()` and `certTrafficAllowed()` are pure and unit-tested.

**Verification:** `vitest run src/services/cbp`, server typecheck (`tsconfig.build.json`).
**Dependencies:** None. **Files:** `server/src/config/env.ts`, `server/src/services/cbp/environment.ts`, test.
**Scope:** S

### Task 0.2: Transport refuses a mismatched bridge

**Description:** The bridge `/health` reports its queue manager. A guard around the transport
checks it before the first send/receive (and re-checks on a short TTL): if the bridge's queue
manager is not the one `CBP_ENVIRONMENT` requires, every send/receive throws
`CbpEnvironmentMismatchError` and nothing is transmitted.

**Acceptance criteria:**
- [ ] `CERT` + bridge on `QGP2` → send and receive throw; nothing reaches the bridge's `/send`.
- [ ] `CERT` + `QGC1` → passes through; the check result is cached for the TTL.
- [ ] Bridge unreachable or not reporting a queue manager → refuses (fail closed).

**Verification:** unit tests with a stub bridge; typecheck.
**Dependencies:** 0.1. **Files:** `server/src/abi-engine/transport/{mqiptTransport,index}.ts`, `server/src/services/cbp/guardedTransport.ts`, test.
**Scope:** S-M

### Task 0.3: Cert console is CERT-only

**Description:** Every cert-console route that sends to or reads from MQ (transmit, receive,
attach-logged, AMF, AMF bulk, HTS query, AD/CVD query) returns 409 unless the environment is
CERT (mock transport stays usable in dev). The connectivity proof (`/transport/verify`) and
status stay available in both. `GET /transport` reports environment + queue manager; the page
shows a clear banner and disables send/receive controls outside CERT.

**Acceptance criteria:**
- [ ] On `PROD`, all MQ-touching cert routes return 409 with an explanatory message (tested).
- [ ] On `CERT`, behaviour is unchanged.
- [ ] The console page shows the environment and disables transmit/receive when not CERT.

**Verification:** route tests (supertest or handler-level), frontend typecheck (`tsconfig.app.json`).
**Dependencies:** 0.1, 0.2. **Files:** `server/src/routes/certConsole.ts`, test, `src/pages/AdminCertConsolePage.tsx`, `src/api/client.ts`.
**Scope:** M

### Task 0.4: Bridge enforces its own environment

**Description:** The mq-bridge takes `CBP_ENVIRONMENT` too and refuses to start if the queue
manager or channel table does not match it (`CERT↔QGC1/QGC1_*.TAB`, `PROD↔QGP2/QGP2_*.TAB`).
`/health` returns `{ ok, qmgr, environment }`. The check is a pure function with node tests.
Compose passes `CBP_ENVIRONMENT` to both the server and the bridge.

**Acceptance criteria:**
- [ ] Mismatched pairs exit at startup with a clear log line (tested as a pure function).
- [ ] `/health` body includes `qmgr` and `environment`.
- [ ] Compose passes `CBP_ENVIRONMENT` to `server` and `mq-bridge`.

**Verification:** `node --test` in `server/mq-bridge`; `docker compose config` parses.
**Dependencies:** None (pairs with 0.2). **Files:** `server/mq-bridge/{index.js,envCheck.js,envCheck.test.js,package.json}`, `deploy/docker-compose.prod.yml`.
**Scope:** S-M

### Task 0.5: Bridge image pinned per environment, with a health gate

**Description:** The deploy writes `MQ_BRIDGE_IMAGE_TAG=<commit sha>` into the VM `.env`
(as it already does for the server's `IMAGE_TAG`), so each environment runs the bridge built
from its own branch, never the shared `:latest`. After `up -d mq-bridge`, the deploy checks
bridge health from inside the server container and rolls the tag back if it fails.

**Acceptance criteria:**
- [ ] A staging push can no longer change the bridge running on prod.
- [ ] A bridge that fails health after deploy is rolled back to the previous tag.

**Verification:** workflow lint (`actionlint` if available), a staging deploy shows the SHA tag on `mycargolens-mq-bridge`.
**Dependencies:** 0.4. **Files:** `.github/workflows/ci-cd.yml`.
**Scope:** S

### Task 0.6: Staging rollout and verification

**Description:** Set `CBP_ENVIRONMENT=CERT` in the staging `.env` *before* the code that
requires it deploys; deploy; verify.

**Acceptance criteria:**
- [ ] Staging server and bridge report `CERT` / `QGC1`; bridge runs the commit-SHA tag.
- [ ] TRADE.VERIFY round trip passes on staging; a cert scenario still transmits and its response attaches.
- [ ] Prod is untouched (no `.env` change; it still runs mock transport).

**Verification:** run watcher (by head SHA) + container dist grep + malware scan + health; console check.
**Dependencies:** 0.1-0.5.
**Scope:** S

### Checkpoint: Phase 0
- [ ] All server tests and both typechecks pass.
- [ ] Staging transmits to CERT exactly as before; a forced mismatch (unit tests) refuses.
- [ ] Report to Ibrahim, then expand Phases 1-5 with the audit findings.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| New boot requirement crashes staging if `.env` lags the deploy | High (staging down; health gate rolls back) | Set `CBP_ENVIRONMENT=CERT` on the VM first (0.6), then push |
| Bridge env check blocks a legitimate config | Med | Clear startup log naming the mismatch; check is a tested pure function |
| Guard adds latency to every send | Low | Health check cached with a short TTL |
| Audit agents reading files being edited | Low | Phase 0 items are listed as already known in the audit context |
