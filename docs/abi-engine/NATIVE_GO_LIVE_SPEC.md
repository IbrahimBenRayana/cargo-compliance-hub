# Spec: Native ABI Go-Live (CustomsCity replacement)

> Status: APPROVED with decisions, 2026-10-15. Supersedes MIGRATION_PLAN.md §4 Phase 5 in detail.
> Trigger: CBP certification complete; Michael Barela (CBP) set up the S7P production
> service-center profile on 2026-10-13 and confirmed go-live parameters on 2026-10-15.

## Objective

Every new MyCargoLens filing reaches CBP through **our own** certified engine and IBM MQ
connection, with no CustomsCity in the transmission path.

- **Production** (app.mycargolens.com, `main`) is connected to **CBP PROD** (QGP2).
- **Staging** (staging.mycargolens.com, `staging`) is connected to **CBP CERT** (QGC1), and
  stays our test bench. Nothing on staging can ever reach PROD, and nothing on prod can
  ever send a certification scenario.
- There are **no live clients yet** (fresh business, fresh prod DB), so native is the
  default gateway for every org. CustomsCity stays only as a per-org emergency fallback
  flag (`CC`), not as a migration program, and is retired once native has run cleanly.

Users: client brokers and self-filing importers (their own filer codes, our queue as their
Service Provider), and importers for whom Sigma itself acts as ISF filer (filer code S7P).

### CBP ground rules (from Michael Barela, 10/13 and 10/15)

| Rule | Consequence for the build |
|---|---|
| Profile is a **service center** queue | Batches go out with our A-record sender (1303 / S7P) and the **client's** filer code in the B block |
| Clients ask their own client rep to add our queue (LOI naming Sigma as Service Provider) | An org cannot transmit natively until an admin records that its rep approved our queue |
| ISF under S7P **only** when Sigma itself is the ISF filer | Both offered: the filer chooses **per filing** whether Sigma files under S7P or they file under their own filer code (org default + per-filing override) |
| Keep the Middleware certificate; PROD = QGP2 / cbpgw-trade-prod:31530 / channel SIGMATP | Same keystore on both VMs; QGP2 channel table on prod |
| ISA valid 3 years; renew on change of legal name or data-origination address | Hosting must be final **before** the first PROD connection (see Open Questions) |

## Scope

**In:**
1. Environment safety rails (CERT vs PROD) and prod MQ connectivity.
2. The inbound pipeline: every CBP message is persisted durably, parsed, and correlated to its filing.
3. Per-org CBP configuration and the per-org gateway flag (`CC` / `NATIVE`).
4. Native ISF-10 and ISF-5: add, replace and delete.
5. Native entries: entry summary with cargo release certification (types 01 and 11). Type 86 cargo release follows once the SE path has passed CERT on staging.
6. Promotion of `staging` to `main`: 219 commits, with prod untouched since Aug 6.

**Out (follow-on phases, tracked in the plan):**
- Statement parsing (PF / periodic). Raw messages are persisted in this phase, but not parsed.
- In-bond transmission.
- Native manifest query.
- Native MID lookup.
- Own HTS classifier.
- Moving the duty-calculation routes off CustomsCity.
- Decommissioning CustomsCity.

## Architecture

```
filingWrite / abiWrite ──(org.cbpGateway)──┬─ CC  → existing ccClient path (unchanged)
                                           └─ NATIVE → nativeTransmit service
                                                         build (mapper → builder → validate)
                                                         → CbpTransmission row (QUEUED)
                                                         → transport.send → SENT
CBP outbound queue ──► mq-bridge (syncpoint get) ──► inbound job ──► CbpInboundMessage (raw, durable)
                                                       │  then bridge commit (ack)
                                                       ▼
                                             dispatcher: parseBatch → app parser
                                             → correlate (B-record tag / business keys)
                                             → applyIsfVerdict / applyEntryVerdict
                                               (status, history, notify, webhook, billing — once)
```

Key decisions:

- **D1. One queue consumer.** Only the inbound job reads the MQ receive queue.
  - The cert console stops draining the queue itself. It reads from `CbpInboundMessage` instead, attaching by scenario tag as it does today.
  - This removes the race between the cert console, the inline HTS/AD/CVD queries and a production poller.
- **D2. At-least-once receive.** Reads are no longer lost if the server dies mid-read.
  - The bridge gets messages under syncpoint and returns each batch with its MQ MsgId.
  - The server persists the batch, then calls `/ack`, which commits. A missing ack backs the message out.
  - `CbpInboundMessage` is unique on (environment, mqMessageId), so redelivery is idempotent.
