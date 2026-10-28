# Implementation Plan: Competitive-Gap Closure ("Broker-Grade MyCargoLens")

> Source: full-platform audit of 2026-08-17 (code walk + live UI tour as the demo org).
> Goal: close every named functional, commercial, and security gap so the platform is
> credible to (a) related-party mid-market importers, (b) high-volume self-filers, and
> (c) brokers/3PLs — while keeping the current self-filer experience intact.

## Overview

Eleven gaps were identified. They fall into four families:

1. **Filing correctness** — related-party locked to "N", no entry type 03, single HTS
   per line (can't declare ch.99 / Section 301 overlays), no PGA filing.
2. **Filer workflow** — no duty statement at transmit, no printable 7501, hand-typed
   entry numbers, no bulk line import, no party/IOR master data, no bond/POA management.
3. **Commercial** — per-filing pricing with no public volume lane.
4. **Trust/ops** — marketing overclaims (PGA "partner agencies"), raw config errors
   shown to end users, open Dependabot highs, pending security-audit phases, TLS canary.

**Standing directive (2026-08-17, supersedes the CC-fork logic below):** the user is
done investing in CustomsCity. **Every new capability targets the native CATAIR
engine only** (`server/src/abi-engine/`, through the `abiGateway` seam). The engine
already models every family-1 concept (`AeTariff[]` per line, `AeAdCvdCase`, PGA
record builders, related-party header field). Existing CC-routed production flows
keep working untouched until cutover, but receive zero new capability work. Transmit
for new capabilities uses the native transport (mock loopback today; MQIPT once the
CBP SBD engineer establishes the connection). Task 0.1 (CC capability probe) is
**cancelled**. Families 2–4 have zero external dependencies and start immediately.

**Standing constraint:** demo on 2026-08-18. No staging pushes until the demo is done.
All work lands staging-first thereafter (per CLAUDE.md).

## Architecture Decisions

- **Never build a parallel path.** Every new capability goes through the existing
  service layer (`filingWrite`, `abiDocuments` routes, `abiGateway` seam) and is
  therefore public-API-exposable and capability-gateable on day one.
- **Schema is the contract.** Each filing-correctness item starts by extending
  `server/src/schemas/abiDocument.ts` (server = source of truth), then the app mirror
  in `src/api/client.ts`, then UI. Wizard steps only ever send their top-level slice.
- **The duty engine is reused, not duplicated.** Transmit-time duty display calls the
  existing `abi-engine/duty` engine through a thin estimate endpoint — no second
  implementation of MPF/HMF/301 math.
- **Entry numbers come from a configured block.** Org-level filer block + the engine's
  `computeEntryCheckDigit` replaces hand-typing. Manual override stays possible
  (brokers sometimes must re-use a drawn number).
- **Party data is a first-class model, not a template.** A `TradeParty` table with
  role tags (IOR / consignee / manufacturer / seller / buyer / ship-to), tax IDs, and
  MIDs feeds both wizards via autocomplete. Existing templates stay for whole-filing
  reuse; parties become reusable atoms.
- **Pricing changes are config, not code.** New tiers land in
  `server/src/config/plans.ts` (single source of truth) + Stripe bootstrap; the
  landing pricing page mirrors it. Rates are a business decision (open question) —
  the engineering task is rate-agnostic.

## Phase Map (dependency order)

```
Phase 0: Truth & discovery (CC probe, copy fixes, pricing brief)   ← starts now, 2–4 days
Phase 1: Filer quick wins (duty display, 7501 PDF, entry-# draw,
         bulk import)                                              ← internal only, parallelizable
Phase 2: Filing correctness (related-party, dual-HTS, type 03)     ← gated on Phase 0 findings
Phase 3: Party master data & broker workflow                       ← independent of Phase 2
Phase 4: PGA filing (FDA-first vertical slice)                     ← gated on Phase 0 + possibly native engine
Phase 5: Pricing & packaging                                       ← gated on pricing decision
Phase 6: Security & ops hardening                                  ← parallel track, starts with Phase 1
Native-engine certification continues per MIGRATION_PLAN.md — not re-planned here,
but Phases 2/4 explicitly feed its cutover scope.
```

Per the established working style: foundation/schema tasks run sequentially; UI and
independent slices fan out to parallel subagents once contracts are fixed.

---

## Phase 0 — Truth & discovery (no code risk, unblocks everything)

### Task 0.1: CustomsCity capability probe & matrix
**Description:** Determine, with sandbox evidence (not assumptions), what the CC ABI
Documents API accepts for: `relatedParties: "Y"` (and which extra fields it then
requires), entry type `03` + AD/CVD case fields, multiple HTS numbers per item
(ch.99 overlay codes), and any PGA message-set payloads. Probe the cert sandbox with
crafted payloads; where the sandbox is inconclusive, ask the CC contact directly.
**Acceptance criteria:**
- [ ] `docs/competitive/cc-capability-matrix.md` records supported / unsupported /
      unknown for each of the four items, with the sandbox request/response evidence
- [ ] Each unsupported item has a routing decision recorded: "wait for native engine"
      vs "escalate to CC"
**Verification:** Matrix reviewed by the user; decisions logged.
**Dependencies:** None. **Files:** docs only. **Scope:** S (external-facing).

### Task 0.2: Marketing truth pass
**Description:** Remove or soften claims the product can't yet honor: the landing
trust band lists FDA / USDA-APHIS / EPA / FCC as "PGA partner agency" while no PGA
filing exists in the wizard. Reword to compliance-screening language ("PGA flag
lookup") until Phase 4 ships. Sweep the rest of the landing copy for the same class
of claim (consistent with the standing "never claim live direct CBP" rule).
**Acceptance criteria:**
- [ ] `landing/components/sections/home/trust.tsx` (and any /platform/* page found by
      grep) no longer implies PGA *filing*
- [ ] No other capability claim exceeds what a signed-up user can actually do
**Verification:** landing typecheck + build; visual check of / and /platform pages.
**Dependencies:** None. **Files:** `landing/components/sections/home/trust.tsx`, grep hits. **Scope:** S.

### Task 0.3: Pricing decision brief (decision, not code)
**Description:** One-page brief with concrete options for a public volume lane:
(A) volume tiers (e.g. committed monthly bundles), (B) subscription + reduced
per-filing, (C) broker/enterprise contact-sales lane made visible. Include competitor
anchors already gathered in `docs/competitive/plan-b-build-plan.md` (eezyimport ~$18
ISF, CustomsCity $49–$1,999/mo). **Ends in a user decision — rates are not an
engineering call.**
**Acceptance criteria:**
- [ ] Brief written with revenue math at 5/20/100/500 filings/mo per option
- [ ] User has picked a structure (rates may still be TBD)
**Verification:** decision recorded in the brief. **Dependencies:** None. **Scope:** S.

### Task 0.4: End-user-safe integration errors
**Description:** The Tracking page renders "Set TERMINAL49_API_KEY in the server
environment" to end users when unconfigured. Config-level diagnostics must be
admin-only; end users get a friendly "not enabled for your workspace — contact
support" state. Sweep for the same pattern on other integration surfaces.
**Acceptance criteria:**
- [ ] Non-admin users never see env-var names or config instructions
- [ ] Admin/platform-admin still sees the actionable config hint
**Verification:** frontend typecheck; UI check both roles.
**Dependencies:** None. **Files:** `src/pages/TrackingPage.tsx` + grep hits. **Scope:** S.

### Checkpoint 0
- [ ] CC matrix exists with a routing decision per item
- [ ] Pricing structure chosen
- [ ] No overclaims live on the marketing site

---

## Phase 1 — Filer quick wins (all internal; parallelizable after 1.1's contract)

### Task 1.1: Duty estimate endpoint for entry drafts
**Description:** Server endpoint `POST /api/v1/abi-documents/:id/estimate-duty` that
maps the current draft payload into the existing `abi-engine/duty` engine
(`server/src/abi-engine/duty/engine.ts`) and returns line duty, MPF (min/max
applied), HMF (MOT/entry-type rules), 301/232/reciprocal overlay amounts where
derivable, and grand total. Pure reuse; returns a structured "unestimable: missing X"
list when the draft is incomplete.
**Acceptance criteria:**
- [ ] Endpoint returns duty/MPF/HMF/overlay/total for a complete draft
- [ ] Incomplete drafts return the missing-field list, not a 500
- [ ] Unit tests cover formal entry w/ HMF, informal, MPF min & max clamp
**Verification:** server vitest focused run; `tsc --noEmit -p tsconfig.build.json`.
**Dependencies:** None. **Files:** `server/src/routes/abiDocuments.ts`, new
`server/src/services/dutyEstimate.ts`, tests. **Scope:** M.

### Task 1.2: Duty statement on the entry Review step
**Description:** Wire Task 1.1 into `Step6Review.tsx`: a "Estimated duties & fees"
card (duty, MPF, HMF, overlays, total) beside the existing value/weight totals,
refreshed on step entry, with the "can't estimate yet — missing X" state. This is the
number a filer looks for before transmitting.
**Acceptance criteria:**
- [ ] Complete draft shows an itemized fee card on Review
- [ ] Incomplete draft shows what's missing instead of hiding the card
- [ ] Transmit confirm dialog repeats the total
**Verification:** frontend typecheck (`tsc --noEmit -p tsconfig.app.json`); manual
wizard walk with a seeded draft.
**Dependencies:** 1.1. **Files:** `src/components/abi-wizard/Step6Review.tsx`,
`src/api/client.ts`, hook. **Scope:** S–M.

### Task 1.3: Org filer settings — entry number block
**Description:** Org-level filer config: filer code + entry-number block ranges
(start/end/next pointer), editable in Settings (owner/admin), with an allocation
service that atomically draws the next number (Postgres row lock; the pattern in
`distributedLock.ts` is available if needed).
**Acceptance criteria:**
- [ ] Schema migration adds filer block table/fields; settings UI edits them
- [ ] Concurrent draws never issue the same number (test with parallel calls)
**Verification:** server tests incl. concurrency test; both typechecks.
**Dependencies:** None. **Files:** `server/prisma/schema.prisma`, migration,
`server/src/routes/settings.ts`, `src/pages/SettingsPage.tsx`, new service. **Scope:** M.

### Task 1.4: Entry number auto-draw in the wizard
**Description:** "Assign next entry number" in Step 1 of the entry wizard: draws from
the org block (1.3) and appends the check digit via the engine's
`computeEntryCheckDigit` (`server/src/abi-engine/ae/checkDigit.ts`). Manual entry
remains, now validated against the check digit with a fix-it hint.
**Acceptance criteria:**
- [ ] One click fills a valid formatted entry number; drawn numbers are marked used
- [ ] Hand-typed numbers with a bad check digit get an inline error + suggestion
**Verification:** frontend typecheck; unit test for the validation helper; wizard walk.
**Dependencies:** 1.3. **Files:** `src/components/abi-wizard/Step1EntryShipment.tsx`,
`server/src/routes/abiDocuments.ts`. **Scope:** S.

### Task 1.5: 7501-format PDF for entries
**Description:** `GET /api/v1/abi-documents/:id/pdf` rendering the accepted (or
draft, watermarked "DRAFT — not filed") entry in CBP Form 7501 layout: header blocks
1–42, line items with HTS/value/duty, fee summary from the duty engine, org branding.
pdfkit is already a dependency (`server/src/routes/export.ts` sets the pattern).
Download buttons on the entry detail page and list row menu.
**Acceptance criteria:**
- [ ] Accepted entry downloads a 7501-layout PDF with correct header + line + fee data
- [ ] Draft version watermarked; CANCELLED/REJECTED refuse politely
- [ ] Route is org-scoped (no cross-org id probing)
**Verification:** server test asserting PDF stream + key strings; manual visual check
against a real 7501. **Dependencies:** 1.1 (fee block). **Files:**
`server/src/routes/export.ts` or new `entryPdf.ts`, `src/pages/ABIDocumentDetailPage.tsx`.
**Scope:** M.

### Task 1.6: Bulk invoice-line import — parser + endpoint
**Description:** Server-side CSV/XLSX line-item import: published column template
(SKU, HTS, description, origin, value, currency, qty, weight, UOM…), parse + row-level
validation against `abiItemSchema`, returning per-row errors keyed to the sheet's row
numbers. Endpoint stages rows into the draft's invoice.
**Acceptance criteria:**
- [ ] Valid file → items appended to the target invoice in one call
- [ ] Mixed file → valid rows staged, invalid rows returned with row# + field + message
- [ ] 10 MB / 1,000-row limits enforced; formula-injection-safe (mirror export.ts defence)
**Verification:** server vitest with fixture files; build typecheck.
**Dependencies:** None. **Files:** new `server/src/services/lineImport.ts`, route,
tests + fixtures. **Scope:** M.

### Task 1.7: Bulk invoice-line import — wizard UI
**Description:** "Import lines" in Step 5 (Invoices): template download, drop-zone
upload, preview table with per-row validation states, "import N valid rows" action,
error rows exportable for fixing. Card-per-item editing stays for touch-ups.
**Acceptance criteria:**
- [ ] 80-line spreadsheet lands in a draft in under a minute of user effort
- [ ] Invalid rows are visibly actionable, never silently dropped
**Verification:** frontend typecheck; manual walk with fixture sheets.
**Dependencies:** 1.6. **Files:** `src/components/abi-wizard/Step5Invoices.tsx` +
new import dialog component. **Scope:** M.

### Checkpoint 1
- [ ] Full entry flow: auto-drawn entry #, bulk-imported lines, duty statement on
      Review, transmitted, 7501 PDF downloaded — one continuous demo-able story
- [ ] Both typecheck configs + full server suite green; staging deploy verified

---

## Phase 2 — Filing correctness (routes per the Phase 0 matrix)

> Each task below has two landing spots: CC path now if the matrix says supported,
> otherwise schema+UI land behind the `abiGateway` seam flagged "native-engine only"
> and the item is added to MIGRATION_PLAN Phase 5 cutover scope. Either way, the
> data model and UI ship — only the transmit target differs.

### Task 2.1: Related-party transactions — schema + mapper
**Description:** Unlock `relatedParties` to `'Y' | 'N'` in
`server/src/schemas/abiDocument.ts`, model whatever additional fields the matrix
says CC requires (or the AE spec requires natively), thread through
`abiDocumentMapper.ts` / native builder, and mirror types in `src/api/client.ts`.
**Acceptance criteria:**
- [ ] A related-party draft validates and maps end-to-end (CC sandbox accept, or
      native golden-file test if CC-blocked)
- [ ] 'N' flow byte-identical to today (regression tests)
**Verification:** server vitest incl. golden files; build typecheck.
**Dependencies:** 0.1. **Files:** schema, mapper, `src/api/client.ts`, tests. **Scope:** M.

### Task 2.2: Related-party — wizard UI
**Description:** Enable the Related Parties select in Step 5, reveal conditional
fields when 'Y', explain the CBP meaning inline ("buyer and seller are related per
19 CFR 152.102(g) — affects valuation review, not admissibility").
**Acceptance criteria:**
- [ ] 'Y' selectable; conditional fields validate; Review step surfaces the flag
**Verification:** frontend typecheck; wizard walk both values.
**Dependencies:** 2.1. **Files:** `src/components/abi-wizard/Step5Invoices.tsx`,
validators. **Scope:** S.

### Task 2.3: Multi-HTS lines (ch.99 overlays) — schema + mapper
**Description:** Item schema gains `additionalHtsNumbers: string[]` (ordered, ch.99
first per CBP convention). Mapper emits per gateway capability; native `AeTariff[]`
already supports it. Duty estimate (1.1) consumes overlays for 301/232/reciprocal
amounts.
**Acceptance criteria:**
- [ ] Item with 9903.88.15 + base 10-digit validates, maps, and prices correctly in
      the estimate
- [ ] Single-HTS items unchanged (regression)
**Verification:** server vitest; golden-file test on native path.
**Dependencies:** 0.1, 1.1. **Files:** schema, mapper, duty estimate service, tests.
**Scope:** M.

### Task 2.4: Multi-HTS lines — wizard UI + suggestion
**Description:** "Add ch.99 / overlay code" affordance on each item; when origin +
HTS match a known 301/232/reciprocal overlay (the duty engine's
`rateExpression.ts` knowledge), suggest the overlay code with an accept button
rather than requiring the user to know it.
**Acceptance criteria:**
- [ ] User can add/remove overlay codes per item; suggestions appear for CN-origin
      301-covered HTS and are one-click accepted
- [ ] Review step lists overlay codes under each line
**Verification:** frontend typecheck; wizard walk with a 301-covered HTS.
**Dependencies:** 2.3. **Files:** Step5Invoices, new suggestion hook/endpoint. **Scope:** M.

### Task 2.5: Entry type 03 (ADD/CVD) — schema + mapper
**Description:** Add `'03'` to `entryType`; per-item AD/CVD case block (10-digit case
number, bond/cash claim, deposit rate, case duty) mirroring the engine's
`AeAdCvdCase`. Validation: type 03 requires ≥1 case; case duty feeds the estimate.
Cross-link: the Compliance ADD/CVD lookup (`services/compliance/addCvd.ts`) provides
case-number autocomplete data.
**Acceptance criteria:**
- [ ] Type 03 draft with case fields validates + maps (CC or native per matrix)
- [ ] Type 01 with a flagged ADD/CVD HTS warns "this likely requires type 03" (uses
      existing addCvd data)
**Verification:** server vitest; build typecheck.
**Dependencies:** 0.1, 2.3. **Files:** schema, mapper, addCvd service, tests. **Scope:** M.

### Task 2.6: Entry type 03 — wizard UI
**Description:** Entry-type option, per-item case entry with autocomplete from the
ADD/CVD dataset, deposit-rate prefill from the case record, Review-step case summary,
and the type-01-warning banner surfaced during editing (not just at review).
**Acceptance criteria:**
- [ ] Full type 03 wizard walk possible; case autocomplete works; estimate includes
      AD/CVD deposits
**Verification:** frontend typecheck; wizard walk.
**Dependencies:** 2.5. **Files:** Step1EntryShipment, Step5Invoices, Step6Review. **Scope:** M.

### Task 2.7: Public API parity for Phase 2
**Description:** Expose related-party, overlay codes, and type 03 through
`/api/public/v1/entries` (same schemas — should be near-automatic; verify + document
+ webhook payloads include the new fields).
**Acceptance criteria:**
- [ ] API round-trips all new fields; OpenAPI/docs updated; scope checks unchanged
**Verification:** API integration tests. **Dependencies:** 2.1, 2.3, 2.5.
**Files:** `server/src/routes/publicApi.ts`, docs. **Scope:** S.

### Checkpoint 2
- [ ] A related-party, CN-origin, 301-overlaid, ADD/CVD type-03 entry can be drafted,
      priced, and transmitted (or golden-filed if CC-blocked) — the "hard entry" test
- [ ] Regression: existing type 01/11/86 flows untouched (full suite green)
- [ ] CC-blocked items are listed in MIGRATION_PLAN Phase 5 scope by name

---

## Phase 3 — Party master data & broker workflow (independent of Phase 2)

### Task 3.1: TradeParty model + CRUD
**Description:** `TradeParty` table: org-scoped, role tags (ior/consignee/buyer/
seller/manufacturer/ship-to — multi-tag), name/address, tax IDs (EIN/SSN/CBP-assigned,
validated with the existing `CC_TAXID_PATTERN`), MID, notes, archivedAt. CRUD routes +
audit-logged writes.
**Acceptance criteria:**
- [ ] CRUD with role filtering + search; org-scoped; audit-logged
- [ ] MID validated with the engine's MID derivation logic where derivable
**Verification:** server vitest; build typecheck.
**Dependencies:** None. **Files:** schema.prisma + migration, new route + service,
tests. **Scope:** M.

### Task 3.2: Party directory UI
**Description:** A "Parties" page (Account group in the sidebar): list with role
chips, search, create/edit drawer, archive. Includes "save this party" prompts after
manual entry in either wizard (write-back).
**Acceptance criteria:**
- [ ] Full CRUD from the UI; parties created in wizards appear here
**Verification:** frontend typecheck; UI walk.
**Dependencies:** 3.1. **Files:** new `src/pages/PartiesPage.tsx`, AppSidebar, wizard
save-prompts. **Scope:** M.

### Task 3.3: Party autocomplete in both wizards
**Description:** Replace bare party field groups in the ISF wizard (IOR, consignee,
buyer, seller, ship-to, manufacturer) and entry wizard (IOR, consignee, item parties)
with a combobox over the directory (role-filtered) that fills the group and stays
editable. Manual entry always possible.
**Acceptance criteria:**
- [ ] Selecting a saved party fills every mapped field in <1s; editing after
      selection doesn't mutate the directory record
**Verification:** frontend typecheck; wizard walks (ISF-10, ISF-5, entry).
**Dependencies:** 3.1. **Files:** `src/pages/ShipmentWizard.tsx`,
`src/components/abi-wizard/*`, shared combobox component. **Scope:** M–L (split per
wizard if it grows: 3.3a ISF, 3.3b entry).

### Task 3.4: IOR registry with bond records
**Description:** Extend IOR-tagged parties with bond data: continuous bond number,
surety code, effective/expiry dates, bond type; entry wizard Step 2 prefills bond
fields from the selected IOR. This is the seed of multi-IOR (broker) support.
**Acceptance criteria:**
- [ ] IOR selection prefills bond block in the entry wizard; multiple IORs per org
      work end-to-end
**Verification:** server + frontend typechecks; wizard walk with 2 IORs.
**Dependencies:** 3.1, 3.3. **Files:** schema (bond fields), Step2ImporterBond,
party service. **Scope:** M.

### Task 3.5: Bond & POA expiry tracking
**Description:** Notification kinds `bond_expiring` / `poa_expiring` (30/14/3-day
ladder, reusing the deadline-warning pattern in `services/notifications.ts`); POA
document per IOR using the existing uploads infra (`routes/documents.ts`) with an
expiry date; Compliance Records tab gains a "Credentials" card listing bond/POA
status per IOR.
**Acceptance criteria:**
- [ ] Expiring bond/POA produces notifications on the ladder; Records tab lists status
**Verification:** server vitest for the sweep job; UI check.
**Dependencies:** 3.4. **Files:** notifications service, backgroundJobs, RecordsTab.
**Scope:** M.

### Checkpoint 3
- [ ] A broker-shaped org (3 IORs, 20 saved parties) can file for any IOR without
      re-keying a single party or bond field
- [ ] Public API exposes party CRUD (add to 2.7 pattern) — brokers integrate their
      client masters

---

## Phase 4 — PGA filing (gated: Phase 0 matrix + vertical choice)

### Task 4.1: PGA vertical selection + route decision
**Description:** Pick the first agency vertical by customer evidence (default
recommendation: **FDA** — largest overlap with e-commerce/food/cosmetics importers).
Confirm from the matrix whether CC can carry PG message sets; if not, PGA becomes a
native-engine-only capability and marketing stays at "screening" until cutover.
**Acceptance criteria:**
- [ ] Written decision: agency, gateway route, and go/no-go for CC-era shipping
**Dependencies:** 0.1. **Scope:** S (decision doc).

### Task 4.2+: FDA message-set vertical slice (schema → builder → wizard → tests)
**Description:** Placeholder to be exploded after 4.1 — the engine's
`abi-engine/pga/` builders are the foundation. Break into: line-level PGA data model;
wizard "PGA" step shown only when an item's HTS carries an FDA flag (the
`pgaFlags.ts` service already knows); builder/mapper; response parsing; tests.
**Do not start before 4.1 resolves** — the task breakdown differs materially by route.
**Scope:** L → will be split into 4–6 S/M tasks.

---

## Phase 5 — Pricing & packaging (gated on Task 0.3 decision)

### Task 5.1: Volume lane in plans.ts + Stripe
**Description:** Implement the chosen structure in `server/src/config/plans.ts`
(single source of truth), Stripe bootstrap script, entitlement sync, and the app
mirror `src/lib/planMeta.ts`. Grandfathering: existing card-on-file orgs unaffected.
**Acceptance criteria:**
- [ ] New tier(s) purchasable end-to-end in staging test mode; per-filing billing
      logic honors the tier's rate/bundle rules idempotently
**Verification:** billing service tests; staging Stripe test-mode walk.
**Dependencies:** 0.3. **Files:** plans.ts, planMeta.ts, stripe bootstrap,
shipmentBilling tests. **Scope:** M.

### Task 5.2: Pricing page + upgrade flow update
**Description:** Landing pricing page and in-app `/upgrade` reflect the new lane;
visible "Brokers & 3PLs — volume pricing" contact lane (the private `enterprise`
tier stops being invisible).
**Acceptance criteria:**
- [ ] Landing + app pricing agree with plans.ts; broker lane has a CTA to
      /book-a-demo
**Verification:** landing build; UI walk.
**Dependencies:** 5.1. **Files:** `landing/app/pricing/*`, `src/pages/UpgradePage.tsx`.
**Scope:** S–M.

---

## Phase 6 — Security & ops hardening (parallel track; start alongside Phase 1)

### Task 6.1: Dependabot triage & remediation
**Description:** Triage the ~30 high / 18 moderate findings on the default branch;
upgrade or pin; document accepted risks with justification.
**Acceptance criteria:**
- [ ] Zero unaddressed highs (fixed or explicitly risk-accepted in docs/security/)
**Verification:** Dependabot dashboard; full test suites after bumps. **Scope:** M.

### Task 6.2: Security audit Phase B/C completion
**Description:** Execute the pending Phase B/C items from
`docs/security/pre-production-audit-2026-07-02.md` plus the live checks that were
deferred. Add the new Phase 1–3 surfaces (line import upload, PDF route, party CRUD,
filer-block settings) to the checklist explicitly — file upload parsing (1.6) and
org-scoped id access (1.5, 3.1) are the two highest-risk additions.
**Acceptance criteria:**
- [ ] Every Phase B/C item closed or ticketed with owner; new surfaces reviewed
**Verification:** audit doc updated with dated results. **Scope:** M–L (split per
audit section when executing).

### Task 6.3: TLS canary + external monitoring
**Description:** Verify the old-VPS ACME account before 2026-08-21 (standing canary:
if mycargolens.com's cert hasn't advanced past Sep 20 by Aug 21, the account is
broken — same failure mode as the Aug 4 outage). Add external TLS-expiry monitoring
so deploy health gates stop being blind to public TLS.
**Acceptance criteria:**
- [ ] ACME account verified/repaired on both VPSes; an external check alerts at
      21/14/7 days before any cert expiry
**Verification:** forced dry-run renewal; alert test. **Scope:** S (needs SSH).

### Task 6.4: TTFB root-cause
**Description:** The 1–13s variable TTFB affects all three hosts (ruled out: SSR,
DB, single-server). Investigate on-box: nginx accept queues, conntrack, upstream
DNS, provider network. Fix or document the infra decision (e.g. move/front with CDN).
**Acceptance criteria:**
- [ ] Root cause identified with evidence; p95 TTFB < 1.5s on landing + app, or a
      written infra migration decision
**Verification:** repeated external curl timing runs. **Scope:** M (needs SSH).

### Checkpoint 6 (rolling)
- [ ] No known-high vulnerability, no expiring cert unwatched, TTFB explained

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CC gateway can't carry related-party / type 03 / multi-HTS / PGA | High — blocks Phase 2/4 CC-era shipping | Phase 0 probe first; every blocked item lands in native-engine Phase-5 scope by name; schema+UI ship regardless so cutover is transmit-only |
| CBP certification timeline slips (native engine) | High for CC-blocked items | Keep CC path fully working; certification effort already sequenced in MIGRATION_PLAN; don't couple Phase 1/3/5/6 to it |
| Duty estimate diverges from CBP's computation | Med — trust damage | Label as estimate; golden-file tests against the 89-scenario cert package; show engine version in the UI tooltip |
| Pricing migration breaks existing card-on-file orgs | High | Grandfather existing subscriptions; staging Stripe test-mode walk before prod; plans.ts is the single source of truth |
| Bulk import becomes a data-quality hole | Med | Row-level schema validation (same zod), hard caps, formula-injection defence, never silent-drop |
| Scope creep ("perfect") stalls shipping | High | Checkpoints gate phases; each phase independently demo-able; user reviews at every checkpoint |
| Demo 2026-08-18 destabilized | High | Staging freeze until post-demo; Phase 0 doc-only tasks are safe to start today |

## Open Questions (need user input)

1. **Pricing structure + rates** (Task 0.3): volume tiers vs subscription-hybrid vs
   both? Target broker rate per entry?
2. **First PGA vertical** (Task 4.1): FDA (recommended) — confirm against actual
   pipeline/prospect evidence?
3. **Type 03 posture if CC-blocked**: ship schema+UI with "coming with native
   engine" messaging, or hide entirely until cutover?
4. **Party directory in public API** at Phase 3 or defer to broker-onboarding
   demand?
5. **CDN in front of landing/app** if 6.4 points at provider network — acceptable?

## Parallelization Map

- **Sequential spine:** 0.1 → (2.1 → 2.2), (2.3 → 2.4) → (2.5 → 2.6) → 2.7; 1.3 → 1.4; 1.6 → 1.7; 3.1 → {3.2, 3.3} → 3.4 → 3.5
- **Parallel-safe from day one:** 0.2, 0.3, 0.4, 1.1→1.2, 1.5, 6.1, 6.3
- **Contract-first fan-out:** once 1.1's response shape and 3.1's TradeParty model
  are fixed, UI tasks fan out to subagents (matches the established modular
  workflow: foundation sequential, implementation parallel)
