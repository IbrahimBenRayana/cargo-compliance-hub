# Native manifest query

Status: built behind a switch, not yet proven against CBP. See "What is and is not proven" at the end.

The manifest query page asks what CBP has on file for a bill. Until now the question went through the CustomsCity gateway. This moves it onto our own ABI engine, using CBP's Cargo Manifest/In-bond/Entry Status Query.

Source: `docs/abi-engine/specs/queries/cargo-manifest-entry-release-query-v21-2025-09.pdf` (ACE ABI CATAIR, revision 21, September 9 2025). Page references below are the chapter's ACMQ-n numbers.

## The transaction

| | |
|---|---|
| Input application code | `CQ` |
| Response application code | `C1` |
| Input record | `WR1`, one per question, repeatable (ACMQ-13) |
| Envelope | Standard A / B ... Y / Z batch. The B-record filer code must equal the entry filer code when the question is about an entry. |

One WR1 asks exactly one kind of question (ACMQ-14 Note 1):

| Question | WR1 fields used |
|---|---|
| Ocean, rail or truck bill | Issuer code (SCAC, 32-35) + bill number (36-47). Both required. |
| Air waybill | Air waybill number (48-58), optional house air waybill (59-70). A house needs its master. |
| In-bond | In-bond number (20-31) only. For air, also the carrier code in 32-35. |
| Entry | Entry filer code (8-10) + entry number (11-19, right justified). Entries up to 6 months old only. |

Three options on the same record:

- Position 71, related bills: `Y` on an ocean bill returns its house bills (or its master).
- Position 72, bill and entry data: `Y` on an entry query also returns the status of the bills on that entry.
- Position 73, limit output: space = most recent notification only, `1` = last five, `2` = everything (ACMQ-20 Note 5).

## Response records

All are application `C1`. Parsed by `server/src/abi-engine/apps/manifestQuery/`.

| Record | Page | What it carries | Parsed |
|---|---|---|---|
| WR0 | ACMQ-21 | Entry query error: filer, entry number, error code, narrative | Yes |
| WSA | ACMQ-22 | In-bond or ocean/rail/truck bill error: in-bond, issuer, bill, error code, narrative | Yes |
| WSB | ACMQ-23 | Air waybill error: air waybill, house, error code, narrative | Yes |
| WR1 | ACMQ-24 | Conveyance: carrier code, vessel or conveyance name, voyage/flight/trip, date of arrival. Entry fields only on entry queries by the entry's own filer. Opens a loop. | Yes |
| WR2 | ACMQ-27 | Truck trip number, FIRMS code of the air cargo location | Yes |
| WR3 | ACMQ-28 | Country of origin and tariff. Reserved, not currently returned. | Layout only |
| WS4 | ACMQ-29 | In-bond status and dates, when the in-bond itself was updated | Yes |
| WR4 | ACMQ-30 | The bill: in-bond number, master, house, sub-house, manifest quantity and unit, issuer codes, bill type, ISF on file, mode of transport. Repeats per in-bond. | Yes |
| WS5 | ACMQ-32 | In-bond status and dates per bill | Yes |
| WSC | ACMQ-34 | Air: carrier, flight, scheduled arrival, air waybill, house, split indicators, manifest and boarded quantities, in-bond | Yes |
| WSD | ACMQ-37 | Air disposition: date, time, code, narrative, related in-bond or entry number | Yes |
| WR5 | ACMQ-39 | Surface disposition: date, time, code, narrative, release date and origin (code 22), quantity, sequence | Yes |
| WN0 | ACMQ-41 | Amended master and house quantities | Yes |
| WN1 | ACMQ-42 | Ports: manifested and actual port of unlading, in-bond origin and destination, vessel departure port and date, container load port and date | Yes |
| WO10 to WO72 | ACMQ-44 to 63 | Entry release status. Same layout as the SO cargo release notification. | Kept raw, not parsed (out of scope here) |

Loop order (ACMQ-15 Note 3): a master bill query returns the master in the first WR1/WR2/WR4/WR5/WN0/WN1 loop and each house in a following WR1 loop. A house bill query returns the house first and its master second. An air query returns one WR1/WR2 followed by a WSC/WSD/WN0/WN1 loop for the master and one for each house.

