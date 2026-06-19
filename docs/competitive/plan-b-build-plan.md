# Plan B — Closing the validated competitive gaps

> Source: two deep-research passes on the US customs filing landscape (Descartes, Magaya/ACELYNK,
> CargoWise, NetCHB, eezyimport, CustomsCity). This plan turns the **four validated P0 gaps** into a
> phased, codebase-grounded build plan. Status: **plan, not yet built.** Dollar figures are competitor
> benchmarks, not commitments.

## The four gaps (evidence-backed)

| # | Gap | Why it matters | Evidence |
|---|-----|----------------|----------|
| 1 | **No open API (XML/JSON)** | Brokers/3PLs + ERP-integrated importers expect it; ACELYNK markets exactly this. Biggest broker-segment blocker. | ACELYNK open XML/JSON API (magaya.com) |
| 2 | **Thin ABI suite** (only ISF + 7501 + 3461) | Brokers can't standardize on us without In-Bond/FTZ/Drawback/AES. ACELYNK + NetCHB are certified far wider. | CBP ABI Vendors List |
| 3 | **Price premium in self-filer lane** | eezyimport: $18 ISF / ~$113 ISF+Entry vs our $45 / $180. We're the expensive option for DIY self-filers. | eezyimport.com/pricing |
| 4 | **Single-gateway dependency (CustomsCity)** | Our ACE path runs through CustomsCity, who *also* sells ABI directly to our buyers — disintermediation + margin risk. | customscity.com/abi-pricing |

## Current architecture (what we build on)
- **ISF** filing: `server/src/routes/filings.ts` → `services/customscity.ts` (`ccClient.createDocument`/`sendDocument`).
- **ABI Entry (7501/3461)**: `server/src/routes/abiDocuments.ts` → `services/abiDocumentMapper.ts` → `services/customscity.ts`.
- **Auth**: JWT (`middleware/auth.ts`); capability gating (`middleware/requireCapability.ts`, `config/plans.ts`).
- **Billing**: per-filing metered Stripe (`services/shipmentBilling.ts`), tiers in `config/plans.ts`.
- **No public/customer API; CustomsCity is the only ABI gateway.**

## Guiding principles
1. **Reuse the service layer.** The public API and every new ABI type call the *same* internal services as the app UI — never a parallel path.
2. **Every new ABI message type is a capability** (extends `CAPABILITIES` + tier matrix) and is **API-exposable** the moment it ships.
3. **Abstract the gateway once** (gap 4) so each new message type (gap 2) is written against an interface, not CustomsCity directly.
4. **Sequence by leverage ÷ effort**, and start the long-lead external dependency (CBP certification) early.

---

## Phase 0 — Quick wins (days, no external deps)