- **D3. Correlation.**
  - Every native batch carries a B-record user-data tag, `MCL` plus a short transmission id (≤21 chars, echoed by CBP).
  - Unsolicited messages (SA, SO, UC, PF) are matched on business keys: ISF transaction number, filer code plus entry number, or bill.
  - Anything that doesn't match is kept and shown in an admin "unmatched" view. Nothing is dropped.
- **D4. Native is not shoe-horned into the CustomsCity-shaped `AbiGateway` contract.**
  - That contract models CC's create/send/poll REST API.
  - Native is push-driven, so the branch lives one level up, in `filingWrite` / `abiWrite`.
  - The non-transmission tools (HTS classify, MID list, duty, manifest query) stay on `abiGateway` for now.
- **D5. One verdict function per filing kind.**
  - `applyIsfVerdict` and `applyEntryVerdict` are the only places a CBP outcome changes status, writes history, notifies, emits webhooks and bills.
  - The CC poller and the manual check routes are refactored to call the same functions. This fixes today's drift, where the manual checks never notify or bill.
- **D6. Environment is explicit and enforced, failing closed.**
  - `CBP_ENVIRONMENT=CERT|PROD` is zod-validated, with no default.
  - The bridge reports its queue manager. The server refuses to transmit if `CERT↔QGC1` / `PROD↔QGP2` doesn't match.
  - The cert console's transmit and query routes return 409 unless the environment is CERT.
  - The mq-bridge image is pinned per environment by commit SHA, never `:latest`.
- **D7. Sender credentials are secrets, not DB rows.**
  - `CBP_SENDER_SITE`, `CBP_SENDER_ID` and `CBP_SENDER_PASSWORD` live in the VM `.env`.
  - The cert console keeps `CertParamsConfig` for scenario data only.

## Data model changes (Prisma, additive only)

