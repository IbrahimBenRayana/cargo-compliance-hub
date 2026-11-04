# First production ISF: go-live checklist (gate G1)

The friendly shipment is one real ISF-10, filed free on production under filer code **S7P**
(MyCargoLens as ISF agent) for a consignee that holds a **continuous bond**. It is the proof that the
whole path works: transmit, CBP acceptance, the filing's timeline, the billing row and the usage CSV.
No pilot proposal goes out before it.

- Paperwork by **Fri Nov 13**. Filing target **Fri Nov 20**. Escalate on Nov 27; order forms held from Dec 18.
- Owner: Ibrahim. Plan context: `marketing/deliverables/2026-11-03-lead-generation/friendly-shipment.md`.
- Every step that touches prod (env, containers, data, the filing itself) is Ibrahim's call.

## 1. Where the prod path stands (checked Nov 4 2026, without filing)

| Piece | State | How it was checked |
|---|---|---|
| Native ISF send (add / replace / delete) | On main since release #204. Proven on CERT Oct 19 with add → replace → delete through `transmitIsfNative`, under S7P, continuous bond | Code on `main`; CERT history |
| Who files | With no `OrgCbpConfig` row, an org defaults to gateway `NATIVE` and ISF mode `SIGMA`, so the ISF goes out under S7P with no client-rep approval needed | `filerIdentity.ts`, `filingWrite.ts` |
| MQ channel | Prod `cbp-inbound` job pulls from `ACS.BRK.1303S7P.OUTBOUND` on QGP2 every minute. Last success 15:31 UTC Nov 4; last error Oct 29 20:17 UTC (when the channel came up) | Public `GET https://app.mycargolens.com/api/health` |
| Sender sign-on (A record) | Prod uses site 1303 / ID S7P and the CERT password, which CBP (Michael Barela) confirmed on Oct 20 and Oct 28 is the same for PROD. **Not yet proven by a real send.** TRADE.VERIFY can't prove it: CBP says it isn't granted in prod (MQRC 2035 is expected). There is no harmless prod query in the app, so the first ISF is the first proof | Project notes; `sender.ts` |
| Correlation and verdicts | Each send carries `MCL` + transmission id in the B-record user data. CBP echoes it, the dispatcher matches it, and `applyIsfVerdict` sets status, the ISF transaction number, history, notification and billing once | `nativeTransmit.ts`, `transmissionHandlers.ts`, `isfVerdicts.ts` |
| No answer from CBP | After 20 minutes the org's operators get a bell notice and the server logs an error. **Nobody at MyCargoLens is paged** (log line only) | `unanswered.ts` |
| Billing row | Written on the first accepted ADD (`billShipmentForFiling`) if the org has a plan. A $0 ISF price records a `skipped` row at $0. An invoiced org records `accrued` | `shipmentBilling.ts` |
| Usage CSV | **Not on prod.** It ships with billing v2 Phase 1 (#203), which is on staging only (gate G5). The CSV reads rows by acceptance date, so it can be pulled after G5 lands, even for a filing accepted before | `invoicing.ts` on staging |
| CBP health monitor | **Not on prod.** `/api/v1/status/cbp` (#208) is unmerged; on prod that URL returns the web app, not a status. The older `/api/v1/status` "cbp healthy" flag follows the legacy poller, not the MQ connection | `curl` of both URLs |

## 2. Engineering prerequisites (Ibrahim, before Nov 20)

| # | Item | Why it matters for the proof filing | Target |
|---|---|---|---|
| E1 | Release billing v2 to main (PR from `release/app-2026-11-billing-v2`: #203 + the ISF bands) | Usage CSV evidence; invoiced pilots (G5) | After staging check, by Nov 18 |
| E2 | Review, merge to staging and release #210 → #213 → #214 (CBP verdict fixes) | #214 closes a window where a fast CBP answer arriving before `lastTransmissionId` is written would be ignored, leaving the ISF "Submitted" with no verdict. The window is milliseconds and the inbound job runs once a minute, so the risk is low, but it's the one bug that could lose the proof | Recommended, same release |
| E3 | Merge #208 and point an external uptime monitor at `/api/v1/status/cbp` and `/api/health`, alerting both founders | Without it nobody is told if MQ stalls during the filing window (see `CBP_OUTAGE_RUNBOOK.md`) | Recommended, same release |
| E4 | Read-only prod check (section 3) | Confirms the bridge and sender config before the real send | Nov 16-18 |
| E5 | Prod org for the filing (section 4) | The submit gate needs a plan with ISF filing, and a card unless the price is $0 or the org is invoiced | Once the consignee is known |

## 3. Read-only prod check (Ibrahim runs; prints names, never secret values)

```bash
ssh mycargolens-prod 'docker ps --format "{{.Names}} {{.Image}} {{.Status}}"'
```
Expect `mycargolens-server`, `mycargolens-db` and `mycargolens-mq-bridge` running. The bridge image is pinned by SHA, not `:latest`.

```bash
ssh mycargolens-prod 'cd /opt/mycargolens && grep -E "^(ABI_TRANSPORT|CBP_ENVIRONMENT|COMPOSE_PROFILES|CBP_SENDER_SITE|CBP_SENDER_ID)=" .env; grep -c "^CBP_SENDER_PASSWORD=." .env'
```
Expect `mqipt`, `PROD`, `mqipt`, `1303`, `S7P`, and a count of `1` (password set).

```bash
ssh mycargolens-prod 'docker exec mycargolens-server sh -c "wget -qO- http://mq-bridge:8080/health --header \"x-bridge-token: \$MQIPT_BRIDGE_TOKEN\""'
```
Expect the queue manager `QGP2`, with both queues open.

Then, signed in as platform admin, open `https://app.mycargolens.com/admin/cbp`. It should show environment `PROD`, a recent last-inbound time, and 0 pending dispatch and 0 unknown outcomes.

## 4. The filing org on prod

Pick one:
- **The consignee's own org** (preferred: they're the first warm prospect). Provision it in `/admin` (sales-led), on the **ISF Filing** plan.
- **An internal Sigma org**, if the consignee doesn't want a login.

Then set the pricing in ⋯ → Pricing & billing:
- **Today's main:** card mode with an ISF price of **$0**. No card is needed (`requiresPaymentMethod` is false), and acceptance writes a $0 `skipped` billing row.
- **After G5:** invoiced mode with a $0 minimum and a $0 ISF price works too, and writes an `accrued` row.

Leave `OrgCbpConfig` unset, or set gateway `NATIVE` and ISF mode `SIGMA`. Never `CLIENT`: that needs the client's own filer code and client-rep approval.

The user who submits needs a verified email and MFA enrolled (the submit route requires both). Make that a founder's login in the org, so the founder can file on a screen share.

## 5. Paperwork (by Nov 13)

- [ ] Written ISF-agent authorization from the consignee naming MyCargoLens (S7P) as ISF filer for that one bill. Saved to the shared drive, with its date.
- [ ] Confirmation that the consignee's usual ISF filer will **not** file this bill. CBP must receive one ISF only.
- [ ] Bond: type **continuous** (wire type 8, activity 01). Bond holder = the importer's IOR number (EIN with suffix, e.g. `12-345678900`). Engineering checks the bond holder number matches the ISF importer number the bond is on file under.
- [ ] ISF-10 elements from the origin partner: seller, buyer, importer of record number, consignee number, manufacturer (supplier) name and address, ship-to party, country of origin, HTS-6 per line, container stuffing location, consolidator. Also: master and house bill, house-bill SCAC if the house bill isn't the carrier's, vessel, and the estimated lading date at the foreign port.
- [ ] Loading date confirmed. CBP needs the ISF **at least 24 hours before lading** (19 CFR 149.2). Plan to file **72 hours or more before lading** so a rejection or a silent sign-on failure can still be fixed.

## 6. Filing day

1. Build the ISF in the app (New shipment). "Who files this ISF with CBP?" = **MyCargoLens (S7P)**.
2. Run the checks on the review step until nothing blocks. Fix every flag. Have a second founder read the parties and HTS lines against the partner's documents.
3. Submit. Expect `202` and the status **Submitted**. The timeline says "ISF add transmitted to CBP under filer S7P".
4. Watch `/admin/cbp`. Within minutes the transmission should go **SENT → ACCEPTED** and the filing **Accepted**, with "ISF accepted by CBP (ISF Txn: …)" on its timeline.
5. **If rejected:** CBP's codes and narrative are on the filing. A rejected ISF is never billed. Fix the data and submit again (a new add).
6. **If there's no answer after 20 minutes:** suspect the sign-on (in Aug 2026 a wrong A record drew no response at all). Don't resend: the outcome may be unknown, and a blind resend could file twice. Check `/admin/cbp` for unmatched inbound messages. Then email Michael Barela (CBP client rep) with the time sent and the transmission's MQ message id, and MQSTAFFOPS@cbp.dhs.gov if the channel is in doubt. Follow `CBP_OUTAGE_RUNBOOK.md`, and keep the consignee's usual filer on standby if the 24-hour cutoff gets close.
7. After acceptance, don't delete or replace the ISF unless the shipment data really changes.
   - Known gap (PR #213): the app has no ISF amendment form. A change can only go out through `POST /filings/:id/amend` (API).
   - If an update is likely (e.g. container numbers arrive late), agree before filing who sends it and how.

## 7. Evidence to save (the demo walkthrough)

- [ ] Screenshot of the accepted filing and its timeline, with the CBP ISF transaction number visible.
- [ ] `/admin/cbp`: the transmission (wire as sent) and CBP's response message.
- [ ] Billing row: Usage & invoices for the org's month, showing the ISF.
- [ ] Usage CSV for the month (after G5 is on main).
- [ ] Screen recording of the walkthrough. Make no timing claims about CBP's response, and keep the consignee's data out of any public material.
- [ ] Update `docs/` (release notes) and tell the CMO: G1 done.

## 8. Single-transaction bonds (gate G2): not proven

- **Built:** the ISF wizard collects the STB surety code and bond reference. The mapper sends bond type 9, activity 16, and SF20 V1 (surety) + SBN (bond reference) references. If either is missing it refuses to build, rather than inventing them. Unit tests cover the mapping (`isfFromFiling.test.ts`).
- **Not proven:** no STB ISF has been sent to CBP, on CERT or on prod. The Oct 19 CERT chain used a continuous bond. CERT has STB test importers (entry scenarios 004 and 033), but none was run for ISF.
- **Missing before an STB pilot:**
  1. One STB ISF on staging against CERT, through the app, with a CERT STB importer and a bond reference CBP holds. The bond's surety must have filed the eSTB first.
  2. Then one real STB ISF on prod.
  3. Check that CBP's reply when no STB is on file (its "no STB found" class) shows clearly on the filing.
- **Until then:** the friendly shipment uses a continuous bond only.
