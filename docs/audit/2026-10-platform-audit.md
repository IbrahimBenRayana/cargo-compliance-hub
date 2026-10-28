# Platform Audit, October 2026

> 11 auditors covered backend, engine, multi-HTS, capabilities, frontend, three UI/visual passes and the
> landing site, each followed by a skeptical verifier (2026-10-15/16). 237 findings survived:
> **19 critical, 102 high, 94 medium, 22 low**. Two dimensions (backend native alignment, multi-HTS) lost
> their verifier to a session limit, so their findings are marked `unverified` in the JSON.
> Full detail per finding (evidence, file:line, fix): `2026-10-platform-audit.findings.json`.

## Executive summary

The native engine is strong: it is certified and well tested, and Phase 0 now keeps CERT and PROD apart.
The **product around it is still a CustomsCity client**. It assumes CC's create, send and poll flow. It
stores CC payload shapes, shows CC errors and statuses, and offers controls whose codes are wrong for CBP.
Switching the gateway alone would file wrong data. The ten things that matter most:

1. **Filer identity is user-controlled** (BNA-01, FNA-04). Any tenant can type any filer code, including
   S7P, onto our service-center queue. This has to be bound to org config before anything goes native.
2. **Wrong CBP codes in the entry wizard** (FNA-01/02, UFF-02/03). The mode-of-transport labels
   contradict CATAIR ("31, Air" actually files Truck), the payment-type labels are wrong, and the port
   picker uses CC's 5-digit list. These would produce wrong legal filings.
3. **Foreign-currency invoices go out as US dollars** (BNA-04, ENG-02). There is no FX conversion
   anywhere.
4. **Type 86 is dead at CBP** (ENG-08, CAP-01, FNA-06, LND-01). ACE has rejected every Type 86 since
   2025-08-29, yet the product and the landing site sell it, and the wizard disables Type 11, its
   replacement.
5. **FY2027 user fees took effect 2026-10-01** (ENG-01). The fee tables stop at FY2026, so every duty
   estimate is already off.
6. **ISF data integrity** (BNA-05, ENG-06/07, UFF-01, FNA-05/15). The native mapper invents party
   addresses. Editing an ISF truncates it to one commodity and one container and autosaves that. Master-only
   bills are filed as house bills, and single-transaction bonds cannot be filed.
7. **No lifecycle after transmit** (BNA-02/03, CAP-04, FNA-11/12). ISF replace and delete, and entry
   replace, delete and PSC, are certified in the engine but not modelled in the product. A rejected entry
   is a dead end.
8. **Ch.99 duty math is wrong** (ENG-03, MHT-01/02/03). Every ch.99 number is priced as an add-on, but
   plain-rate headings replace column 1. Exemption headings crash the engine. The uncommitted WIP gives
   overlays a unit of measure, which CERT proved wrong.
9. **Recordkeeping and backups** (BPR-01/02). Nothing guarantees 5-year, immutable, restore-tested
   storage of CBP records, which is a legal obligation for a filer.
10. **Truth in copy** (LND-03/04/05, FPR-07, BPR-12). The landing site shows fabricated stats and a "Live"
    badge with zero clients, describes an AWS security posture we do not have, and claims "SOC 2" and
    "Direct CBP". In-bond is advertised as live.

Also notable (high): MFA bypass on the chat and notification streams (BPR-03); a "viewer" role that is
not enforced, so viewers can transmit to CBP (BPR-05/FNA-16); no password reset (USA-13); bulk submit
never transmits (LND-M1); possible double charges in Stripe retries (BPR-09); the ISF deadline computed
from departure, not lading (UOP-M1); and liquidation/PSC tracking computed from ISF filings with a
270-day rule (CBP's is 300 days; CAP-08).

## Strengths to preserve

- The certified CATAIR engine: codec, envelope, builders, parsers and 89 scenarios, plus its test discipline.
- The entry-number allocator (`EntryNumberBlock`, atomic draw, check digit).
- The public API, webhooks and API-key model (to harden, not replace).
- Advisory-locked background jobs, SSRF guard, CSP and the entitlements model.
- The design system and brand foundations (landing nav, homepage), which are good material for the app pass.

## Workstreams and order

| # | Workstream | What | When |
|---|---|---|---|
| H | **Hardening quick wins** | FY2027 fees, remove/replace Type 86 and enable Type 11, fix wizard code tables (MOT, payment, ports), remove false claims (stats, SOC 2, AWS page, in-bond "live"), MFA stream bypass, enforce viewer role, password reset, bulk submit through `filingWrite`, crash on "Advanced" line fields | **Now**, in parallel with Phase 1 (small, independent) |
| A1 | Native go-live Phase 1 | Inbound pipeline + **CBP message model** (conditions, versions, release/hold/PGA, SA bill match, UC) + immutable transmission/response records (BPR-02) + exactly-once sends (ENG-12, BPR-06) + condition catalog for rejections (BNA-08, FNA-10) | Next |
| A2 | Phase 2 | Per-org CBP config **binding filer identity** (BNA-01, FNA-04), service-center UI (FNA-07), API key hardening (BPR-04), CC control panels removed (USA-09) | After 1 |
| A3 | Phase 3 | Native ISF with a real lifecycle (replace/delete), mapper without invented data, wizard fixes (house/master bill, STB bond, multi-manufacturer, edit truncation), confirmation step with filer and environment (FPR-11), correct deadline | After 2 |
| A4 | Phase 4 | Native entries: v2 payload as storage (BNA-09), FX, SPI, AD/CVD, entry lifecycle (replace/delete/PSC), ch.99 done right (workstream C), autosave race (FPR-01), record document from the accepted wire (BNA-12) | After 3 |
| C | Multi-HTS, perfected | Keep the feature (it is a daily necessity). Fix: no unit on overlays, 8-digit only, replace-vs-add duty semantics, exemption headings, ordering/dedupe, pairing rules (F771), dated rates, ch.99 UI with a per-overlay duty breakdown, and no leak to CC | Inside Phase 4 |
| D | Production readiness | Backups (off-site, encrypted, restore drill), immutable records, observability (metrics, alerts, request ids), deploy hardening (BPR-13), webhook durability (BPR-07), Stripe idempotency (BPR-09), frontend Sentry (FPR-08) | Alongside 1 to 4; must be done before Phase 5 |
| A5 | Phase 5 | Promote staging to main, prod MQ connection (QGP2), TRADE.VERIFY, first live filing | After 4 + D |
| E | UX/visual program | Design-system first, then filing flows, dashboard "what needs attention now", lists with server-side paging, accessibility, auth on mobile | After the native flows stabilize (Phases 3 and 4 rebuild those screens anyway) |
| F | Capabilities | Release/hold dashboard from SO/UC, zero-surprise pre-transmit validation (CERT-proven validator + HA tariff check), ISF-to-entry auto-build, broker workspace (multi-IOR, bonds, POA registry), correct liquidation/PSC | After go-live, first sales-driven |
| G | Landing | Truthful copy now (workstream H); go-live copy ("CBP-certified ABI software vendor and service center") after the first verified PROD filing | H now, rest at go-live |

Sequencing rule: Phase 1 is the foundation (sequential). Workstream H tasks are independent and can run
alongside it. The UX program waits until the native flows exist, so screens are designed once.