- `OrgCbpConfig` (one per org):
  - `orgId`
  - `gateway` (`NATIVE` | `CC`, default `NATIVE`; `CC` is the emergency fallback)
  - `filerCode` (3 characters)
  - `isfFilerModeDefault` (`CLIENT` | `SIGMA`); `Filing.isfFilerMode` overrides it per filing
  - `serviceCenterApprovedAt`, `serviceCenterApprovedBy` (when and by whom the client rep's approval was recorded)
  - `notes`
- `CbpTransmission`:
  - `id`, `orgId`, `environment`, `application` (SF / AE / SE …), `action`, `entityType`, `entityId`, `filerCode`
  - Correlation keys: `userDataTag`, `entryNumber`, `isfTransactionNumber`, `reference`
  - `wireText`, `mqMessageId`
  - `status` (`QUEUED` | `SENT` | `ACCEPTED` | `REJECTED` | `CONDITIONAL` | `FAILED`)
  - `sentAt`, `respondedAt`, `lastError`
- `CbpInboundMessage`:
  - `id`, `environment`, `mqMessageId` (unique with `environment`), `rawText`, `application`, `receivedAt`
  - `parsed` (JSON), `parseError`
  - `transmissionId?`, `matchedEntityType?`, `matchedEntityId?`, `dispatchedAt`
- No existing column is removed. `ccFilingId` and `ccDocumentId` stay for orgs still on CC.

## Commands

```
Server tests:      cd server && ./node_modules/.bin/vitest run
Engine tests:      cd server && ./node_modules/.bin/vitest run src/abi-engine
Server typecheck:  cd server && ./node_modules/.bin/tsc --noEmit -p tsconfig.build.json
Frontend typecheck: ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
Prisma migration:  cd server && npx prisma migrate dev --name <name>   (additive only)
Deploy:            push staging → CI → verify container (dist grep + malware scan + /api/health)
```

## Project structure

- `server/src/abi-engine/` holds the engine: pure builders, parsers and transport. No Prisma.
- `server/src/services/cbp/` is new:
  - `environment.ts` (D6)
  - `nativeTransmit.ts`
  - `inbound.ts` (receive + persist + ack)
  - `dispatcher.ts` (parse + correlate)
  - `verdicts/isf.ts`, `verdicts/entry.ts` (D5)
- `server/mq-bridge/` is the sidecar (D2: syncpoint, ack, MsgId).
- `server/src/routes/admin/cbpConfig.ts` provides per-org config for platform admins.
- Frontend: an admin org CBP settings panel and an inbound-message log viewer.
- Tests sit next to the code in `__tests__/`.

## Code style

Match the engine as it is. These are taken from existing code:

```ts
// Pure function, domain types in, wire lines out; throw RecordCodecError on bad input.
export function buildIsf(input: IsfInput): string[] { … }
// Services take ids, use prisma transactions with an atomic status claim:
await tx.filing.updateMany({ where: { id, status: 'submitted' }, data: { … } });
```

- Comments cite the CATAIR chapter and page, or the CBP email date, for every rule.
- No em-dashes in user-facing copy.
- Never claim a live direct CBP connection in marketing until PROD traffic is verified. This is a standing CLAUDE.md rule; it gets updated as the final task.

## Testing strategy

- **Unit tests (Vitest)** cover:
  - The mappers, using fixture filings, through to the wire, plus golden lines for key records.
  - Correlation, using every unsolicited message type, including the live 090 SN/SA sequence.
  - The verdict functions: notify, webhook and billing each fire exactly once, even on redelivery.
  - The environment guards.
- **Bridge tests** cover syncpoint and ack, including backout when there is no ack (mocked `ibmmq`).
- **Integration on staging against CERT** (real queue):
  - A test org flagged NATIVE files an ISF add, replace and delete, plus an entry summary with cargo release, through the real UI and the public API.
  - Responses must flow in with no manual console step.
- **Prod verification:**
  - A TRADE.VERIFY round trip on QGP2.
  - Then one pilot org's first live filing, which is a user-approved step.

## Boundaries

**Always:**
- Staging first. Every change is proven against CERT on staging before `main`.
- Commit explicit files only.
- Run tests and the server typecheck before each commit.
- Verify each deploy: run SHA, dist grep, malware scan, health.
- Persist raw CBP messages before acting on them.

**Ask first:**
- Any change to the prod `.env` or to prod containers. I state the exact diff before applying it.
- The `staging` → `main` promotion.
- The first live PROD filing for any org.
- Flipping any real org to NATIVE.
- Prisma migrations on prod.
- Any new dependency.

**Never:**
- Send a certification scenario, or any staging data, to PROD.
- Read the MQ queue from anywhere but the inbound job.
- Commit DHS trade-package files (`*.kdb`, `*.sth`, `*.TAB`) or sender passwords.
- Force-push.
- Remove the CC path while any org depends on it.

## Success criteria

1. Prod runs `CBP_ENVIRONMENT=PROD` with the bridge on QGP2, and staging runs `CERT` on QGC1.
   - A mismatched pair refuses to transmit (tested).
   - The cert console returns 409 on prod.
   - TRADE.VERIFY passes on both.
2. A CBP batch survives a server restart between bridge get and DB write: it is redelivered, stored once and processed once.
3. On staging/CERT, a NATIVE test org takes an ISF through add, replace and delete, and an entry summary with cargo release through to accepted.
   - Statuses, CBP transaction or entry numbers, history, notifications, webhooks and billing all come out correct, each exactly once.
   - Rejections surface CBP's condition codes and narrative to the user.
4. Flipping an org back to CC sends its new filings through CC. Native filings already in flight keep resolving through the dispatcher.
5. Every inbound message is either matched to a filing or listed as unmatched for an admin. None is silently dropped.
6. `main` contains the promoted staging work, prod health is green, and the existing CC flows are unchanged for CC orgs (Playwright e2e suite passes).
7. The pilot org's first live PROD filing is accepted by CBP.

## Decisions (2026-10-15, Ibrahim)

1. **Hosting:** stay on Contabo. Not raised with CBP for now; Ibrahim will inform CBP later.
2. **Clients:** none live yet. Native is the default; no per-client migration or long shadow run.
   The shadow run is still useful as an offline self-check on staging.
3. **ISF filer:** offer both, chosen per filing (S7P as ISF filer, or the client's own filer code).
4. **PROD sender password:** asked Michael Barela on 10/15; work continues meanwhile.
5. **Multi-HTS (ch.99 overlays):** keep it (Section 301 / 232 / reciprocal overlays are a real,
   daily need) and perfect it: investigate the build end to end and fix its defects.

Standing mandate: the platform was built around CustomsCity. Anything misaligned with the
native goal gets fixed, and the whole app (backend + frontend) is audited for capability,
production readiness and visual quality. Audit report: `docs/audit/2026-10-platform-audit.md`.