### 0a. Pricing answer to eezyimport  ⟶ **business decision required**
Infra already supports this (`config/plans.ts` tiers + Stripe + `stripe:bootstrap`). Options (not mutually exclusive):
- **A — Justify the premium (do immediately, ~free):** a public comparison/"why $45" page leaning on AI pre-flight + rejection-coach + inbox UX (things eezyimport lacks). Pure marketing/landing.
- **B — Add a self-serve "ISF Lite" entry point** nearer eezyimport ($18) — e.g. a `$25` ISF-only DIY tier — to stop losing price-sensitive self-filers at the top of funnel.
- **C — Add a volume/subscription plan** (mirrors CustomsCity's $49→$1,999/mo tiers) for high-volume self-filers + brokers, since per-filing $45×N doesn't scale for them.
- **Recommendation:** ship **A** now; decide **B vs C** based on which segment you prioritize. *This is a revenue call — needs your input before I touch `plans.ts`.*

### 0b. Gateway-abstraction groundwork (enables Phase 2 + gap 4)
Introduce `server/src/services/abi/AbiGateway.ts` — an interface (`createDocument`, `sendDocument`, `pollStatus`, `manifestQuery`, …) with `CustomsCityGateway` as the first implementation wrapping today's `customscity.ts`. Point `filings.ts` + `abiDocuments.ts` at the interface. **No behavior change**, but every later message type and a future second gateway plug in here. Small, high-leverage refactor.

### 0c. CBP certification discovery (long-lead — start now)
Confirm with CustomsCity which ABI message types their gateway already supports (In-Bond, FTZ, Drawback, AES, Type 86, Reconciliation) and the CBP certification path/lead time per type. **This gates Phase 2 timelines** — kick it off in parallel with everything else.

---

## Phase 1 — Open API (the highest-leverage gap)  ⟶ largest single build, no external deps

Greenfield: there is no customer-facing API today. Deliver a versioned, key-authenticated public API that exposes our existing filing capabilities so brokers/3PLs/ERPs integrate.

1. **`ApiKey` model + issuance** (`schema.prisma`): `id, orgId, name, hashedKey, prefix, scopes[], lastUsedAt, createdBy, revokedAt`. Keys shown once, stored hashed (SHA-256, like `passwordSetupToken`). Issuance UI on the existing **API Settings** page (`src/pages/IntegrationsApi.tsx`) — owner/admin only.
2. **API-key auth middleware** (`middleware/apiKeyAuth.ts`): resolve `Authorization: Bearer mcl_live_…` → org + scopes, set `req.apiContext`. Reuse `getOrgEntitlements` so the API respects the org's tier/capabilities exactly like the UI.
3. **Public mount** `app.use('/api/public/v1', publicApiRouter)` — versioned, separate from the JWT-auth app routes. Resources: `POST/GET /isf`, `/isf/:id/submit`, `/entries` (7501/3461), `/entries/:id/send`, `/shipments`, `/status`. Each handler calls the **same internal services** (`filings`, `abiDocuments`) under the API-key org context.
4. **JSON-native + XML** via content negotiation (`Accept`/`Content-Type: application/xml`) — JSON is native; add an XML (de)serializer layer so we match ACELYNK's "XML and JSON" claim.
5. **Status webhooks**: let integrators register a callback URL; emit on filing accepted/rejected/status-change (reuse the notification pipeline).
6. **Rate limiting** (per API key) + **idempotency keys** on create/submit (we already use idempotency in `shipmentBilling`).
7. **OpenAPI 3 spec + hosted docs + sandbox** (test-mode keys → CustomsCity sandbox). Billing: metered per filing exactly as the UI (same `shipmentBilling`).
8. **Capability-gated**: API can only file what the org's tier unlocks.

**Validation gate:** a broker integrates an ISF + Entry end-to-end via API in sandbox, in both JSON and XML, billed correctly.

---

## Phase 2 — ABI suite breadth  ⟶ longest pole; gated by Phase 0c (cert) + 0b (gateway interface)

Each message type follows a **repeatable pattern** (so this becomes assembly-line work):
1. Prisma model (or extend `AbiDocument`) + migration.
2. Capability key in `CAPABILITIES` + tier matrix (`config/plans.ts`) + Stripe price if separately billed.
3. Mapper (`services/abi/…Mapper.ts`) → gateway payload (via the Phase 0b interface).
4. Gateway support confirmed + **CBP certification** for that function (external).
5. Wizard UI + capability-gated nav/route (mirrors `ABIDocumentWizard`).
6. **Expose via the Phase 1 public API** the moment it ships.

**Suggested sequence (by demand × effort — confirm with sales/customers):**
- **2a. Type 86** (de-minimis e-commerce entry) — very high volume, simpler than full 7501; likely top demand.
- **2b. In-Bond (7512)** — common broker need; pairs with Entry.
- **2c. FTZ (e214)** — opens FTZ/CFS operators (a segment ACELYNK explicitly courts).
- **2d. Drawback** — higher complexity, fewer filers, but a differentiator.
- **2e. AES export filing** — export-side; distinct flow/data model; do last unless export demand surfaces.
- **2f. Reconciliation / eManifest** — round out broker parity.

**Reality check:** each type carries CBP cert lead time and gateway dependency — this phase is **quarters, not weeks**, and should be demand-driven (build 2a/2b first, prove pull, then continue).

---

## Phase 3 — De-risk the CustomsCity dependency  ⟶ medium; partly delivered by 0b

1. The `AbiGateway` interface (0b) already decouples code from CustomsCity.
2. **Add a second path**: either a second CBP-approved gateway implementation, or evaluate **direct ACE connectivity** (removes the middleman + margin, but adds cert/ops burden — a build-vs-buy decision).
3. **Contractual posture** with CustomsCity (pricing protection, data ownership, no-compete-for-our-customers terms where possible) — non-engineering, but do it.
4. Config-select the active gateway per environment/org.

---

## Sequencing & dependencies
```
Phase 0a (pricing)      ── independent ── ship now (needs your pricing call)
Phase 0b (gateway iface)── enables Phase 2 & 3 ── small refactor, do now
Phase 0c (cert discovery)── long lead ── start now, gates Phase 2
Phase 1 (Open API)      ── independent of suite breadth ── start in parallel (biggest build)
Phase 2 (ABI suite)     ── needs 0b + 0c; each type exposed via Phase 1 API
Phase 3 (de-risk)       ── 0b done; finish opportunistically while doing Phase 2
```

## Decisions needed from you
1. **Pricing strategy (0a):** ship the "justify premium" page now? add an ISF-Lite cheap tier (B) and/or a volume/subscription plan (C)? Which segment wins?
2. **ABI message-type priority (Phase 2):** confirm the 2a→2f order against real customer/sales demand.
3. **CBP cert ownership:** who drives certification with CustomsCity/CBP (lead time + cost owner)?
4. **Gateway strategy (Phase 3):** second gateway vs. direct-ACE — build-vs-buy appetite?

## Risks
- **Phase 2 is long and externally gated** (CBP cert + CustomsCity support) — don't over-promise broker parity on a short timeline.
- **eezyimport price gap** is structural; if we won't match $18, the AI/UX value story must be airtight.
- **CustomsCity is supplier + competitor** — moving fast on the API/suite while single-sourced on the gateway is the core tension this plan manages (0b + Phase 3).
- **Competitor reviews still unverified** — don't anchor GTM on assumed incumbent weakness (only CargoWise has confirmed poor reviews).
