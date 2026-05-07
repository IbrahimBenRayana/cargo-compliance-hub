# Manual QA Checklist — MyCargoLens

> **Last updated:** 2026-05-07 · **Maintainer:** the-person-running-it
>
> Run this checklist before any major release (Terminal 49 integration, schema migration, auth changes).
> Each item has an explicit pass/fail criterion. Document the run in the **Run log** section at the bottom.
>
> **Skip what you can't reach.** Some items need a real CustomsCity sandbox account; some need a real
> email inbox; some need a teammate to log in alongside you. If you skip, mark it `SKIP — reason`.

---

## How to use

- ⏱ Estimated time: **2–3 hours** for a full pass.
- ✅ = pass · ❌ = fail (file a bug + link to it) · ⏭ = skip (note why) · ⚠️ = pass-with-caveat (note what)
- Severity scale on bugs found:
  - **P0** = data loss / silent compliance failure / blocks a real user task
  - **P1** = wrong-but-recoverable / UX confusion users will hit
  - **P2** = polish / cosmetic
- **Always test in prod (`https://app.mycargolens.com`)** unless an item explicitly says "local". Real backend, real CC sandbox, real email.

---

## 0. Setup

- [ ] Two browser profiles ready (e.g., Chrome + Firefox, or two Chrome profiles). One for "you", one for a teammate.
- [ ] Real email inbox you can check (Gmail/Outlook). Email opt-out tests need a real recipient.
- [ ] CC sandbox API key configured (Settings → API & Integrations → "Test connection" returns ✓).
- [ ] You have at least 1 active filing in the org (create one if needed via the wizard with synthetic but realistic data).
- [ ] DevTools open in Network tab for the auth-race tests.

### Test data (paste these — they're known-good in CC sandbox)

The constants below come from the CC API docs. Use them anywhere a test
asks for "a known-good X". Source: `server/src/__tests__/fixtures/customscity-samples.ts`.

| What | Value | Notes |
|---|---|---|
| ISF-10 master BOL | `8CUS1AA` | sandbox-known good |
| ISF-10 house BOL | `8CCGENR9001` | pairs with above |
| ABI master BOL | `123-141241001` | hyphenated form CC uses internally |
| ABI house BOL | `22222220` | pairs with above |
| ABI entry numbers (for /api/abi/send) | `S4G-7508876-8`, `S4G-7508875-0` | hyphenated canonical form |
| Manifest query AWB | `16072007541` | type=AWBNUMBER, returns 3 houses |
| Working HTS (10-digit dotted) | `7320.20.1000` | Helical springs, 3.2% duty |
| Working HTS (10-digit no-dot) | `9608600000` | Wireless network routers |
| Working HTS (alternative) | `0101290090` | livestock |
| AI duty calc descriptions | `Electric motor, 15 kW, for industrial use, 3-phase AC.`, `HONEY`, `POTATO` | get back classified HTS |
| Bad HTS to force CC error | `6204624000` | "HTS code not found in the system" |
| EIN (CC sample, working) | `20-493538700` | XX-XXXXXXXXX format |
| Tax ID (alt format) | `57-123456789` | XX-XXXXXXXXX |
| US port code (Houston-equivalent in sandbox) | `1001` | 4-digit |
| US port code (LAX) | `USLAX` | 5-letter UN/LOCODE |
| Country code (China) | `CN` | ISO-3166 alpha-2 |
| Bond surety code | `123` | 3-digit |

---

## 1. Authentication & session

