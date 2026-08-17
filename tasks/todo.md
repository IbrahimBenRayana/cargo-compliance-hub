# Task List — Competitive-Gap Closure

> Companion checklist to `tasks/plan.md` (2026-08-17 audit). Order = dependency order.
> Standing rule: staging freeze until the 2026-08-18 demo is done (doc-only tasks exempt).

> **2026-08-17 directive:** native-engine only for all new capabilities; CC frozen at
> current scope. 0.1 cancelled. Phase 2 items route straight to native schema/builders.

## Phase 0 — Truth & discovery
- [x] 0.1 ~~CustomsCity capability probe~~ — CANCELLED (native-only directive)
- [ ] 0.2 Marketing truth pass (PGA "partner agency" → screening language; sweep landing)
- [ ] 0.3 Pricing decision brief → **user decision on structure** (rates may stay TBD)
- [ ] 0.4 End-user-safe integration errors (Tracking env-var message admin-only + sweep)

### Checkpoint 0
- [ ] CC matrix complete, pricing structure chosen, no overclaims live

## Phase 1 — Filer quick wins (internal only)
- [x] 1.1 Duty estimate endpoint (`POST /abi-documents/:id/estimate-duty`, reuses abi-engine/duty) — DONE 2026-08-17, 10 unit tests, live-verified
- [x] 1.2 Duty statement card on entry Review step (+ total in transmit confirm) — DONE 2026-08-17, browser-verified ($387.14 fixture entry)
- [ ] 1.3 Org filer settings: entry-number block (schema + settings UI + atomic draw)
- [ ] 1.4 Entry-number auto-draw + check-digit validation in wizard Step 1
- [ ] 1.5 7501-format PDF (`GET /abi-documents/:id/pdf`, DRAFT watermark, org-scoped)
- [ ] 1.6 Bulk line import — parser + endpoint (CSV/XLSX, per-row errors, caps, injection-safe)
- [ ] 1.7 Bulk line import — wizard UI (template, preview, import-valid, export-errors)

### Checkpoint 1
- [ ] E2E story: auto entry # → bulk lines → duty statement → transmit → 7501 PDF
- [ ] `tsc --noEmit -p tsconfig.app.json` + server `tsconfig.build.json` + full vitest green; staging verified

## Phase 2 — Filing correctness (routes per 0.1 matrix; CC-blocked items → native Phase-5 scope)
- [ ] 2.1 Related-party Y — schema + mapper (+ regression: N unchanged)
- [ ] 2.2 Related-party — wizard UI (conditional fields, Review flag)
- [ ] 2.3 Multi-HTS lines (ch.99 overlays) — schema + mapper + duty-estimate consumption
- [ ] 2.4 Multi-HTS — wizard UI + overlay suggestion (301/232/reciprocal from rateExpression)
- [ ] 2.5 Entry type 03 — schema + AD/CVD case block + "should be type 03" warning on 01
- [ ] 2.6 Entry type 03 — wizard UI (case autocomplete from addCvd data, deposit prefill)
- [ ] 2.7 Public API parity (new fields in /entries + webhooks + docs)

### Checkpoint 2
- [ ] "Hard entry" passes: related-party + CN 301 overlay + type 03 drafted, priced, transmitted/golden-filed
- [ ] Existing 01/11/86 flows regression-clean; CC-blocked items named in MIGRATION_PLAN Phase 5

## Phase 3 — Party master data & broker workflow
- [ ] 3.1 TradeParty model + CRUD (role tags, tax-ID validation, MID, audit-logged)
- [ ] 3.2 Party directory page (+ wizard "save this party" write-back)
- [ ] 3.3 Party autocomplete in ISF + entry wizards (role-filtered, fill-then-edit)
- [ ] 3.4 IOR registry with bond records (multi-IOR; bond prefill in entry Step 2)
- [ ] 3.5 Bond & POA expiry tracking (notification ladder + Records "Credentials" card)

### Checkpoint 3
- [ ] Broker-shaped org (3 IORs, 20 parties) files with zero re-keying
- [ ] Party CRUD exposed in public API

## Phase 4 — PGA filing (gated)
- [ ] 4.1 Vertical + route decision (FDA recommended; CC vs native per matrix)
- [ ] 4.2+ FDA vertical slice — EXPLODE after 4.1 (model → wizard step gated by pgaFlags → builder → parser → tests)

## Phase 5 — Pricing & packaging (gated on 0.3)
- [ ] 5.1 Volume lane in plans.ts + Stripe bootstrap + entitlements (grandfather existing orgs)
- [ ] 5.2 Pricing page + /upgrade update + visible broker contact lane

## Phase 6 — Security & ops (parallel track, start with Phase 1)
- [ ] 6.1 Dependabot: zero unaddressed highs (fix or documented risk-acceptance)
- [ ] 6.2 Security audit Phase B/C + new surfaces (upload parsing 1.6, org-scoped ids 1.5/3.1)
- [ ] 6.3 TLS: verify old-VPS ACME **before 2026-08-21** + external expiry alerts (21/14/7d)
- [ ] 6.4 TTFB root-cause with on-box evidence → fix or written infra decision (p95 < 1.5s target)

### Checkpoint 6 (rolling)
- [ ] No known-high vuln, no unwatched cert, TTFB explained

## Open questions (user)
- [ ] Pricing structure + broker rate (0.3)
- [ ] First PGA vertical confirmation (4.1)
- [ ] Type 03 posture if CC-blocked (show "coming" vs hide)
- [ ] Party API now vs on-demand (3.x)
- [ ] CDN acceptable if 6.4 blames provider network
