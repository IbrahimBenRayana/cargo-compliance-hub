# Spec: Foreign Importer of Record rule (U.S. IOR declaration on every entry)

Status: DRAFT 2026-11-16, plan only, nothing built. Needs founder answers (end of doc).
Rule: CBP interim final rule "Heightened Requirements for Foreign Importers of Record",
91 FR 69977 (FR Doc 2026-22735, CBP Dec. 26-19, docket USCBP-2026-1387), published Nov 6 2026,
**effective Jan 5 2027**. Engine scope: native ABI engine only (CustomsCity path is frozen).

## What CBP actually requires (verified against primary sources)

Sources read in full: the FR text (govinfo), CSMS #70409426 (Nov 10 2026), the draft CATAIR
chapters CBP posted under "Future Capabilities": Entry Summary Create/Update **V112**
(Oct 29 2026), Cargo Release **V41.1** (Nov 4 2026), Error Dictionary **V56**, Cargo Release
Condition Codes (Nov 9 2026).

**Regulation (new 19 CFR part 110, §§141.21/141.22, 111.21/23/29, 142.13/25):**
- *U.S. IOR* (§110.2): a U.S. citizen or LPR, or an entity that is located in and organized
  under U.S. law **and** either ≥51% U.S.-citizen/LPR beneficial ownership with control, or
  direct ownership of significant unencumbered U.S. real property. CBP may verify; the Center
  Director decides. *Foreign IOR* (§110.3) = anyone who doesn't qualify.
- *Foreign IOR* (§141.21) may enter goods for consumption only if it is CTPAT validated, or
  it designates a CTPAT-validated licensed broker to make entry or act as IOR. Applies to all
  formal entry types and informal types 11, 12, 13, including warehouse/FTZ withdrawals for
  consumption.
- *U.S. IOR* (§141.22) must **declare** its U.S. IOR qualification on every entry (3461) and
  entry summary (7501). A non-CTPAT broker acting as IOR for a principal must identify the
  principal (who must have a 5106 on file).
- Brokers must verify, before filing, that a client meets §110.2 and must keep those records
  for 5 years (§111.29(a)(2), §111.21, §111.23).
- An inaccurate U.S. IOR declaration lets CBP require live entry and pull immediate delivery
  (§142.13(a)(5), §142.25(a)(5)). For brokers, 19 USC 1592 penalties and 1641 discipline apply.

**Grace period: narrower than the secondary source said.** May 6 2027 is the outer limit
only for the **broker client-verification duty** (§111.29), and only for brokers who request
delayed compliance by Jan 5 2027. **The new data fields are mandatory in ACE from Jan 5 2027
with no grace.** CBP deploys to PROD that day, and a 7501 without the new record is rejected.

**The rule never asks the filer to send CTPAT status.** The filer sends a Yes/No U.S.-IOR flag, a
broker-acting-as-IOR flag, and (sometimes) the principal's number. CBP runs the CTPAT lookup
itself (IOR, filer/broker, principal) and rejects bad combinations.

### Wire format

