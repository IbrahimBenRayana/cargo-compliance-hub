# CATAIR spec library

Downloaded manually from https://www.cbp.gov/trade/ace/catair on **2026-08-04**
(CBP.gov blocks automated fetches). Cross-check revisions against client rep
T. Morishita's answer to our Aug 4 versions question before Phase 1 coding.

## Certification-critical (Phases 1–3)

| File | Chapter | Used for |
|---|---|---|
| `core/abi-automation-requirements-2022.pdf` | ABI Automation Requirements (2022) | Getting-started/onboarding requirements |
| `core/batch-block-control-v23-2023-06.pdf` | ABI Batch & Block Control V23 | Envelope builder (A/B…Y/Z records, scenario tag @ B-rec pos 60) |
| `entry-summary/ae-ax-create-update-2026-07.pdf` | **Entry Summary Create/Update (AE/AX), Jul 2026** | The core spec — all 89 scenarios |
| `entry-summary/appendix-b-valid-codes-2026-07.pdf` | Appendix B — Valid Codes, Jul 2026 | Validation rules engine + response parsing |
| `entry-summary/uc-status-notification-v30-2025-06.pdf` | ES Status Notification (UC) V30 | Scenario 062; inbound processor |
| `entry-summary/es-query-v26-2026-05.pdf` | Entry Summary Query V26 | Scenario 050 |
| `entry-summary/tib-x1-rev03-2018.pdf` + `tib-xa-e0-rev05-2018.pdf` | TIB (X1 / XA-E0) | Scenarios 079–080 |
| `cargo-release/cargo-release-guide-v40-2025-07.pdf` | Cargo Release (SE) V40 | Type 86, cargo-release certification (061) |
| `cargo-release/so-status-notification-v36-2025-09.pdf` | Cargo Release Status Notification (SO) V36 | Release/hold lifecycle |
| `census/cw-census-warning-override.pdf` | Census Warning Override (CW) | Scenarios 005–006, 022 |
| `census/cj-census-warning-query.pdf` | Census Warning Query (CJ) | Scenario 021 |
| `queries/ad-cvd-case-query-2026-07.pdf` | AD/CVD Case Info Query, Jul 2026 | Scenarios 063–064; deposit rates for duty engine |
| `queries/qa-quota-query-2015-04.pdf` | Quota Query (QA) | Scenario 066 |
| `statements/daily-statement.pdf`, `statements/periodic-monthly-statement.pdf`, `statements/statement-update-ig-2025-04.pdf`, `statements/statement-request-reroute-mo-mq-2017-08.pdf`, `statements/ach-debit-authorization-rev6.pdf` | Statement chapters | Scenario 082; "all summaries on statement" rule; Phase 5 payments |
| `reference-data/currency-exchange-rates.pdf` + `currency-exchange-rates-update-v3.pdf` | Currency Exchange Rates (%R) | Scenario 045; duty engine |
| `reference-data/hts-query-2023-03.pdf` | HTS Query | Duty engine reference data |
| `queries/mid-create-v3-2023-03.pdf`, `queries/manufacturer-file-query.pdf` | MID create/query | MID fields (scenarios 049, 076, 078) |
| `queries/importer-query-v7.pdf`, `reference-data/importer-5106-create-update-v12.pdf` | Importer query / 5106 | IOR data, bond-on-file checks |
| `queries/cargo-manifest-entry-release-query-v21-2025-09.pdf` | Cargo Manifest/Entry Release Query V21 | Native replacement for CC manifest query |
| `queries/pga-query.pdf`, `pga/dis-xml-implementation-guide-2026-04.pdf` | PGA Query / DIS | PGA groundwork (see gaps) |
| `bonds/*` | eBond CB/CX + BS, surety downloads (AS/AQ) | Bond validation; surety data |

## Later phases / reference (`related/`)

In-Bond v51 Apr 2026 (**unblocks the Plan B in-bond phase post-independence**),
FTZ v3.1.2, Drawback TFTEA V27, Reconciliation V12, Duty Deferral v6,
ISF v3 + ISF SA (ISF follow-on certification), eCERT query, Courtesy Notice,
Broker Download, Line Release, GBI ×3, CATAIR change records,
`reference-data/ace-extract-reference-2018-06.pdf`.

## Known gaps (chase via client rep)

1. ~~PGA Message Set implementation guide~~ **DOWNLOADED Aug 10 2026**:
   `pga/pga-message-set-2026-07.pdf` + `pga/fda-supplemental-guide-v2.6.pdf`.
   Still missing: the **DOT/NHTSA supplemental guide** (HS-7 data elements)
   if the Message Set chapter does not embed them — needed for scenario 085.
2. **"Introduction and Getting Started"** — named as required reading by the
   test doc; the 2022 Automation Requirements chapter appears to be its
   successor. Confirm with Morishita.
3. Quota Query is dated 2015 and TIB 2018 — confirm still current.

Next step (Phase 1): extract record layouts from `core/` + `entry-summary/`
into machine-readable defs under `record-defs/`.
