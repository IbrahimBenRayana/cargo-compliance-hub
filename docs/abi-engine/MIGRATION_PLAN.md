# Native ABI Engine — CustomsCity Replacement Plan

**Status:** Draft v1 — 2026-08-04
**Context:** CBP LOI in process (self-programming software vendor). IR# 26-164751100 issued.
Client reps assigned (T. Morishita — Long Beach CRO; C. Cahill — CSD/TTO). Service-provider
filer code requested, pending issuance. Certification package received:
`docs/ABI Test complete list of scenarios (Trade).docx` — **89 scenarios, 100% accuracy required.**

**Goal:** Replace CustomsCity with an in-house ABI engine that generates CATAIR records,
transmits directly to CBP ACE, processes CBP responses, and passes formal certification —
then cut production filing over org-by-org with a shadow parallel-run.

---

## 1. Where we actually stand (verified against the codebase, Aug 4 2026)

Three facts dominate the plan:

### 1.1 The seam is not a seam yet
`server/src/services/abi/gateway.ts` defines `AbiGateway = Pick<typeof ccClient, ...>` —
the "interface" **is** CustomsCity's client type. It leaks CC's `{data, status, latencyMs}`
HTTP envelopes, CC's error-body shapes (structurally parsed by `extractCCErrorMessage`),
and CC's stateful create-then-send document lifecycle (including the delete-and-retry
duplicate recovery in `abiWrite.ts:186-222`). A native engine cannot implement it without
first **redefining the contract as provider-neutral**.

Worse, the seam covers only ~7 of 21 production CC call sites. Bypassing it entirely:
`routes/filings.ts` (amend/cancel/check-status/bulk-submit), `services/backgroundJobs.ts`,
`routes/manifestQuery.ts`, `routes/dutyCalculation.ts`, `routes/integrations.ts`,
`routes/compliance.ts`. `calculateDuty`/`calculateDutyAI` aren't even in the gateway type.