Errors (ACMQ-64): 009 invalid carrier code, 176 carrier code missing, 185 bill or in-bond number missing, 122 bill not on file, 123 in-bond not on file, 297 invalid air waybill, 950 entry not found, 999 batch rejected, B05, B06, B14, INE insufficient data, X17 filer not authorized, X39, X40, ZZZ system failure.

## What each record maps to on the page

The page (`src/pages/ManifestQueryPage.tsx`) keeps reading `response.data.response`. The native answer is written into that same shape by `server/src/services/cbp/manifestQueryAnswer.ts`, so the page layout, the ISF prefill and the entry prefill keep working. The full parsed answer is stored next to it under `response.native`.

| On the page | Ocean, rail, truck | Air |
|---|---|---|
| Carrier | WR1 carrier code, else WR4 issuer code | WR1 carrier code, else WSC importing carrier |
| Vessel / Flight | WR1 conveyance name, voyage 67-71 | WSC flight number |
| Scheduled arrival | WR1 date of arrival | WSC scheduled arrival date |
| Port | WN1 manifested port of unlading | WN1 manifested port of unlading |
| House bills | Every following loop whose WR4 is a house bill: issuer + house number, quantity, its own WR5 dispositions | Every WSC that carries a house air waybill, with its WSD dispositions |
| CBP status codes | WR5 code (date, time, narrative kept) | WSD code (plus related entry or in-bond number) |
| "Not on file" | WSA with 122 or 123 | WSB with 122 or 297 |
| "No answer" | Any other error code, or a batch CBP rejected. Shown with CBP's own code and text. | Same |

Two small page changes, layout unchanged:

- A bill with no house bills (a regular or simple bill) now shows as one row with its own status codes. Before, a bill's own codes were only visible on house rows.
- A hold on the master bill itself now counts as a hold in the summary line.

Input: the page sends the bill the way people write it, carrier code first (`MAEU123456789`). The first four characters become the issuer code and the rest the bill number. CBP's bill number field is 12 characters, so a longer bill is refused with a clear message before anything is sent. An air waybill is 11 characters with the hyphen removed.

## Ocean vs air

- Different input fields (issuer + bill vs air waybill + optional house) and different error records (WSA vs WSB).
- Ocean returns one WR1 loop per bill. Air returns one WR1 and a WSC loop per waybill.
- Surface dispositions are WR5 with codes from Ocean CAMIR Appendix D. Air dispositions are WSD with two-character codes from Air CAMIR Appendix A, and can name the entry or in-bond they belong to.
- Ocean has the ISF-on-file indicator and container load port and date. Air has split (part) indicators and boarded quantities.
- Air needs no carrier code in the request. The first three characters of the waybill identify the carrier.

## What CBP offers that the old route did not

1. ISF on file, yes or no, per bill (WR4 position 74). Useful before filing an ISF or an entry.
2. Entry release status by entry number (WO records): the same data as the cargo release notification, on demand, for entries up to six months old.
3. In-bond queries by in-bond number, with status (arrived, enroute, exported and so on), dates and all legs.
4. Rail and truck bills, not only ocean and air.
5. Bill type (regular, master, house, FROB) and mode of transport straight from CBP.
6. Amended manifest quantities (WN0), and the quantity on each disposition.
7. Release date and release origin on disposition 22.
8. Vessel departure port and date, vessel diversion port, container load port and date.
9. Truck trip number and FIRMS code.
10. CBP's own narrative for every disposition code, so an unknown code still reads as words.
11. A direct answer. No third-party request id and no polling of somebody else's service: the reply arrives on our queue.

Items 1, 5, 6, 7, 8, 9 and 10 are already parsed and stored under `response.native`. Items 2, 3 and 4 are supported by the request builder but not exposed on the page.

## How it is selected

Same rule as filings: `OrgCbpConfig.gateway` (`NATIVE` by default, `CC` for an org kept on the gateway).

Because CQ is not yet proven on our profile, there is one more gate, using the existing rollout convention (`DASHBOARD_V2`, `SHIPMENTS_V2`): `MANIFEST_QUERY_NATIVE` = `off` | `staff` | `all`, default `off`.

- `off`: every query uses the gateway, exactly as today.
- `staff`: platform admins get the native path, everyone else the gateway. This is how to test on staging against CERT.
- `all`: every org whose gateway is `NATIVE` uses the native path.

Setting it back to `off` is the rollback. Queries already answered keep their stored answers either way.

