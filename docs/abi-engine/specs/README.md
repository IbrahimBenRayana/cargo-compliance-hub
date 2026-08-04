# CATAIR spec library

CBP.gov blocks automated downloads (both WebFetch and curl get a block page), so
these must be fetched **manually in a browser** and dropped into this directory.
Also: we asked client rep T. Morishita (Aug 4 email) to confirm which chapter
revisions to build against — reconcile this list with his answer before Phase 1.

Index page: https://www.cbp.gov/trade/ace/catair (chapters listed under
"ACE ABI CATAIR" — take the newest revision of each).

Required chapters (per the certification package):

| # | Chapter | Why | Suggested filename |
|---|---|---|---|
| 1 | Introduction and Getting Started | Required reading per test doc; envelope basics | `catair-intro.pdf` |
| 2 | ABI Batch & Block Control (A/B/Y/Z records) | Envelope builder; scenario tag @ B-rec pos 60 | `catair-batch-block-control.pdf` |
| 3 | Entry Summary Create/Update (AE/AX) — rev 106+ | Core of all 89 scenarios | `catair-ae-ax.pdf` |
| 4 | Entry Summary Filing and Response Scenarios | Worked examples for golden tests | `catair-ae-scenarios.pdf` |
| 5 | Census Warning Override/Query (CW/CJ) | Scenarios 005–006, 020–022 | `catair-cw-cj.pdf` |
| 6 | AD/CVD Case Information Query (AD) | Scenarios 063–064 | `catair-ad-query.pdf` |
| 7 | Quota Query (QA) | Scenario 066 | `catair-qa-query.pdf` |
| 8 | TIB Extension (TE) | Scenario 080 | `catair-te.pdf` |
| 9 | Entry Summary Status Notification (UC) | Scenario 062; inbound processing | `catair-uc.pdf` |
| 10 | Entry Summary Query | Scenario 050 | `catair-es-query.pdf` |
| 11 | Error/condition code appendices + Appendix B (valid codes) | Response parsing + validation rules engine | `catair-appendices/` |
| 12 | PGA Message Set (FDA, DOT) + disclaimers | Scenarios 083, 085–086 | `catair-pga.pdf` |
| 13 | Daily/Periodic Statement chapters | Scenario 082 + Phase 5 production | `catair-statements.pdf` |

After downloading, record each file's revision + date in this table, and extract
record layouts into machine-readable defs under `record-defs/` (Phase 1 task).
