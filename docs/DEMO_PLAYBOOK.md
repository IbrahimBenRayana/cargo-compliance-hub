# Demo Playbook — staging happy path

A walkthrough for demoing MyCargoLens on **staging** with the pre-seeded demo
organization. The seed guarantees every screen opens on polished, successful
data — no empty states, no failed filings.

## Before every demo: reset the data

Make it a habit — reseed right before the call so timestamps read
"2 hours ago", the dashboard charts cover the last 60 days, and any mess from
a previous demo is gone. On the **staging VPS**:

```bash
docker exec mycargolens-server node dist/scripts/seedDemoData.js
```

- Targets the org owned by `demo@mycargolens.com` (override with
  `--org-email <email>`); refuses to run against an org that doesn't look
  demo-ish unless `--force` is passed.
- Wipes and reseeds ONLY transactional data (filings, entries, in-bonds,
  tracking, logs, notifications, templates, manifest queries). Users, the
  org, its subscription and chat are untouched — the login keeps working.
- Takes a few seconds; prints per-section progress and a final count summary.

## Login

- URL: `https://staging.mycargolens.com`
- User: `demo@mycargolens.com` (password in the team vault)

## What's pre-seeded (talk over it, don't build it live)

| Area | Seeded state |
| --- | --- |
| Dashboard | Pipeline filled across all four stages (ISF → Manifest → Entry → Cleared), 60 days of activity for the KPI sparklines, recent-activity strip populated |
| ISF filings (Shipments) | 14 filings: 9 `accepted`, 1 `submitted`, 1 `pending_cbp`, 2 `draft`; one ISF-5; one consolidation (3 HBLs under MBL `OOLU210577643`) |
| ABI entries | 10 documents: 6 `ACCEPTED` (entry summary + cargo release both ACCEPTED), 2 `SENT`, 2 `DRAFT` (one Type 86 air) |
| In-bond (7512) | 6 filings: 2 `DRAFT`, 2 `READY` with real engine-built wire text (61 IT + 62 T&E), 1 `ARRIVED` (61, arrival event), 1 `EXPORTED` (62, arrive + export events) |
| Container tracking | 8 tracked shipments across the journey: on vessel, arrived, available for pickup (LFD in 2–5 days), picked up; one with a released customs hold |
| Manifest queries | 4 completed queries with CBP dispositions (`1W` arrived, `1C` released) |
| Submission logs | 25 successful CBP request/response entries tied to the filings above |
| Notifications | 8 recent items (4 unread) — filing accepted, entry accepted, bill matched, container available, LFD warning |
| Templates | "Electronics from Shenzhen", "Textiles from Ho Chi Minh", "Auto parts from Stuttgart" |

## Suggested flow (25–30 min)

### 1. Dashboard (2 min) — the "inbox for US customs"
Open on the dashboard. Point at the four pipeline columns: shipments flow
left to right from ISF to Cleared. Click a **Cleared** tile — it deep-links
straight into the accepted entry.

### 2. ISF filings (5 min)
- **Shipments list**: filter chips by status; call out the accepted majority.
- Open **Pacific Rim Trading Co** (MBL `MAEU789441120`) — full parties,
  commodities with HTS + values, containers, status history draft → submitted
  → accepted.
- Open one of the **OOLU210577643** filings — show the consolidation banner:
  3 house bills filed under one master, one click to the siblings.
- Show a **draft** — this is where "New Filing" or a template lands.
- Optional LIVE: **Templates → "Electronics from Shenzhen" → Apply** creates a
  pre-filled draft in one click. (Delete the draft after, or just reseed.)

### 3. Manifest query (3 min) — run one LIVE if CC sandbox is up
- Show the history table (all completed).
- Open the `OOLU210577643` result: carrier, vessel, arrival, and the three
  house bills with `1W Arrived` / `1C Cargo Released` disposition badges.
- Point at the CTAs: "File an ISF" / "Create Entry" pre-filled from the
  manifest — that's the pipeline story again.

### 4. ABI entries (5 min)
- List page: ACCEPTED badges, entry numbers in filer format `MCL-XXXXXXX-X`.
- Open an accepted entry: Transmission card shows **Entry Summary: ACCEPTED /
  Cargo Release: ACCEPTED**, linked ISF filing, invoices with HTS lines and
  values, link to submission logs.
- **Duty calculator — run LIVE**: open the Duty Calculator, enter HTS
  `8507.60.00` (lithium-ion batteries), value $184,000, port `2704` — rates,
  MPF/HMF and total duty compute from the real HTS refdata.
- **AI classification — run LIVE**: on the Compliance page's Classification
  tab, ask it to classify "wireless earbud headphones with charging case" and
  let it suggest the HTS.

### 5. In-bond (5 min) — the native CATAIR engine
- List: the 6 filings across the lifecycle.
- Open a **READY** filing (61 IT): the payload cards AND the real CATAIR wire
  text (QP10/QP20/QP30…80-char records) built by our own engine.
- **Run LIVE**: open a DRAFT, click **Validate & build** — the engine
  validates and emits the wire preview in front of the audience. (This is the
  differentiator: no vendor in the middle.)
- Open the **EXPORTED** T&E: show the event timeline — arrival then export,
  each with its own WP wire record.

### 6. Container tracking (3 min)
- List: 8 shipments, vessels, PODs, ETAs.
- Open `OOLU210577643` (available for pickup): voyage milestones, container
  card with **Available for pickup** badge, last free day highlighted, and a
  released customs hold — "your team sees demurrage risk before it costs money".

### 7. Compliance + logs + notifications (3 min)
- **Compliance page**: health score computed live from the seeded filings
  (high — nothing rejected), action queue, liquidation tracker rows from the
  accepted entries.
- **Submission logs**: every CBP call recorded — method, endpoint, status,
  latency. "Full audit trail, always."
- **Notification bell**: unread items — entry accepted, bill matched, LFD
  warning — each deep-links to its record.

## Do NOT do during a demo

- Don't transmit anything to CustomsCity/CBP from the demo org (Transmit
  buttons on drafts are live wiring).
- Don't edit the accepted/exported records; use the drafts for live editing.
- If a demo goes sideways, just reseed — that's the whole point.