### 1.2 CustomsCity does far more for us than "transmit"
Confirmed by exhaustive sweep — our code contains **zero** CATAIR/EDI/fixed-width record
generation, **zero** duty/tax/fee math (no MPF, HMF, IR tax, ADD/CVD, 301/232 — not one
formula), no HTS rate table, no CBP connectivity, no filer-code concept, and no inbound
CBP-response processing (we regex `/ACCEPT|REJECT/i` over CC's free-text statuses).
CC currently provides, and we must build: CATAIR generation, ACE connectivity, duty
computation, HTS reference data + validation, CBP response ingestion/normalisation,
entry-number collision handling, and all lifecycle states beyond accept/reject.

### 1.3 The data model covers roughly a quarter of the certification surface
`AbiDocument` is one JSONB `payload` validated by a zod schema (`schemas/abiDocument.ts`)
whose field list is hand-mirrored in 4 more places (prisma denorm, CC types, `client.ts`,
wizard validators). Entry types are a **closed enum `['01','11','86']`** (11 disabled in
UI). Single HTS per line, no SPI claim codes, no ADD/CVD case fields, no census overrides,
no PGA/FDA/DOT segments, no PSC, no replace/delete actions, no multi-bond, no in-transit,
no query transactions. The gap list (§6) blocks ~70 of 89 scenarios today.

**Also found (fix regardless of migration):** there is **no cron for ABI status polling** —
only a ~30-second in-process poller after send (`abiPolling.ts`). Any entry CBP accepts
after that window sits at `SENT` forever unless someone clicks re-poll, and since billing
fires on acceptance (`abiPolling.ts:168`), **it never bills**. This is a live revenue bug.

---

## 2. Strategic decisions (recommendations — confirm before Phase 1)

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Gateway contract | Define a **neutral `AbiGateway v2`** interface first (our types, our error model, our lifecycle), implement it with a `CustomsCityGateway` adapter, route all 21 call sites through it. Native engine later implements the same contract. | Makes cutover a config flag; kills the `Pick<typeof ccClient>` leak; forced move anyway. |
| D2 | Data model | **Evolve, don't rewrite storage**: keep `AbiDocument` + JSONB payload, but introduce a **versioned payload schema v2** aligned to the 7501/CATAIR data dictionary (superset of v1, `schemaVersion` field, v1→v2 migrator). Add relational columns only where lifecycle needs them (action/revision tracking for replace/PSC). Collapse the 5-way hand-sync by generating client types from the zod schema. | Full relational redesign (lines/parties/bonds tables) is months of churn across UI + public API for little cert value. Revisit post-cert. |
| D3 | Duty engine | Build our own: USITC HTS dataset ingestion (published CSV/JSON, updated continuously) + rate engine (ad valorem/specific/compound, MPF min/max, HMF, IR excise, ch.99 301/232 overlays, FTA/SPI preference rates, ADD/CVD deposit rates via AD query, CBP quarterly currency rates). | Non-negotiable for self-filing: the AE transaction carries filer-computed duty/tax/fee amounts and ACE checks them. Largest single subsystem — start early, scope to scenario needs first. |
| D4 | Connectivity | Build a `transport/` abstraction now (send batch / receive async messages); bind to **MQ or SFTP only after the client rep specifies** the method during "establish communication". Runs on the prod VPS; ISA security requirements will constrain hosting. | Don't guess CBP's answer; don't block the engine on it either. |
| D5 | ISF scope | **Entry summary (AE + companion apps) first; ISF stays on CustomsCity** until ABI cert is passed, then pursue ISF/AMS certification as a follow-on using the same engine. | The cert package is entry-summary-centric; splitting focus risks the 100%-accuracy bar. |
| D6 | Cutover | Per-org gateway flag + **shadow parallel-run**: while an org still files via CC, generate native CATAIR for the same entry and diff (record-level + status-level). Graduate orgs when diffs are clean. | The only honest way to prove production readiness beyond 89 fixtures. |

---

## 3. Target architecture

New module `server/src/abi-engine/` (isolated, no CC imports):

```
abi-engine/
├── records/        # Fixed-width codec: declarative RecordDef DSL (field, start, len,
│                   # type, pad, required-by-condition) → writer + parser + golden tests
├── envelope/       # Transmission assembly: A/B ... Y/Z block control records, batch
│                   # structure, control numbers, filer-code auth, "SCENARIO nnn" @ B-rec pos 60
├── applications/
│   ├── ae/         # Entry Summary create/update/replace/delete/PSC — 10–90 record builders
│   ├── ax/         # Entry Summary response parser (accept/reject/warnings → typed results)
│   ├── cw-cj/      # Census warning override + query
│   ├── ad/         # ADD/CVD case information query
│   ├── qa/         # Quota query
│   ├── te/         # TIB extension
│   ├── uc/         # Entry summary status notification (inbound)
│   └── esq/        # Entry summary query
├── duty/           # Rate engine: HTS rates, MPF/HMF/IR tax, ch.99 overlays, FTA
│                   # preference, ADD/CVD deposits, currency conversion
├── refdata/        # Ingestion jobs + tables: USITC HTS, Schedule D ports (server-side!),
│                   # country/UOM/MOT/payment-type code sets, surety codes, exchange rates
├── validate/       # ABI rules engine: severity levels, entry-type-conditional rules,
│                   # the ~40 cross-field rules the scenarios exercise. THIS is what CBP
│                   # means by "your system must reject invalid transactions client-side."
├── transport/      # MQ/SFTP client (CERT + PROD profiles), outbound queue, inbound
│                   # message dispatcher → applications/* parsers → status engine
├── gateway/        # NativeAbiGateway implements AbiGateway v2
└── cert/           # Certification harness: 89 scenario fixtures, runner, golden files,
                    # rejection-evidence capture, transmission log for the client rep
```

Cross-cutting changes outside the engine:
- **AbiGateway v2** contract + `CustomsCityGateway` adapter (Phase 0).
- **Status engine**: replace regex-on-strings with a typed lifecycle
  (DRAFT → VALIDATED → QUEUED → TRANSMITTED → ACCEPTED/REJECTED/… plus release, holds,
  census warning, statement states). Cron-driven for CC (fixes the billing bug now);
  push-driven for native.
- **Cert ops console** (small internal UI): run scenarios, view generated records, see
  AX responses, capture client-side rejection screenshots, track per-scenario pass state.
  Certification happens "from your system" — this console *is* the system for cert purposes,
  so the main wizard UI can lag behind the payload model without blocking certification.

---

## 4. Phases

Per our working agreement: **foundation sequential, breadth parallelized via subagents,
pace over speed.**

### Phase 0 — Seam hardening + groundwork (sequential, ~1 week)
1. **Fix the ABI billing bug now**: add `CRON.ABI_STATUS_POLL` mirroring the ISF status
   poll; reconcile `SENT` docs; backfill missed billings. Ship independently.
2. Define **AbiGateway v2** (neutral): document lifecycle, typed errors, capability map.
   Implement `CustomsCityGateway` adapter; route all 21 call sites (incl. `filings.ts`
   amend/cancel, `backgroundJobs.ts`, manifest query, duty calc) through it.
3. Split `services/customscity.ts` (1,896 lines) into ISF / ABI / duty-calc / manifest
   modules so halves can be swapped independently.
4. Acquire specs: CATAIR chapters from CBP.gov — *Introduction & Getting Started* (required
   reading per the test doc), *Entry Summary Create/Update (AE)*, *ES Response*, *Census
   Warning (CW/CJ)*, *ADD/CVD (AD)*, *Quota (QA)*, *TIB (TE)*, *ES Status Notification (UC)*,
   *ES Query*, *ABI Batch & Block Control*, error-code appendices. Store under
   `docs/abi-engine/specs/`. Extract record layouts into machine-readable YAML/JSON defs.
5. Send the client-rep questions (done Aug 4): scenario subset, comms method, CATAIR
   versions, supplied-values flow.

### Phase 1 — CATAIR core (sequential foundation, ~2–3 weeks)
1. `records/` codec + declarative RecordDef DSL + property/golden tests.
2. `envelope/` batch/block assembly with filer auth + scenario tagging (B-rec pos 60,
   Broker Reference Number right-justified).
3. **AE happy path**: minimal type-01 entry summary (scenario 003-class) built from
   payload v2 → full record stream; `ax/` response parser.
4. **Payload schema v2** (CATAIR-aligned superset, versioned) + v1→v2 migrator +
   generated client types.
5. Golden-file harness: every builder change diffs against reviewed record streams.

### Phase 2 — Breadth (parallel workstreams, each subagent-sized)
| WS | Scope | Unblocks scenarios |
|---|---|---|
| A | **Line-item model v2**: multi-HTS/ch.99 tariff lines, SPI claim codes, MID, ruling type+number, steel/aluminum licenses, product exclusions, census override codes, charges, secondary quantities+UOM, per-line state of destination, commercial description | 001–002, 005, 008, 012, 018–020, 023–024, 028–029, 037, 039, 043–046, 048–049, 051, 054, 058, 089 |
| B | **Entry types**: 02, 03 (ADD/CVD cases, rate qualifiers, bond/cash claim), 06 (FTZ privileged date), 07, 11, 12, 21, 23 (TIB) + type-conditional validation | 009, 027, 034, 036, 043, 047, 055–056, 067–074, 079 |
| C | **Header/lifecycle**: multi-bond (continuous + STB, producer acct), live entry, replace/delete actions, PSC (indicator + H/L reason codes, revision tracking), recon flag, consolidated release, deferred tax, PMS fields (statement month, branch id), cargo-release cert indicator, in-transit numbers/dates, multiple/sub-house bills | 003–004, 007, 010–011, 015, 017, 025, 033, 057, 060–061, 065, 075–078, 081–082, 087 |
| D | **PGA segments**: PG records — FDA (product code, quantities, actual manufacturer), DOT HS-7, disclaimer codes (FC0/FD0) | 083, 085–086, 049 |
| E | **Companion applications**: CW, CJ, AD, QA, TE, ES query builders/parsers + UC inbound processing | 006, 021–022, 050, 062–064, 066, 080 |
| F | **Duty engine**: USITC HTS ingest, rate engine, MPF/HMF/IR tax, ch.99 overlays, FTA preference, ADD/CVD deposit rates, CBP quarterly currency | every AE scenario (amounts on the summary), esp. 024, 043, 045, 065, 089 |
| G | **Validation rules engine** + the intentionally-invalid scenarios rejected client-side with evidence capture | 016, 030–031, 042, 052–053 + quality bar everywhere |
| H | **Cert ops console** + progressive wizard expansion (console first; wizard follows) | operational requirement for the whole test |

Order within Phase 2: A and F start first (longest poles, most scenario coverage);
B/C build on A's model; D/E/G/H parallel as capacity allows.

### Phase 3 — Scenario harness + internal dry-run (~1–2 weeks after breadth lands)
- Encode all 89 scenarios as executable fixtures (exact values from the CBP doc; "Client
  Rep will supply" values parameterised).
- Full-suite run → reviewed golden record streams for every scenario; rejection evidence
  for the invalid ones; printed 7501 rendering (the rep may request `CBPF 7501` copies —
  we need a 7501 PDF renderer; scope it here).
- Internal gate: 89/89 generating reviewed-correct output before we touch CBP CERT.

### Phase 4 — Connectivity + formal certification (externally gated)
- Blocked on CBP: filer code issuance → "establish communication" → ISA signing → CERT
  queue credentials + comms method. Build `transport/` binding when specified.
- Background queries first (per test instructions), then transmit scenarios in the agreed
  window; track AX responses in the cert console; iterate with the client rep to 100%.

### Phase 5 — Production cutover
- Statement processing readiness (daily/PMS), PROD queue config, filer-code config per org.
- **Shadow parallel-run** (D6) on real entries; diff dashboards.
- Graduate orgs CC→native via gateway flag; keep CC as instant rollback for a full cycle
  (including a liquidation-relevant period); then decommission ABI-side CC and start the
  ISF certification follow-on (D5).

---

## 5. External/business track (runs alongside, mostly waiting)

| Item | Owner | State |
|---|---|---|
| Continuous Type 1 bond against IR# 26-164751100 | Imran + surety agent | **Do now** |
| ACE Secure Data Portal importer account | Imran | **Do now** (~15 min application) |
| Filer code issuance | CBP (Cahill confirmed submitted) | Waiting |
| Comms method + CERT queue + ISA | CBP client rep after filer code | Waiting |
| Scenario subset + CATAIR versions confirmation | Morishita (questions sent) | Waiting |
| Testing window agreement | Us + client rep | After Phase 3 |

---

## 6. Certification coverage matrix (capability clusters)

Current support baseline: types 01/86 minimal happy path via CC. Everything below is new.

| Capability cluster | Scenarios | Today | Phase |
|---|---|---|---|
| Minimal AE + live entry + MOT/ports | 003, 007, 014, 041 | partial (via CC) | 1 |
| FTA/SPI claims (SG, IL, CL, KR, MA, AGOA, FAS, insular, USMCA, NAFTA, W/Y/Z) | 001–002, 008, 018, 026–027, 035, 038, 040, 044, 051, 054–055, 084 | none | 2A/2B |
| Multi-HTS lines / ch.99 / sets / 301 | 019, 024, 032, 037, 039, 048, 059, 089 | none | 2A |
| Census warning / override / query | 005–006, 020–022 | none | 2A+2E |
| Licenses & certificates (steel, aluminum, diamond, EIAP/visa, exclusions, rulings) | 012–013, 023, 049, 055, 088 | none | 2A |
| ADD/CVD (cases, rates, deposits, queries) | 043, 063–064, 067–073 | advisory only | 2B+2E+2F |
| Entry types 11/12/21/23/06/07 flows | 009, 034, 036, 047, 056, 074, 079–080 | none | 2B |
| Bonds (STB detail, multi-bond) | 004, 033 | single bond obj | 2C |
| Lifecycle actions (delete, replace, PSC) | 015, 017, 075–078 | none | 2C |
| In-transit / in-bond / bills-of-lading detail | 007, 010–011, 025, 081, 087 | none | 2C |
| Statements & payment (daily, PMS, deferred tax) | 065, 082 + "all summaries on statement" | typeCode int only | 2C |
| Consolidated release / recon / cargo-release cert | 057, 060–061 | none | 2C |
| PGA (FDA, DOT HS-7, disclaimers) | 083, 085–086 | advisory only | 2D |
| Queries + UC notifications | 050, 062, 066 | none | 2E |
| Duty/tax/fee amounts on every summary | all AE | none (CC computes) | 2F |
| Client-side rejection of invalid data | 016, 030–031, 042, 052–053 | none | 2G |
| Currency conversion | 045 | none | 2F |

---

## 7. Risks

1. **Duty-engine correctness** — ACE recomputes and rejects mismatches; 100% bar. Mitigate:
   golden tests per scenario, cross-check amounts against CC's calculator during shadow runs.
2. **Spec drift / CATAIR versions** — build record defs as data (YAML) with version tags;
   confirm versions with client rep (asked).
3. **CBP wait times** — filer code + ISA are the long pole; Cahill warned "this can take
   some time". Engine build (Phases 1–3) is deliberately not blocked on it.
4. **Statement/PMS semantics** — hardest to test outside CERT; lean on client rep + UC
   messages in Phase 4.
5. **Hosting/ISA constraints** — ISA may impose network/security requirements on the VPS;
   review when paperwork arrives (security-audit follow-up context in `docs/security/`).
6. **Scope discipline** — the wizard UI does NOT need full parity for certification (cert
   console suffices); resist gold-plating before the cert gate.
7. **CC dependency meanwhile** — ISF and production ABI stay on CC until Phase 5; keep the
   contract/token alive and avoid breaking ISF paths while splitting `customscity.ts`.

## 8. Endgame — path to zero CustomsCity dependence

After Phase 5 (ABI entries native), the remaining CC tail and its retirement path:

| Remaining dependency | Retirement path | When |
|---|---|---|
| ISF filing (D5 scope decision) | ISF/AMS certification follow-on on the same engine | after ABI cert |
| Manifest query (pre-fill) | native ABI cargo/manifest query applications | with/after ISF follow-on |
| HTS classifier + duty-calc tools (CC proxies) | Phase 2F duty engine + own AI classification over ingested USITC HTS data | replaceable at Phase 5 |
| MID list query | native ABI query equivalent | trivial, with follow-on |
| Rollback insurance | keep CC contract through parallel-run window only | sunset after clean cycle |

Net-new capability unlocked by independence: **In-Bond (QP/WP) filing** — the Plan B
phase blocked on CC's inaccessible API becomes directly buildable, as do FTZ e214,
drawback, and reconciliation later. Full CC decommission ≈ 2–3 months of work beyond
ABI certification. End state: MyCargoLens is itself a CBP-certified ABI software vendor —
no shared token, no pass-through per-filing cost, and the public API stands on our own
filer infrastructure.

## 9. Effort shape (engineering, excluding CBP wait)

Phase 0 ~1 wk · Phase 1 ~2–3 wks · Phase 2 ~6–8 wks parallelized · Phase 3 ~1–2 wks ·
Phase 4 externally paced · Phase 5 ~2–3 wks + a monitored parallel-run period.
Realistic wall-clock: **~3–4 months to cert-ready**, aligning well with CBP's own pace.