| # | Test | Expected | Result |
|---|---|---|---|
| 1.1 | Log in with valid credentials | Land on `/` (Dashboard) within 2s | |
| 1.2 | Log in with bad password | Inline error on the form, no flash to dashboard | |
| 1.3 | Log out from header dropdown | Redirected to `/login`; `/api/v1/auth/me` returns 401 if you re-issue it | |
| 1.4 | **Refresh-token race** (PR #14 regression). DevTools → Network → clear log. Refresh the dashboard. Watch the wave of parallel 401s + refresh requests. | **Exactly ONE** `POST /api/v1/auth/refresh` should appear. All other queries 200/304 after it lands. | |
| 1.5 | Session expiry: leave the tab idle for >15 minutes, then click anywhere that fires a query | Page stays usable; one refresh fires; no redirect to /login | |
| 1.6 | Open the app in two tabs simultaneously, log out from tab A | Tab B's next API call → 401 → redirect to /login (or stays usable depending on cache TTL) | |

---

## 2. Notifications system

| # | Test | Expected | Result |
|---|---|---|---|
| 2.1 | Bell badge: navigate to Dashboard. Look at the bell. | Number matches the unread count from `GET /api/v1/notifications` | |
| 2.2 | Bell tabs: click the bell. Switch between **All / Unread / Critical**. | Counts and rows match. Critical shows only severity=critical. | |
| 2.3 | Day grouping: confirm rows are grouped under "Today / Yesterday / Earlier" headers. | Headers in correct order; nothing in the wrong bucket. | |
| 2.4 | Mark-as-read (optimistic). Click an unread notification. Watch the badge. | Badge decrements *before* network response. If the server fails (try DevTools → throttle → "Offline" then click), it rolls back. | |
| 2.5 | Mark-all-read. Click "Mark all as read". | All rows lose bold; badge drops to 0; badge stays at 0 after refresh. | |
| 2.6 | **Real-time SSE.** Open the app in two tabs, both logged in as the same user. Open Settings in tab B. In tab A, file an ISF. | Tab B's bell badge updates within ~1s without polling. (Confirm in DevTools that an EventSource connection to `/notifications/stream` is open.) | |
| 2.7 | **Critical toast.** Reject a filing via the Settings → notifications → trigger test button (or wait for a real `filing_rejected`). | A red Sonner toast appears even if the bell isn't open. | |
| 2.8 | Settings → Notifications: toggle every kind off, save. Then trigger a `filing_accepted`. | Bell stays empty; **email** for that kind also doesn't arrive (check inbox). | |
| 2.9 | Critical kinds (e.g. `filing_rejected`): toggle off — verify the row turns rose with a "critical" tag in the UI. | Visible warning that you're muting an important alert. | |
| 2.10 | Refresh the page; preferences persist. | Settings still show your toggles. | |

---

## 3. Email delivery (Phase 6 worker)

> Needs SMTP creds set in prod (`EMAIL_USER` / `EMAIL_PASS` already verified working).

| # | Test | Expected | Result |
|---|---|---|---|
| 3.1 | Trigger a `filing_submitted` event (file an ISF). Wait ~30s. Check email inbox. | Email arrives with the bespoke "Filing Submitted 🚀" template. | |
| 3.2 | Trigger a `filing_rejected` (manual via the Settings test trigger or by submitting a bad ISF). | Email arrives within 30–60s, "Filing Rejected ❌" template, includes reason. | |
| 3.3 | Trigger a Phase-3 kind (e.g. `entry_accepted` by accepting an ABI doc, or `team_member_joined` by accepting an invite). | Generic template arrives — severity-tinted banner, link button. | |
| 3.4 | **Retry on transient failure.** SSH into VPS: `docker compose stop server` for 30s. During that window, do something that should email. Restart. | Delivery row stays `queued`, eventually sends after retry. Check `notification_deliveries` table: `attempts > 0`, `nextAttemptAt` set. | |
| 3.5 | **Email opt-out actually applies.** In Settings, opt out of email for `filing_accepted` (keep in-app on). Trigger an acceptance. | In-app fires, **no email arrives**. Verify in DB: no `NotificationDelivery` row for that user/kind. | |

---

## 4. ISF Filing — wizard + create + edit

| # | Test | Expected | Result |
|---|---|---|---|
| 4.1 | New filing flow: wizard step 1 → fill required → next → ... → review → save draft | Each step's required-field validator works; back/next preserves state; save creates a draft row | |
| 4.2 | Save partial: leave half the fields blank, save | Draft saves with status=draft; no blocking validation | |
| 4.3 | Edit existing draft: navigate from `/shipments` → row → "Edit" | Wizard hydrates with all stored fields | |
| 4.4 | Pre-fill from existing filing: `?fromFiling=<id>` | Banner "Started from filing X"; identity fields blanked (BOL, voyage, dates, containers); parties + bond + commodities filled | |
| 4.5 | Pre-fill from manifest query: `?fromManifestQuery=<id>` | Banner "Started from manifest query for X"; BOL/carrier/port/arrival filled; parties/bond/commodities still blank | |
| 4.6 | Stale source (>14 days old): pre-fill from a 30-day-old filing | Banner is **amber** with the "verify before submitting" line | |
| 4.7 | Source filing deleted: pre-fill, then delete the source in another tab, refresh | Banner remains; no crash; fields stay populated | |

---

## 5. ISF Filing — submission gate (PR #15 regression)

> These tests confirm that bad data is caught at our gate, not at CC's. Each maps to a real prod error pattern.

| # | Test | Expected | Result |
|---|---|---|---|
| 5.1 | Create a filing, set `foreignPortOfUnlading: "USA"` (3 letters), click Submit | **400 with field-level error** "must be 4-digit CBP port code or 5-letter UN/LOCODE". No CC roundtrip. | |
| 5.2 | Set `foreignPortOfUnlading: "MAEU1234567890"` (BOL pasted into wrong field) | Same as above | |
| 5.3 | Set `foreignPortOfUnlading: "2704"` (Houston, valid 4-digit) | Passes | |
| 5.4 | Set `foreignPortOfUnlading: "USLAX"` (valid UN/LOCODE) | Passes | |
| 5.5 | Add a commodity with `description` 50 chars long | 400 with "must be 45 characters or fewer" | |
| 5.6 | Add a commodity with `weight.unit: "KG"` | 400 with "Weight unit must be K or L" | |
| 5.7 | Add a commodity with `weight.unit: "K"` | Passes | |
| 5.8 | Set `bondType: "continuous"` and clear `bondSuretyCode` | 400 with "Surety code is required when a bond is set" | |
| 5.9 | Set `bondSuretyCode: "ABC"` | 400 with "must be exactly 3 digits" | |
| 5.10 | Set `bondSuretyCode: "123"` | Passes | |
| 5.11 | Submit a clean ISF (all good) | Reaches CC; gets either accepted or a CC-side error (sandbox dependent) | |
| 5.12 | After 5.11, check Submission Logs (`/integrations/logs`) | Entry shows the request, the CC response, latency | |

---

## 6. ABI Documents

> Needs a CC sandbox account with at least one entry that can be sent. Use the sandbox test entry numbers from CC docs.

| # | Test | Expected | Result |
|---|---|---|---|
| 6.1 | Create a new ABI document via the wizard | Saves as DRAFT; entry is generated (alpha-numeric, 9-13 chars) | |
| 6.2 | Pre-fill ABI from an ISF filing (`?fromShipment=`) | Wizard pre-populates from the filing | |
| 6.3 | Send to CC | Status flips DRAFT → SENT → ACCEPTED (or REJECTED if CC test data is set to fail). Notification fires. | |
| 6.4 | hBOL handling: send a master-only shipment (no house BOL) | Server auto-fills hBOL = mBOL; CC accepts (regression of fae2ab9) | |
| 6.5 | Entry number canonicalization: send with hyphenated entry like "ABC-1234567-8" | CC's send endpoint finds the entry by canonical form (regression of 18e40ea) | |
| 6.6 | Re-send an already-sent entry | Server detects "already exists" 500, auto-recovers (deletes stale, retries; regression of dbd5832) | |

---

## 7. Manifest Query

| # | Test | Expected | Result |
|---|---|---|---|
| 7.1 | Submit a query with a known-good BOL from CC sandbox | Initially "pending"; polling completes within ~30s; results render | |
| 7.2 | Submit a query with an unknown BOL | Polling resolves to "BILL NBR NOT ON FILE" displayed cleanly (not as raw error) | |
| 7.3 | Submit a query with both BOL fields blank (if the form allows) | Server-side validation rejects with "BOL number is required" | |
| 7.4 | After completion, click "File ISF (10+2)" CTA | Navigates to `/shipments/new?fromManifestQuery=<id>` with prefill | |
| 7.5 | After completion, click "File Entry Summary (7501)" CTA | Navigates to `/abi-documents/new?fromManifest=<id>` with prefill | |

---

## 8. Duty Calculator

| # | Test | Expected | Result |
|---|---|---|---|
| 8.1 | Standard mode: HTS `7320.20.1000`, value `1000`, country `CN`, qty `100`, "K" weight | Calculates; results render with per-item breakdown | |
| 8.2 | Standard mode with bad HTS like `"ABC"` | **Inline** error on the HTS field for that item ("HTS must be 6–10 digits"). No CC roundtrip. | |
| 8.3 | Standard mode with a real but unrecognized HTS (CC sandbox doesn't have all codes) | CC returns 400; banner + per-item field highlight (PR #13 regression). Toast leads with the specific field message. | |
| 8.4 | AI mode: leave both `quantity1` and `quantity2` blank | **Inline** error pinned to Quantity 1 — "AI mode requires at least one of Quantity 1 or Quantity 2". No CC roundtrip. | |
| 8.5 | AI mode with description "automobile and parts" (vague) | CC returns 400 with the AI's explanation; toast shows the message | |
| 8.6 | Mode switch: standard with 5 items → switch to AI → switch back | Item data preserved across switches | |
| 8.7 | Pre-fill from filing: `?fromFiling=<id>` | All 4 metadata chips appear (country / mode / currency / etc); items populated; click any → chip drops | |
| 8.8 | Pre-fill from ABI entry: `?fromAbi=<id>` | Higher-fidelity prefill (HTS + value + qty + exemption flags) | |

---

## 9. Dashboard

| # | Test | Expected | Result |
|---|---|---|---|
| 9.1 | KPI sparklines render with correct 14-day series | Each card shows a sparkline; numbers match what the API returns | |
| 9.2 | Pipeline columns show correct shipment counts per stage | Counts match `/api/v1/filings?status=...` | |
| 9.3 | Empty state (org with 0 filings) | Hero CTA "Nothing in flight yet" + "New shipment" button | |
| 9.4 | KPI delta colors: positive vs negative direction | Standard metrics: up = green; inverted (Needs Attention) = up = red | |

---

## 10. Settings, Team, Onboarding

| # | Test | Expected | Result |
|---|---|---|---|
| 10.1 | Profile tab: change first/last name, save | Updates; UI reflects new name | |
| 10.2 | Change password (with old + new) | Saves; logout + login with new works | |
| 10.3 | Team tab: invite a new user | Email arrives with invitation link | |
| 10.4 | New user accepts invite, registers | Existing admins see `team_member_joined` notification | |
| 10.5 | Notifications tab: toggle every preference, save, refresh | Toggles persist exactly as set | |
| 10.6 | Audit log: shows recent actions (login, profile change, etc.) | Visible | |
| 10.7 | Onboarding: register fresh org → wizard steps work in order | Can't skip steps; `onboardingCompleted` flag blocks re-entry after done | |

---

## 11. Visual / responsive (P2)

| # | Test | Expected | Result |
|---|---|---|---|
| 11.1 | Dark mode toggle: navigate every page in dark | No invisible text, no broken contrast | |
| 11.2 | Mobile (375px viewport via DevTools): Dashboard, ShipmentDetails, DutyCalculator | All scroll correctly, no horizontal overflow, touch targets ≥ 44px | |
| 11.3 | Tab navigation through ISF wizard | Focus visible at every step | |
| 11.4 | Print preview of a filing detail | Prints cleanly without nav/sidebar (if implemented) | |

---

## Run log

> Copy this template per pass. Don't edit historical runs.

### Pass YYYY-MM-DD
- **Operator:** name
- **Build SHA:** `git rev-parse --short HEAD`
- **Environment:** prod / staging / local
- **Items run:** N / total
- **Bugs found:**
  - P0: ...
  - P1: ...
  - P2: ...
- **Notes:** ...

---

## Things this checklist does NOT cover (yet)

- Webhook signature verification on inbound integrations (when T49 lands).
- DataSync / data warehouse export.
- Multi-org isolation (one user can't see another org's data) — covered implicitly by all tests being run as a single org user.
- Stripe billing flows (separate runbook).
- Concurrent-user load testing (different discipline; deferred).
