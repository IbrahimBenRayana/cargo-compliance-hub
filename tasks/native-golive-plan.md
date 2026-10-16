# Implementation Plan: Native ABI Go-Live

Spec: `docs/abi-engine/NATIVE_GO_LIVE_SPEC.md` (approved with decisions 2026-10-15).
Phases 1-5 are expanded after the platform audit (`docs/audit/2026-10-platform-audit.md`) lands,
so its findings fold into the right tasks. Phase 0 is fully specified and starts now.

## Phase 0: Safety rails (CERT vs PROD can never be crossed) — DONE 2026-10-15 (d441c4d on staging)

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

---

## Audit fold-in (2026-10-16)

Source: `docs/audit/2026-10-platform-audit.md` (237 findings; ids below refer to its JSON).

### Workstream H: hardening quick wins (now, parallel to Phase 1; each S, independent)
- [x] H1 FY2027 MPF/HMF fee tables (effective 2026-10-01) (ENG-01)
- [x] H2 Type 86 suspended by CBP: remove from wizard/API/landing, enable Type 11 (ENG-08, CAP-01, FNA-06, MHT-13, LND-01)
- [x] H3 Entry wizard code tables match CATAIR: mode of transport, payment type, 4-digit Schedule D ports (FNA-01/02, UFF-02/03)
- [x] H4 Fix wizard crash on "Advanced, trade compliance" (Radix SelectItem value '') (UFF-05)
- [x] H5 Remove false claims: fabricated stats + "Live" badge, AWS security page, SOC 2 / "Direct CBP" badges, in-bond "live" (LND-03/04/05, FPR-07, BPR-12, USA-02)
- [x] H6 MFA: streams reject the partial-auth token (BPR-03)
- [x] H7 Enforce the viewer role server-side (BPR-05, FNA-16)
- [x] H8 Password reset flow (USA-13)
- [x] H9 Bulk submit goes through filingWrite (transmit + billing gate) (LND-M1)
- [x] H10 ISF deadline = 24h before lading, not ETD-24h (UOP-M1)

### Phase 1: inbound pipeline + CBP message model (expanded) — DONE 2026-10-16
- [x] 1.1 Bridge: non-destructive browse + delete-by-MsgId ack; return MsgId; fix delimiter default (ENG-11)
- [x] 1.2 `CbpInboundMessage` (immutable, unique env+msgId) + `CbpTransmission` (immutable wire, status) (BPR-02)
- [x] 1.3 Inbound job (sole queue consumer; cert console reads from the table) (D1)
- [x] 1.4 Dispatcher + correlation (B-record tag, business keys, unmatched view data) (BNA-10)
- [x] 1.5 CBP response model: conditions (F/W/P/I), versions, release/hold/PGA, SA bill match, UC (BNA-07, CAP-03)
- [x] 1.6 Condition catalog from engine tables → user-facing rejection text + field pointers (BNA-08, FNA-10, FPR-06)
- [x] 1.7 Exactly-once send: transmission row before send, unknown-outcome state, no blind retries (ENG-12, BPR-06, BPR-M1)
- [x] 1.8 Admin ops views: transmissions, inbound/unmatched, bridge health (FNA-18, UOP-08)

### Phase 2: per-org CBP identity — DONE 2026-10-16
- [x] 2.1 OrgCbpConfig (gateway, filer code unique/never S7P, ISF default, service-center approval) + Filing.isfFilerMode
- [x] 2.2 services/cbp/filerIdentity: ISF SIGMA->S7P, CLIENT/entries need own code + approval + valid check digit
- [x] 2.3 Sender identity from server secrets (CBP_SENDER_*), staging .env populated
- [x] 2.4 Entry sends and entry-number ranges bound to the org filer code; global overlap check (BNA-01, FNA-04)
- [x] 2.5 Admin CBP setup dialog + client CBP identity card; CC control panel removed (FNA-07, USA-09)
- [x] API keys/webhooks gated + audited + die with creator; /jobs platform-admin only (BPR-04, BPR-11 partial)
- [ ] Platform admins must have MFA (BPR-11): blocked on the staging admin enrolling MFA first (asked Ibrahim)
- [ ] Per-filing ISF filer choice in the wizard: with Phase 3

### Phases 3-5
Expanded when each starts, from the workstream table in the audit report (A3-A5, C, D).