## Flow

1. `POST /api/v1/manifest-queries` validates the bill, creates the `manifest_queries` row (`pending`, no gateway request id) and transmits one CQ batch through `transmitNative`, so the wire text is stored in `cbp_transmissions` before it is sent, tagged in the B-record user data.
2. CBP's C1 reply lands on our queue, is stored by the one inbound consumer, and `manifestQueryHandler` matches it by the echoed tag, parses it, writes the answer and notifies the person who asked.
3. The request waits up to 60 seconds in the background, pulling the queue. No reply by then marks the query `timeout`. "Check again" on the page pulls the queue once more; a late reply still completes the query.

Assumption to verify on CERT: that C1 echoes our B-record user data like the other applications do. If it does not, replies will be stored but not matched, and matching by bill number has to be added.

## Not in this change

- Parsing the WO entry-status records and an entry-status screen.
- In-bond and rail/truck queries on the page.
- The disposition code table in `src/data/dispositionCodes.ts`. It predates this work and does not match CBP's appendices (for example CBP's air code 1H is "Hold Placed"). It should be rebuilt from Ocean CAMIR Appendix D and Air CAMIR Appendix A.
- Removing the gateway path.

## Email to the CBP client representative (draft, not sent)

Subject: S7P: is the Cargo Manifest/Entry Release Query (CQ/C1) enabled on our profile?

Hello Michael,

We are adding the Cargo Manifest/In-bond/Entry Status Query (application CQ, response C1, CATAIR chapter dated September 9, 2025) to our software for filer code S7P. Before we send any CQ traffic I would like to confirm a few points with you.

1. Is CQ already enabled on the S7P profile in CERT and in production, or does it need to be added?
2. Does CQ require its own certification testing, or is it covered by the certification we completed on October 13, 2026?
3. If testing is required, what should we send? For example a set of bill, air waybill, in-bond and entry queries. Is there a test script?
4. Are there bills of lading and air waybills on file in CERT that we can query to see a full response (WR1, WR4, WR5, WN1 for ocean and WSC, WSD for air)? If so, could you share a few numbers, including a master bill with house bills?
5. We plan to query bills that our clients ask about, with S7P as the filer in the B record. Are there limits on which bills a filer may query, or does error X17 (FILER NOT AUTHORIZED) apply only to entry queries?
6. Does the C1 response echo the user data we send in positions 60 to 80 of the B record, as the other applications do? We use it to match responses to requests.

We will not send CQ to production until you confirm.

Thank you,
Ibrahim Rayana
MyCargoLens (Sigma Tech LLC), filer code S7P

## What is and is not proven

Proven by unit tests built from the chapter's record layouts:

- The WR1 request is laid out position for position as ACMQ-13 and ACMQ-14 describe, for bill, air waybill, in-bond and entry questions.
- Each response record is read at the positions the chapter gives, and the loops (master then houses, house then master, air master then houses) are grouped as Note 3 describes.
- The answer is turned into the shape the page reads, including "not on file" and refused queries.

Proven on CBP CERT, November 13 2026 (staging, `MANIFEST_QUERY_NATIVE=staff`, three queries from the manifest query page):

- CQ is accepted on the S7P profile in CERT. CBP answered each query with a C1 in about two seconds.
- C1 echoes our B-record user data, so replies match their requests by tag.
- The WR1 request layout and the WSA error layout are as built. What was sent and what came back (A records withheld):

```
B  1303S7PCQ                                               MCLBB44560956C348309E
WR1                            MAEU789441120                          Y 2
Y  1303S7PCQ
Z1303S7P

B  1303S7PC1                                               MCLBB44560956C348309E
WSA            MAEU789441120   122BILL NBR NOT ON FILE
Y  1303S7PC100001
Z1303S7P
```

- The page showed "Not on file" with CBP's text, the transmission was marked answered, and the query completed without waiting or polling.

Not proven:

- A reply for a bill that is on file. CERT had nothing for the bill asked about, so the WR1/WR4/WR5/WN1 and WSC/WSD loops have only been read from fixtures built from the chapter. This needs a bill number that exists in CERT (question 4 in the email).
- Production. CERT accepting CQ does not show it is enabled on the production profile, or that CBP requires no separate testing (questions 1 and 2 in the email).
- Air waybill, in-bond and entry questions against CBP.