**7501: new Input 15-Record "Importer of Record Information"** (V112, ESF-42). It is
**mandatory** in the Entry Summary HEADER grouping, sits after 11 (and after the 12/13
Final-Delivered-To group, which V111 added and which we don't emit yet), and comes before 20.
When the AE is certified for cargo release (our 01/03/11 path), the 15-record **alone**
satisfies the 3461 side. The SE20 must not repeat it.

| Pos | Len/Class | Desig | Element | Values |
|---|---|---|---|---|
| 1-2 | 2AN | M | Record Identifier | `15` |
| 3 | 1S | M | Filler | space |
| 4 | 1A | M | U.S. Importer of Record Indicator | `Y` IOR (or principal when broker acts as IOR) meets U.S. IOR criteria; `N` foreign |
| 5 | 1S | M | Filler | space |
| 6 | 1A | M | Broker Acting as IOR Indicator | `Y` broker lists itself as filer and IOR on behalf of a principal; else `N` |
| 7-18 | 12X | C | Principal on Power of Attorney | principal's IOR number (SSN/EIN/CBP-assigned, usage-note-f formats) when broker is **not** CTPAT validated and BIC=`Y` |
| 19-80 | 62S | M | Filler | spaces |

New ES errors (Error Dictionary V56): **888** US IOR RECORD MISSING, **889** US IOR RECORD
UNKNOWN (not Y/N), **890/891** BIC missing/unknown, **892** PPA MISSING (non-CTPAT broker, BIC=Y),
**893** PPA UNKNOWN (bad format), **894** PARTY NOT CTPAT VALIDATED (foreign IOR without a
CTPAT-validated broker (10-rec pos 22-30) or principal).

**3461 standalone (SE): four new SE20 reference qualifiers** (V41.1, SE-64..66). `UIR` Y/N,
`BIC` Y/N, `PPA` 12X (`NN-NNNNNNNXX` / `YYDDPP-NNNNN` / `NNN-NN-NNNN`), and `PPT` 3AN (`EI`, `ANI`,
`34`), which is required whenever PPA is sent. New SE condition codes **337-342** (foreign IOR
and broker CTPAT invalid, PPA required for broker IOR, foreign IOR broker PPA CTPAT invalid, invalid
PPA, missing/invalid PPT).

**Already superseded:** Type 86 is suspended (we already block it at `nativeEntry.ts:118`). ISF
(SF) is untouched by this rule.

**CERT has had this since Nov 12 2026**, so we can test end-to-end now.

## Where we are today (code map)

- **The 3461 travels inside the 7501.** Production sends cargo release only as an AE with the
  release-certification flag (`RELEASE_ENTRY_TYPES` 01/03/11, `server/src/services/cbp/nativeEntry.ts:39`).
  The standalone SE builder (`server/src/abi-engine/cargoRelease/builder.ts:937`) is complete
  but not wired. **So for go-live, the 15-record is the whole wire change.**
- **Record defs:** `server/src/abi-engine/ae/headerRecordDefs.ts` holds RecordDef tables
  (`{name,start,end,class,designation}`), tiled 1-80 and checked by `assertRecordDef`
  (`records/codec.ts:84`). There is no 12/13/15 record today (spec base is the 2026-07 chapter).
- **Builder:** `buildEntrySummary` (`ae/builder.ts:360`). The 11-record is written at `:404-415`,
  and Delete returns before it.
- **Validation:** payload zod `server/src/schemas/abiDocument.ts` (`abiIORSchema` `:27`,
  `entryRuleIssues` `:246`), the CATAIR validator `abi-engine/validate/entrySummary.ts`, and the
  native preflight `buildNativeEntry` (`nativeEntry.ts:109-230`, route `POST /:id/preflight`).
- **Data:** there is no Importer/Party model. Entries are `AbiDocument` (`schema.prisma:828`) with
  `iorNumber`/`iorName` columns, and the rest lives in `payload` JSON (v2: `payload/schemaV2.ts:132`
  `importerOfRecord {number, name}`). `Organization.iorNumber` is org-level. Nothing anywhere
  covers CTPAT or U.S./foreign status.
- **UI:** `src/components/abi-wizard/Step2ImporterBond.tsx:44-66` (IOR number + name),
  `validators.ts:56`, `Step6Review.tsx`, `CbpPreflightCard.tsx`.
- **Public API:** `POST /api/public/v1/entries` and `/entries/:id/send` (`server/src/routes/publicApi.ts:113,134`)
  → `services/abiWrite.ts`.
- **Adjacent bug to fix in the same work:** `releaseEntities` hardcodes the BY identifier
  qualifier as `EI` (`nativeEntry.ts:75`), so a CBP-assigned or SSN IOR goes out mis-typed. The
  number-type inference we need for PPT already exists ISF-side (`abi-engine/isf/fromFiling.ts:247`)
  and should move to a shared helper.

## Objective / acceptance

From Jan 5 2027, every native Add/Replace entry summary (and any standalone 3461 if we wire it)
carries a correct IOR declaration that **a human affirmatively chose**, and CBP never rejects us
for 888-893. Users see 894 / 337 / 339-type combinations as a pre-flight warning before CBP
rejects. Brokers can show which person declared U.S. status for which IOR, and when.

Never default the U.S. IOR indicator to `Y`. A wrong `Y` is the expensive failure (live entry,
penalties). A missing answer blocks the send.

## Design

### 1. Engine (`server/src/abi-engine`)
- Add an `INPUT_15` RecordDef using the table above, and add it to the asserted list.
- `AeEntrySummaryInput.iorDeclaration?: { usImporterOfRecord: boolean; brokerActingAsIor: boolean; principalOnPoa?: string }`.
  Emit the 15-record right after 11 on Add/Replace only, never on Delete (to be confirmed on
  CERT).
- Validator rules that mirror 888-893: declaration present, BIC present, PPA required when
  BIC=Y and filer not CTPAT (only when we know the filer's CTPAT status, see §3), and PPA matches
  usage-note-f formats.
- SE path (kept in sync even though it is dormant): SE20 qualifiers `UIR`/`BIC`/`PPA`/`PPT` in
  `cargoRelease/recordDefs.ts` + builder input. Suppress them when the 3461 is certified via AE.
- Response side: plain-English explanations for ES 888-894 and SE 337-342 wherever we explain
  CBP rejects.
- Store the V112 / V41.1 / Error Dictionary V56 / condition-code docs under
  `docs/abi-engine/specs/` next to the current versions.

### 2. Cutover gate
CBP PROD only knows the 15-record from Jan 5. One config value per environment,
`IOR_DECLARATION_FROM` (CERT: now; PROD default `2027-01-05T00:00-05:00`). Ops can override it
if CBP's deploy slips or lands mid-day. The gate checks the **transmit** time, not when the
draft was created. Before the gate, the 15-record is not emitted and the CATAIR rule is off.
The **UI and API collect the declaration as soon as we ship**, so drafts created in December
are ready on Jan 5. Existing CERT goldens stay byte-identical because the scenario harness runs
with the gate off unless a scenario opts in. New goldens cover the 15-record cases.

### 3. Data model (Prisma, additive, nullable)
- **New `ImporterProfile`** (`orgId`, `iorNumber` unique per org, `iorNumberType` EI|ANI|SSN, `name`,
  `usIorStatus` US|FOREIGN, `ctpatStatus` NONE|VALIDATED|UNKNOWN (self-attested),
  `declaredById`, `declaredAt`, `basis` text (which §110.2 limb), `verifiedAt?`). It remembers the
  answer per IOR and is the audit trail. Phase 2 adds evidence documents with 5-year retention
  for broker §111.29 records.
- **`Organization`**: `ctpatStatus` (filer's own CTPAT validation, self-attested) +
  `ctpatSvi?`. Used only for pre-flight warnings, never sent to CBP.
- **`AbiDocument`**: snapshot in `payload.importerOfRecord` (`usImporterOfRecord`,
  `brokerActingAsIor`, `principalOnPoa {number,type}`) + denormalized `iorUsStatus` column
  for lists and reporting. The per-entry snapshot is the legal declaration, and editing the
  profile later never rewrites sent entries.

### 4. Pre-flight rules (server, shown in `CbpPreflightCard`)
| # | Condition | Result |
|---|---|---|
| R1 | No U.S./foreign answer (after gate) | **Block** (would be 888) |
| R2 | BIC=Y, filer CTPAT not VALIDATED, no PPA | **Block** (892) |
| R3 | PPA present but bad format / missing type | **Block** (893 / SE 342) |
| R4 | Foreign IOR, BIC=N, IOR CTPAT ≠ VALIDATED, filer CTPAT ≠ VALIDATED | **Warn** "CBP will likely reject (894)" (block vs warn: founder Q2) |
| R5 | Foreign IOR, BIC=Y, filer not CTPAT, principal CTPAT ≠ VALIDATED | **Warn** (894 / SE 339) |
| R6 | U.S. IOR chosen but no declaration on the profile by a named user | **Block** until the user ticks the §110.2 attestation |

### 5. UI (entry wizard step 2, `Step2ImporterBond`)
- **"Importer of record status"** is a required two-option choice with no default: *U.S. importer
  of record* / *Foreign importer of record*. A short helper summarises §110.2, with a "How to
  decide" disclosure. Choosing U.S. shows the attestation checkbox ("I have verified the
  importer meets 19 CFR 110.2"), which records the user and time.
- Prefill from `ImporterProfile` when the IOR number matches, and show who declared it and when.
- **"Filing as IOR on behalf of a principal"** toggle (broker orgs only) shows principal number,
  with the type inferred and editable.
- Review step and entry detail show the declaration. Bulk/CSV import and duplicate-entry flows
  carry the snapshot forward but re-confirm when the profile changed.
- Org settings: a "CTPAT validation" field for the filer org. ImporterProfile gets a small list
  page (Phase 2 if Q3 says so).
- Copy must not imply MyCargoLens verifies CTPAT or U.S. status. The user declares, and CBP
  verifies.

### 6. Public API (`/api/public/v1`)
- Additive request fields on `POST /entries` and `PATCH`: `importerOfRecord.usImporterOfRecord: boolean`,
  `brokerActingAsIor?: boolean` (default `false`), `principalOnPowerOfAttorney?: { number, type: "EI"|"ANI"|"SSN" }`.
  Returned on GET.
- Drafts may omit them. After the gate, `POST /entries/:id/send` returns **422
  `ior_declaration_required`** if missing. No server-side default.
- This is behaviourally breaking for integrators on Jan 5: changelog entry, API docs, email to
  API-key holders before Dec 15. Webhook reject payloads get the new error codes and their
  explanations.

## Plan (vertical slices, staging-first, each its own PR into `staging`)
1. **Engine**: INPUT_15 def + builder + validator + gate + goldens; spec PDFs into repo. Shared IOR-number-type
   helper + fix `releaseEntities` qualifier. *Verify:* `cd server && npx vitest run src/abi-engine`;
   `npx tsc --noEmit -p tsconfig.build.json`.
2. **Data + payload**: Prisma migration (ImporterProfile, Organization.ctpatStatus, AbiDocument.iorUsStatus),
   schemaV2 + zod + `toAeInput` + `migrateV1`, pre-flight R1-R6.
3. **UI**: wizard step 2, review, detail, org CTPAT setting. *Verify:* `npx tsc --noEmit -p tsconfig.app.json`,
   browser check on staging.
4. **Public API** contract + docs + changelog.
5. **CERT proof** (CERT live since Nov 12): transmit 01 with Y/N, BIC=Y with/without PPA, and a
   foreign IOR expected to trip 894. Record the verdicts. Target: done by **Dec 11**.
6. **Prod** release to `main` with the gate set to Jan 5, shipped before the holiday freeze (~Dec 18).
   Watch the first post-Jan-5 transmission.

Slices 2-4 depend on 1's payload shape. 3 and 4 can run in parallel after 2. Est. ~8-10 dev days
for 1-4. Phase 2 (broker verification records/evidence vault) is separate, due by May 6 2027
if we want it.

**Out of scope:** CustomsCity path; ISF; wiring standalone SE cargo release; V111 12/13
Final-Delivered-To records (a separate catch-up, worth checking whether any of our flows need it).

## Open questions

**For the founder**
1. **Who files our entries?** Licensed brokers under their own filer code, importers
   self-filing, or both? This decides how prominent the broker-as-IOR / principal UI is and
   whether `Organization.ctpatStatus` is needed at launch.
2. **CTPAT mismatch (R4/R5): block or warn?** Our CTPAT data is self-attested, so I recommend
   *warn + require an explicit "send anyway"*.
3. **Scope of broker verification support.** Store attestation only (recommended for Jan 5),
   or also build the §111.29 evidence workflow (document upload, 5-year retention) as a feature
   for brokers before May 6 2027?
4. **Public API:** OK to make the declaration required on `/send` from Jan 5 (breaking for
   integrators who don't update)? I recommend yes: CBP will reject without it anyway.
5. Do we want to file a comment on the IFR (deadline Jan 5 2027)? Optional.
6. Marketing may announce "supports CBP's U.S./foreign IOR declaration" once slice 5 passes on CERT.
   No claim that we verify CTPAT or IOR status.

**For our CBP client rep (Michael Barela / Karl Fischer)**
7. Will PROD reject or ignore a 15-record sent **before** the Jan 5 deploy, and at what time on
   Jan 5 does PROD switch?
8. Is the 15-record required on Delete (action D) and on PSC replacements?
9. Which CERT test importers / filers carry CTPAT validation, so we can exercise 894 and the
   happy paths deterministically?
