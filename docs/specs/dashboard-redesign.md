# Spec: Dashboard redesign

Status: DRAFT for founder review, 2026-10-30. Nothing here is built. Prod is untouched.
Owner: Ibrahim. Surfaces: `src/pages/Dashboard.tsx` (route `/`) and a new server endpoint.

<!-- mock:hero -->

## The short version

The dashboard should answer one question: **what do I need to do next, and how long do I have?**
Today it answers a different one: how many things are in each column.

The plan replaces the kanban with a ranked work queue, keeps the pipeline as one compact strip of
honest stages, moves metrics to Compliance, and moves all counting to the server so numbers stay
right for orgs of any size. One page adapts to every role, plan and volume. There are no separate
role layouts and no widget builder.

Estimated build: about 17 working days in 9 phases, each shippable to staging on its own, behind a
server flag. Rollback is one setting and a short container recreate, rehearsed before release.


## 1. Objective

### What success looks like

Within 10 seconds of opening the page, any user can say what is most urgent, how long they have,
and what to press. These are the testable conditions:

- The first queue row is the most urgent item in the org by the rules in section 5.3.
- Every row names its reason in plain English and offers exactly one primary action.
- Every count on the page is correct for an org with 120,000 filings, and no figure is shown twice.
- No label says something the data does not prove.
- Works at 390, 744, 1133, 1280 and 1440 in light and dark, meets WCAG 2.1 AA, and shows a usable
  page for all five states (empty, loading, error, clear, overloaded).

### What "100% production ready" can honestly mean

Production ready here means: correct at scale, accessible, tested across every role and plan,
observable, and instantly reversible. It cannot mean "proven against live CBP traffic", because no
production filing has been made yet. The page displays stored state only, and says what is stored.
It must be rechecked after the first real prod filing (see the Definition of Done).

### What "jaw-dropping" means here

Beautiful for a compliance tool means the page is calm and exact, and the craft shows in the small
things. The current page spends its budget on motion: aurora backgrounds, count-ups, pulsing dots.
This plan removes them and spends it on three signatures that only this product could have:

1. **The Focus Frame on the live row.** The four corner brackets of the logo lock onto the current
   queue item. The logo's meaning ("a reticle on the one filing that matters") becomes the core
   interaction.
2. **The Cutoff horizon.** A 72-hour timeline of ISF cutoffs, so a crunch is visible before it hits.
3. **The clear state.** When nothing needs you, the frame sits empty and the page says so, with the
   next cutoff beneath it. That quiet screen is the product's promise made literal.

## 2. What is true today

Read from the code on `origin/staging`, and from the 2026-10-21 sweep screenshots of staging. I did
not log in to staging for this review. Implementation must branch from `origin/staging`: it has
billing v2, which `main` does not.

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| 1 | The browser reads at most **100** filings, not 200 | `Dashboard.tsx` asks for `limit: 200`; `filings.ts:280` caps at 100 | Every count on the page is wrong above 100 filings, and "cleared" and activity are computed from the same slice |
| 2 | Entries are capped at 100, ordered by `createdAt` | `schemas/abiDocument.ts:317` | A filing whose entry falls outside the newest 100 shows in the wrong stage |
| 3 | Both lists return full rows | `findMany` with `include` and no `select` | The JSON payloads and `nativeWireText` go to the browser for a page that shows a ref and a label |
| 4 | "Cleared" means "entry status ACCEPTED" | `buildShipments`; `entryLifecycle.ts:28` | ACCEPTED does not always mean released: with no release requested, it means the summary was accepted |
| 5 | "Manifest Verified" means "ISF accepted, no entry" | `buildShipments` | No manifest check happens. The label is untrue |
| 6 | "ISF Filed" and "Entry Filed" contain drafts | `COLUMNS` | The screenshot shows two drafts under "ISF Filed" |
| 7 | "Recently cleared" is capped at 8 and sits beside "Cleared this month" | `byStage` | Two different numbers appear to describe one thing |
| 8 | Attention counts every draft and rejection | `attentionCount` | An idle draft weighs the same as an ISF due in 4 hours. The count stops meaning anything |
| 9 | ISF deadlines never reach the page | No use of `filingDeadline` | The biggest penalty risk is invisible |
| 10 | The deadline can be an estimate and nothing says so | `isfDeadline.ts`: without a lading date it assumes ETD minus 48h | A precise-looking countdown would overstate what we know |
| 11 | Consolidations show as N unrelated tiles | `consolidationId` is ignored | An NVOCC with 12 house bills on one MBL sees 12 rows for one job |
| 12 | Only the latest entry per filing is used | `abiByFilingId` | A filing with two entries hides one |
| 13 | Viewers see create buttons that return 403 | No role check on `New Shipment` | A dead end for a read-only role |
| 14 | `/compliance/action-queue` loses overdue items after 24h | `hoursToCutoff < -24` | The most serious state disappears from the list |
| 15 | Deadline alerts and the action queue skip rejected ISFs | `backgroundJobs.ts` checks draft and submitted; `action-queue` checks draft | A rejected ISF has no clock, though it is often the most urgent item |
| 16 | The action queue has no entries in it | Only PSC and liquidation use `abiDocument` | A rejected entry never reaches the only ranked list we have |
| 17 | Action-queue snooze lives in `localStorage` | `OverviewTab.tsx:37` | Per device, invisible to teammates |
| 18 | There is no index for org + status on filings, or on the entry's `filing_id` | `schema.prisma` | Counts walk every row of the org |
| 19 | **A rejected amendment leaves no visible trace.** CBP rejects a replace and the status stays `accepted`; only `rejectedAt` changes | `isfLifecycle.ts:47`, `isfVerdicts.ts:55`, `entryLifecycle.ts:65` | The user believes the correction landed when CBP still holds the old data |
| 20 | **A rejected entry replace notifies "Entry Accepted".** The status moves from `SENT` to `ACCEPTED`, which reads as success | `entryVerdicts.ts:49-53` | A false success message. Needs its own fix (question 5) |
| 21 | A lading date with no ETD leaves `filingDeadline` empty | `filings.ts:158,369` | A real deadline with no clock |
| 22 | `/shipments` reads no URL filters, and its status list omits `on_hold`, `pending_cbp` and `amended` | `ShipmentsList.tsx:44` | Links from this page cannot land on a filtered list yet |
| 23 | `/billing/subscription` has no role check and returns card last 4, prices and invoice lines to every role | `billing.ts:381` on staging | Operators and viewers can read billing detail through the API |

Findings 14 to 16 and 19 to 21 are live gaps whatever happens to this redesign. See question 5.

## 3. Direction

I compared three directions. **The choice is not close, so I did not run the LLM Council.**

| | A. Ranked work queue (chosen) | B. Keep the board, add urgency | C. Configurable widgets |
|---|---|---|---|
| Answers "what next?" | Yes, top row | Partly, you scan four columns | Only if you set it up |
| Survives 1,000+ shipments | Yes, ranked and paged | No, columns become walls | Depends on widgets |
| Works on a phone | Yes, it is a list | Poorly | Poorly |
| Fits the brand line | "An inbox for US customs" | "Another dashboard" | "Another dashboard" |
| Cost to test | One view | One view | Combinatorial |

The prior review's suggestions hold up, with three changes:

- **Drop the "full board optional" toggle.** A second view doubles the test surface and is worst
  where it would be used most. The strip's stages link to `/shipments`, filtered. If a client asks
  for the board, it can come back as a view of that list.
- **Keep one line of health for owners and admins.** Metrics leave the page, but an owner's real
  question is "are we OK?" and a single line answers it.
- **No snooze in v1.** A legal deadline should not be hideable. Items leave the queue when the work
  is done. This is the simplest safe behaviour and it removes a whole class of "why did we miss
  that?" questions.

### What I borrowed, and why

| From | Borrowed | Left behind |
|---|---|---|
| [Linear Inbox](https://linear.app/docs/inbox) | J/K movement, single-key actions, a `?` help sheet | Unread state: our items are obligations, not messages |
| [Stripe Dashboard home](https://support.stripe.com/questions/dashboard-home-charts-overview) | Numbers beside a list of items needing action; label and period stated plainly | [Editable widgets](https://support.stripe.com/questions/customize-your-dashboard-home-page-charts-for-better-business-insights): a test matrix we cannot afford and users rarely need |
| [Flexport](https://www.flexport.com/blog/introducing-the-flexport-platform-experience-2-0-your-launchpad-for-greater/index.md) | Exceptions grouped and ranked by priority; filtering by assigned user | A separate tasks, watchlist and exceptions split: one ranked list is easier to trust |
| [Superhuman](https://help.superhuman.com/article/478-superhuman-command) | Speed as a feature; every action reachable by keyboard; no animation on keyboard actions. The 100ms figure comes from [a third-party study](https://blakecrosley.com/guides/design/superhuman), so treat it as a target, not a citation | Vim-style split navigation |
| [Descartes OneView CHB](https://www.descartes.com/sites/default/files/documents/pi_oneview_chb.pdf) and [manage by exception](https://www.mcleodsoftware.com/docs/whitepapers/McLeod_White_Paper_Manage_By_Exception_Brokers.pdf) | Brokers respond by exception: show what broke, not everything that moved | Dense terminal-era layouts |
| Apple and Emil Kowalski skills | One accent, restraint, frequency decides whether something animates | Bounce, and scale-on-press: the brand says "Press: no shrink", and the brand wins |

I could not find usable public detail on the operator views in CargoWise, Magaya or Ramp's Inbox, so
nothing is borrowed from them.

## 4. Who it serves

### 4.1 By person

| Person | First 10 seconds | How the page serves them | Differs in the UI |
|---|---|---|---|
| **Importer** (few shipments, part-time at this) | "Is anything due? Am I OK?" | Headline sentence, top rows, calm clear state | Comfortable density; plain-English reasons |
| **Customs broker / high-volume operator** | "What is on fire across my clients?" | Lanes, filters by importer, group rows, keyboard | Compact density; importer filter; `Mine` toggle |
| **Owner / admin** | "Are we OK? Can we file? Is billing fine?" | Health line, blockers with a fix button | Health line; fix buttons on blockers |
| **Operator** | "What is mine to do now?" | The queue | No billing figures. Blockers say who to ask |
| **Viewer** | "What is happening?" | Same queue, read-only | No create buttons. Row action is `Open` |
| **Platform admin** | "Is my own org fine? Do I need to go to Admin?" | Same page for their org, plus links to Admin | Small Platform row. Never cross-org data here |

### 4.2 By plan

| Plan | Queue contains | Flow strip | Upsell |
|---|---|---|---|
| **ISF only** | ISF items | `ISF to send`, `ISF sent`, `Accepted` | One quiet line under the strip, dismissible, no modal |
| **ISF + Entry** | ISF and entry items | Six stages | None |
| **Enterprise** | As above, plus tracking holds | Six stages | None |
| **Invoiced pilot** | Same as its plan | Same | Health line shows usage against the included ISFs. No card prompts anywhere |

### 4.3 By volume

| Org | Experience | Key behaviour |
|---|---|---|
| **Brand new, empty** | Setup card with real steps, then `File your first ISF` | Steps come from real state. An invited operator never sees billing steps |
| **5 shipments** | Rail hidden when empty. Queue feels like a short note | Default density comfortable |
| **100 shipments** | Lanes, chips and strip all earn their place | Default density comfortable |
| **1,000+ shipments** | 25 rows per lane with `Show more`; filters; group rows | Default density compact. Exact counts from the server. DOM capped at about 100 rows, then a link to the full list |

<!-- mock:people -->

## 5. Information architecture

### 5.1 Order on the page

| # | Block | Shown when | Job |
|---|---|---|---|
| 0 | **Blocker band** | Something stops filing | Say why, and offer the fix |
| 1 | **Headline** | Always | One sentence of truth, plus the next cutoff |
| 2 | **Actions** | Not for viewers | `New shipment`, then `New entry` by plan, `Manifest query` in a menu |
| 3 | **Flow strip** | Org has any shipment | Where everything is. Each stage is a link |
| 4 | **Filter chips** | Queue has items | Counts and filters are the same object, so counts appear in one place |
| 5 | **Queue** | Always | The work, in lanes: Now, Soon, Later |
| 6 | **Rail: Next 72 hours** | A cutoff exists within 72h | See a crunch coming |
| 7 | **Rail: Awaiting response** | Anything sent | What you are waiting on, with age only |
| 8 | **Rail: Recent** | Any activity | What just changed |
| 9 | **Health line** | Owner and admin | Are we OK |
| 10 | **Platform row** | Platform admin | Links to Admin |

### 5.2 What leaves the page

| Removed | Goes to | Why |
|---|---|---|
| KPI tiles and sparklines | Compliance, new "Volume" block | Trends are not a daily need; they repeat the headline |
| Acceptance rate | Compliance | Same, and it is misleading at low volume |
| Four-column board | Replaced by strip and queue | Does not scale, shows status rather than action |
| Greeting and clock | Removed | The sentence is worth more than a greeting. Date moves to the small meta line |
| Aurora, count-ups, pings, tile cascade | Removed | Decoration on a screen people see all day |
| Horizontal activity strip | Rail: Recent | Becomes a readable list |
| Liquidation notices | Stay in Compliance | Informational, nothing to do |

### 5.3 Honest stages

The strip counts live work, so each live shipment sits in exactly one stage. The server owns this
logic and tests it against every status. Stage names say what is true.

The first matching rule wins:

| Order | Stage key | Label | Rule | Replaces |
|---|---|---|---|---|
| 1 | none | Not counted | Cancelled, deleted at CBP, or aged out of the windows below | |
| 2 | `isf_sent` | ISF sent | ISF `pendingAction` set, or `submitted`, `pending_cbp`, `on_hold`, or `amended` with an action in flight | Part of "ISF Filed" |
| 3 | `entry_sent` | Entry sent | Entry `SENDING` or `SENT`, or `pendingAction` set | Part of "Entry Filed" |
| 4 | `entry_to_send` | Entry to send | Entry `DRAFT` or `REJECTED` | Part of "Entry Filed" |
| 5 | `accepted` | Accepted, 30 days | Entry `ACCEPTED` in the last 30 days. On ISF-only plans: ISF accepted in the last 30 days | "Cleared" |
| 6 | `isf_to_send` | ISF to send | Filing `draft`, or `rejected` with CBP holding nothing | Part of "ISF Filed" |
| 7 | `entry_needed` | Ready for entry | ISF-10 accepted or amended, nothing in flight, no entry, and inside the arrival window below. ABI plans only | "Manifest Verified" |

The **arrival window** keeps `entry_needed` finite, because an entry filed in another system never
shows up here. A shipment counts while its arrival is unknown and the ISF was accepted in the last
60 days, or its arrival is at most 15 days past. After that it leaves the strip. ISF-5 is excluded.

A shipment with several entries takes the stage of its most urgent entry.

Wording rules:

- **"Sent", never "with CBP".** A transmission can be queued, or its delivery can be unknown, so
  saying it is with CBP would claim more than we know.
- **"Cleared" and "Released" are not used on this page.** An accepted entry reads `Summary accepted`.
  When `releaseRequested` is true and `cargoReleaseStatus` is `ACCEPTED`, it reads `Release accepted`.
  That value comes from the SX response. The SO cargo release message is recorded but not stored on
  the entry, so we cannot yet say a release happened. Showing "Released" needs SO stored first.

## 6. Layouts

The shell stays: 256px dark sidebar at 1280 and up, drawer below it, a 56px glass header and
`main` with 24px padding. The page width cap of 1500px stays.

Live mockups of every layout appear in the Artifact: sample data at each width, in light and dark,
with a wireframe switch.

<!-- mock:gallery -->

### 6.1 Desktop, 1440

```
+--------+----------------------------------------------------------------------------+
| SIDE   |                                                         [bell] [avatar]    |
| BAR    |  3 items need you now. Next cutoff in 4h 12m.     [Manifest v] [New +]   |
| 256    |  Fri, Oct 30 · Updated 12s ago                                             |
|        |                                                                            |
|        |  ISF to send | ISF sent | Ready for entry | Entry to send | Entry sent | Accepted
|        |      14      |      22      |       9         |       4       |     11      |  63
|        |                                                                            |
|        |  [All 28] [Overdue 1] [Due today 2] [Rejected 3] [No response 1]  Mine  Importer v
|        |  +--------------------------------------------+  +-----------------------+ |
|        |  | NOW                                        |  | NEXT 72 HOURS         | |
|        |  | [ISF due in 4h 12m]  COSU6287340    [Finish]|  |  ▂ ▅ ▂ ▁ █ ▂ ▁ ▃ ▂ ▁ │ |
|        |  | [Rejected]           MAEU2241890    [Fix]  |  +-----------------------+ |
|        |  | [Overdue 3h]         12 house bills [Open] |  | AWAITING RESPONSE  33 | |
|        |  +--------------------------------------------+  |  HBL ...   sent 34m   | |
|        |  | SOON  16                                   |  |  ENT ...   sent 2h    | |
|        |  | ...                                        |  +-----------------------+ |
|        |  | LATER  9                                   |  | RECENT                | |
|        |  +--------------------------------------------+  +-----------------------+ |
|        |  Oct: 42 ISFs accepted · 3 rejected · 18 of 25 included ISFs used          |
+--------+----------------------------------------------------------------------------+
```

Grid: `minmax(0,1fr) 320px`, gap 24. Queue is one surface with hairline rows.

### 6.2 Laptop, 1280

Same structure. The sidebar stays, so `main` is 976px wide. The rail narrows to 280px, and row
meta drops the route ("Busan to Long Beach"). `Manifest query` stays in the menu.

```
+-------+----------------------------------------------------------------+
| SIDE  | 3 items need you now. Next cutoff in 4h 12m.         [New +] |
|       | ISF 14 | Sent 22 | Ready 9 | Entry 4 | Sent 11 | Accepted 63     |
|       | [All] [Overdue] [Due today] [Rejected] [No resp.]      Mine  v    |
|       | +-----------------------------------+ +-------------------+    |
|       | | queue                             | | Next 72 hours     |    |
|       | |                                   | | Awaiting response |    |
|       | +-----------------------------------+ +-------------------+    |
+-------+----------------------------------------------------------------+
```

### 6.3 Tablet landscape, 1133

The sidebar becomes a drawer, so `main` is 1085px. Two columns stay, with a 300px rail. All
touch targets are 44px high. Hover-only controls use the `can-hover:` variant.

```
+--------------------------------------------------------------------+
| [=]                                                  [bell] [avatar]|
| 3 items need you now. Next cutoff in 4h 12m.             [New +]  |
| ISF 14 | Sent 22 | Ready 9 | Entry 4 | Sent 11 | Accepted 63          |
| [All] [Overdue] [Due today] [Rejected] [No resp.]             Filter v |
| +---------------------------------------+ +---------------------+   |
| | queue                                 | | rail                |   |
| +---------------------------------------+ +---------------------+   |
+--------------------------------------------------------------------+
```

### 6.4 Tablet portrait, 744

One column. `main` is 696px. The horizon sits between the chips and the queue only when a cutoff is
within 24 hours. Awaiting response and Recent become closed disclosure rows below the queue.

```
+----------------------------------------------+
| [=]                          [bell] [avatar] |
| 3 items need you now.             [New +]   |
| Next cutoff in 4h 12m.                       |
| ISF 14 | Sent 22 | Ready 9                   |
| Entry 4 | Sent 11 | Accepted 63              |
| [All] [Overdue] [Due today] [Rejected] >     |
| +------------------------------------------+ |
| | NOW                                      | |
| | ISF due in 4h 12m             [Finish]   | |
| | COSU6287340 · Acme Imports               | |
| +------------------------------------------+ |
| > Awaiting response  33                      |
| > Recent                                     |
+----------------------------------------------+
```

### 6.5 Phone, 390

One column, 16px gutter (the page offsets `main`'s 24px padding by 8px on each side, so other pages
stay untouched). Strip becomes a 3 by 2 grid. Chips scroll inside their own row. The whole row is
the tap target for its primary action. 96px bottom padding clears the chat button.

```
+----------------------------------+
| [=]                 [bell] [AV]  |
| 3 items need you now.     [+]   |
| Next cutoff in 4h 12m.           |
| +--------+--------+--------+     |
| | ISF 14 |Sent 22 | Ready 9|     |
| | Ent  4 |Sent 11 | Acc 63 |     |
| +--------+--------+--------+     |
| [All 28] [Overdue 1] [Due t >    |
| NOW                              |
| ISF due                  4h 12m  |
| COSU6287340 · Acme Imports     > |
| ------------------------------   |
| Rejected: invalid MID            |
| MAEU2241890 · Northwind        > |
| ------------------------------   |
| SOON 16                          |
| ...                              |
| > Awaiting response  33           |
| > Recent                         |
+----------------------------------+
```

### 6.6 Key states

| State | Trigger | What shows |
|---|---|---|
| **Empty** | No filings and no entries | Setup card replacing strip, chips and queue. Steps: CBP details if they are needed, payment if the plan requires it and this user can fix it, then `File your first ISF`. Email and 2FA are not steps, because `ProtectedRoute` handles them before this page loads |
| **Loading** | First load only | Skeletons with the exact final geometry: headline, 6 stage cells, 5 chips, 6 rows. `aria-busy`. No skeleton on refetch |
| **Error, no data** | First load failed | Inline panel: "We could not load your work." plus `Try again` and links to `Shipments` and `Entry documents`, so nobody is stuck |
| **Error, stale data** | Refetch failed | Keep the page. Meta line becomes "Could not refresh. Showing 2:03 PM" with `Retry`. Countdown keeps running from stored times |
| **Clear** | Zero in Now and Soon | Empty Focus Frame. "Nothing needs you right now." then "Next cutoff Nov 3, 4:00 PM · 33 awaiting a response". Later lane stays reachable |
| **Overloaded** | 200+ in Now or Soon | Headline says the count and the overdue count. Density defaults to compact. Lanes cap at 25. Group rows collapse consolidations. A "Filter by importer" hint appears |
| **Blocked** | `canFile` false, billing hold, or CBP setup | Blocker band above everything. Queue still shows, with send actions disabled and the reason on hover and focus |
| **Partial** | One data source fails | Each rail block fails alone with a one-line retry. Queue failure uses the error state |

<!-- mock:states -->

## 7. Visual system

Everything builds on the existing tokens in `src/index.css`. No new primary colour, no new font.

### 7.1 Type scale

| Role | Size / line | Weight | Tracking | Used for |
|---|---|---|---|---|
| Headline | 28 / 34 (phone 22 / 28) | 600 | -0.02em | The sentence |
| Section | 15 / 20 | 600 | -0.01em | Rail titles |
| Row title | 14 / 20 | 550 | 0 | The reason |
| Body | 13 / 18 | 400 | 0 | Row meta |
| Numeric | 13 / 18, mono | 600 | 0 | Countdowns, counts |
| Ref | 12.5 / 18, mono | 500 | 0 | BOL and entry numbers |
| Stage count | 22 / 26 | 600 | -0.01em | Flow strip |
| Eyebrow | 11 / 14 | 600 | +0.14em | Lane names |

The page has no text below 11px. Today it goes down to 10px. All digits use tabular numerals.

### 7.2 Colour tokens

New semantic tokens, defined in HSL components like the rest of `index.css`. Contrast is measured
against `--card` in each theme and meets 4.5:1 (see the check in the delivery plan).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--urgent-fg` | `0 72% 40%` | `0 90% 74%` | Overdue, rejected text and icons |
| `--urgent-tint` | `0 72% 51% / 0.08` | `0 90% 70% / 0.12` | Pill backgrounds |
| `--soon-fg` | `30 90% 30%` | `38 92% 64%` | Due soon |
| `--soon-tint` | `38 92% 50% / 0.12` | `38 92% 56% / 0.12` | Pill backgrounds |
| `--calm-fg` | `220 14% 40%` | `215 20% 66%` | Later, waiting |
| `--done-fg` | `160 84% 24%` | `160 60% 56%` | Accepted |
| `--focus-frame` | `222 47% 22%` | `43 96% 56%` | Focus Frame brackets |
| `--focus-subject` | `43 96% 56%` | `43 96% 56%` | The gold subject square in the empty state |

Rules: gold is never text on a light surface. Colour is never the only signal, so every urgency
state has an icon and words. Stage hues appear in the flow strip only, as the brand requires.

<!-- mock:tokens -->

### 7.3 Spacing and shape

- 4px grid. Page sections 24px apart, rows 12 to 14px vertical padding, surfaces 16 to 20px inner.
- Rows are 64px comfortable and 44px compact. Phone rows are at least 64px.
- Radius: 12px surfaces, 8px controls, full for pills.
- One surface per concern. The queue is one card with hairline rows, which removes the "many large
  cards" problem by itself.

### 7.4 Elevation

| Level | Light | Dark |
|---|---|---|
| Page | `--background` | `--background` |
| Surface | `--card`, 1px `--border`, `shadow-card` | `--card`, 1px `--border`, no shadow |
| Raised (menus, shortcut sheet) | `shadow-popover` | 1px lighter border, no shadow |
| Sticky chips | 85% `--card` with 16px blur | Same. Solid under `prefers-reduced-transparency` |

### 7.5 The Focus Frame

Four 12px corner brackets, 2px stroke, on the current row, drawn with absolutely positioned
pseudo-elements so they cause no layout shift. The current row is the first row on load, then
wherever the keyboard or a click puts it. Mouse hover uses an ordinary tint and does not move the
frame.

## 8. Component inventory

All new files live in `src/components/dashboard/`. `Dashboard.tsx` becomes a thin container of about
120 lines. Each component stays under 200 lines.

### 8.1 New

| Component | Props | States |
|---|---|---|
| `DashboardHeadline` | `attention, generatedAt, isStale, onRetry` | counted, clear, stale, overloaded |
| `BlockerBand` | `blockers, canFix` | one, many (`+1 more`) |
| `FlowStrip` | `stages, density` | full, ISF-only, zero stage, loading |
| `FilterChips` | `filters, active, onChange` | selected, zero (disabled), scrolling |
| `ActionQueue` | `lanes, density, onLoadMore, focusId` | populated, filtered-empty, loading, error |
| `QueueLane` | `lane, count, items, hasMore` | collapsed (Later only), expanded |
| `ActionRow` | `item, density, current, canAct` | default, current, hover, disabled, group, new, leaving |
| `GroupRow` | `item, expanded, onToggle` | collapsed, expanded |
| `DeadlinePill` | `dueAt, basis, kind` | overdue, urgent, soon, calm, estimated, none |
| `CutoffHorizon` | `buckets, onSelectBucket` | populated, sparse, hidden |
| `AwaitingPanel` | `count, noResponseCount, items` | populated, no-response, unknown, empty, error |
| `RecentPanel` | `items` | populated, empty, error |
| `HealthLine` | `month, subscription` | card, invoiced, hidden |
| `SetupCard` | `steps` | steps by role and plan, all done |
| `ClearState` | `nextCutoffAt, withCbpCount` | with next cutoff, without |
| `ShortcutSheet` | `open, onClose` | open |
| `useDashboard` | `{ mine, importer }` | React Query hook |
| `useQueueKeyboard` | `items, onOpen` | j, k, Enter, o, ?, only with focus in the queue |
| `useNow` | `intervalMs` | shared 30s tick for countdowns |

### 8.2 Changed

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | Becomes a flag switch: renders `DashboardV2` or the current page, which moves unchanged to `DashboardClassic.tsx`. V2 keeps the `?welcome=` `CelebrationModal` that `UpgradeSuccessPage` relies on |
| `src/hooks/useNotificationStream.ts` | Also invalidates `['dashboard']`, at most once per 15 seconds |
| `src/pages/CompliancePage.tsx` / `OverviewTab.tsx` | Gains the "Volume" block that receives the KPI trends |
| `src/index.css` | Adds the semantic tokens |
| `src/api/client.ts` | Adds `dashboardApi` and its types |
| `src/pages/ShipmentsList.tsx`, `src/pages/ABIDocumentsListPage.tsx` | Read `?stage=` from the URL so strip links land on a filtered list. Shipments adds the missing statuses |
| `server/src/routes/filings.ts` | List accepts `stage` |
| `server/src/config/env.ts`, `docker-compose*.yml`, `routes/auth.ts` | `DASHBOARD_V2` setting, added to the compose `environment:` list and returned by `/auth/me` |
| `server/src/routes/billing.ts` | `/subscription` trims card, prices and invoice lines for operators and viewers |
| `src/components/AppSidebar.tsx` | Nav label only, if you approve the rename (question 1) |
| `tests/e2e/specs/sweep.spec.ts` | Adds 744, 1133 and 1280 for `/` |

### 8.3 Removed, after the soak

`DashboardClassic.tsx`, `ShipmentCard`, `PipelineColumn`, `KpiCard`, `ActivityStrip` and `EmptyHero`
(all defined inside the page today), and `src/lib/acceptanceRate.ts` once Compliance owns the number.
`Sparkline` stays only if Compliance uses it. `LifecycleWidget` stays, since it serves the shipment
page, but its four labels change to match section 5.3 so the product speaks one language.

## 9. Data and API

### 9.1 Endpoints

```
GET /api/v1/dashboard
GET /api/v1/dashboard/actions?lane=&filter=&mine=&importer=&group=&cursor=&limit=
```

The first returns everything one page load needs in a single round trip. The second handles
filters and paging. Both use `authMiddleware`, take `orgId` only from `req.user`, and set
`Cache-Control: private, no-store`. Errors use the app's existing `{ error, code }` shape.

### 9.2 Response shape

```ts
export interface DashboardResponse {
  generatedAt: string;              // ISO. The client's clock for "Updated 12s ago".
  isEmpty: boolean;                 // No filings and no entries at all.
  attention: {
    now: number;                    // Exact count, Now lane.
    soon: number;                   // Exact count, Soon lane.
    later: number;                  // Exact count, Later lane.
    overdue: number;                // Subset of now.
    nextCutoffAt: string | null;    // Soonest future ISF cutoff among open ISFs.
  };
  flow: Array<{
    key: 'isf_to_send' | 'isf_sent' | 'entry_needed'
       | 'entry_to_send' | 'entry_sent' | 'accepted';
    label: string;
    count: number;                  // Each live shipment in exactly one stage.
    href: string;                   // Filtered list link.
  }>;
  filters: Array<{ key: ActionFilter; label: string; count: number }>;
  horizon: {
    startsAt: string;
    bucketHours: 6;
    buckets: number[];              // 12 buckets, next 72 hours.
  } | null;                         // Null when no cutoff is within 72 hours.
  lanes: Array<{
    lane: 'now' | 'soon' | 'later';
    total: number;
    items: ActionItem[];            // First 25.
    nextCursor: string | null;
  }>;
  awaiting: {
    count: number;
    noResponse: number;             // Past NO_ANSWER_MINUTES, or outcome unknown.
    items: Array<{ id: string; ref: string; kind: 'isf' | 'entry';
                   state: 'QUEUED' | 'SENT' | 'NO_RESPONSE' | 'UNKNOWN' | 'CONDITIONAL';
                   sentAt: string | null; href: string }>;
  };
  recent: Array<{ id: string; at: string; text: string; href: string }>;  // Latest 8.
  month: { isfAccepted: number; isfRejected: number; entriesAccepted: number } | null;
                                    // Owner and admin only. Null for other roles.
  blockers: Blocker[];
  setup: SetupStep[] | null;        // Non-null only while isEmpty.
}

export interface ActionItem {
  id: string;                       // Stable, e.g. "isf:<uuid>" or "group:<consolidationId>".
  kind: ActionKind;
  lane: 'now' | 'soon' | 'later';
  title: string;                    // "ISF due", "Rejected: invalid manufacturer ID".
  ref: string;                      // House bill, master bill or entry number.
  party: string | null;             // Importer name.
  meta: string | null;              // "Busan to Long Beach · ETD Nov 2".
  due: { at: string; basis: 'LADING' | 'ETD_ESTIMATE' } | null;
  occurredAt: string;
  group: { id: string; count: number; label: string } | null;   // Children load on expand.
  primary: { label: string; href: string; enabled: boolean; disabledReason: string | null };
}

export type ActionKind =
  | 'isf_overdue' | 'isf_due' | 'isf_rejected' | 'isf_change_rejected'
  | 'isf_no_date' | 'isf_on_hold' | 'isf_draft'
  | 'entry_rejected' | 'entry_change_rejected' | 'entry_release_rejected'
  | 'entry_draft' | 'entry_needed'
  | 'cbp_no_response' | 'cbp_outcome_unknown' | 'cbp_conditional' | 'tracking_hold';

export type ActionFilter = 'all' | 'overdue' | 'due_today' | 'rejected' | 'no_response';

export interface Blocker {
  code: 'BILLING_HOLD' | 'PAYMENT_FAILED' | 'NO_PAYMENT_METHOD' | 'NO_PLAN'
      | 'ENTRY_PRICING_MISSING' | 'CBP_SETUP_INCOMPLETE' | 'SERVICE_CENTER_NOT_APPROVED';
  scope: 'all' | 'isf' | 'entry';   // What it stops. A setup gap can stop entries while ISFs still go.
  title: string;
  detail: string;
  fix: { label: string; href: string } | null;    // Null when this user cannot fix it.
}

export interface SetupStep { key: string; label: string; done: boolean; href: string | null }
```

`GET /dashboard/actions` returns `{ items: ActionItem[]; nextCursor: string | null; total: number }`.
Query rules: `lane` and `filter` are enums, `mine` is boolean, `importer` is a string of at most 255
characters (the column's limit), `group` is a uuid, `limit` is 1 to 50 (default 25), and `cursor` is opaque and
base64-encoded. Anything else returns 400.

Blockers come from `getOrgEntitlements` and `OrgCbpConfig`. Card blockers apply only when
`billingMode` is `card` and the plan needs a payment method, so an invoiced pilot never sees one.
`CBP_SETUP_INCOMPLETE` uses `scope: 'entry'` when the org files ISFs under S7P, because those still
go out. `ENTRY_PRICING_MISSING` mirrors the check in `abiWrite.ts`.

`title`, `meta` and `recent.text` are server templates with fixed wording. Rejection detail passes
through `parseRejectionReason`, and stored history messages are never copied into this payload,
because stored text can name systems that product copy must not name.

### 9.3 Urgency rules

Ranking is one pure function, `rankAction`, in `server/src/services/dashboard/rules.ts`, with a test
for every row. The sort is `lane`, then `due.at` ascending with nulls last, then `occurredAt`
descending, then `id` so the order is stable.

The first matching row wins, so a shipment appears once. Rows below are in match order.

| Kind | Lane | Rule | Primary action |
|---|---|---|---|
| `isf_change_rejected` | Now | ISF `accepted`, nothing in flight, `rejectedAt` later than `amendedAt` and `acceptedAt`. Title: "CBP rejected your change. The earlier version is still on file." | `Review change` |
| `entry_change_rejected` | Now | Entry `ACCEPTED`, nothing in flight, `lastError` set | `Review change` |
| `entry_release_rejected` | Now | `cargoReleaseStatus` is `REJECTED`, summary on file | `Replace entry` |
| `isf_rejected` | Now | `rejected`, CBP holds nothing, within 7 days of cutoff or no cutoff. The pill shows time left or time over | `Fix ISF` |
| `entry_rejected` | Now | Entry `REJECTED`, CBP holds nothing | `Fix entry` |
| `isf_overdue` | Now | Draft past its cutoff, within 7 days | `Finish ISF` |
| `isf_due` | Now | Draft with cutoff within 24h | `Finish ISF` |
| `cbp_outcome_unknown` | Now | Latest transmission `UNKNOWN`, action in flight | `Open` |
| `cbp_no_response` | Now | Latest transmission `SENT`, action in flight, past `NO_ANSWER_MINUTES` | `Open` |
| `cbp_conditional` | Now | Latest transmission `CONDITIONAL`, action in flight. Read the response | `Open` |
| `isf_on_hold` | Now | Filing `on_hold` | `Review hold` |
| `entry_needed` | Now | Arrived, no entry, arrival at most 15 days past | `Start entry` |
| `isf_due` | Soon | Draft with cutoff within 72h | `Finish ISF` |
| `isf_no_date` | Soon | Draft with no ETD and no lading date, so no clock can run | `Add sailing date` |
| `entry_needed` | Soon | Arrival within 5 days | `Start entry` |
| `tracking_hold` | Soon | `hasHolds`, not already shown for this shipment. `CONTAINER_TRACKING` capability | `View hold` |
| `isf_draft` | Later | Draft, cutoff beyond 72h | `Finish ISF` |
| `entry_draft` | Later | Entry draft | `Finish entry` |
| `entry_needed` | Later | Arrival further out, or unknown, inside the window in 5.3 | `Start entry` |
| `isf_overdue`, `isf_rejected` | Later | More than 7 days past cutoff | `Open` |

Details that matter:

- **Transmissions.** `cert_transmission` rows are excluded. The kinds key on the entity having an
  action in flight, so a response that already settled it cannot raise a row.
- **Groups.** Rows with the same `consolidationId` and kind collapse into one group row, in SQL and
  before the limit, so paging stays correct. Its `due` is the earliest in the group, and lane counts
  stay at shipment level. The row says "12 house bills", and its primary action expands it inline
  through `/dashboard/actions?group=`. There is no group page.
- **Estimated deadlines say so.** `basis: 'ETD_ESTIMATE'` renders as `Est. 4h 12m`, with a tooltip
  explaining that adding a lading date makes it exact.
- **The clock never promises CBP's behaviour.** The Awaiting panel shows how long ago something was
  sent. It never says when a response will arrive. `NO_ANSWER_MINUTES` stays an internal threshold,
  and the copy is "No response yet".
- **Left out of v1, on purpose.** UFLPA needs a parse of party JSON for every open filing. PSC needs
  the entry date inside `payload`. Both stay in Compliance, so this endpoint reads no row JSON.
  In-bond is out because nothing writes `REJECTED` or `TRANSMITTED` today, and a rejected in-bond
  cannot be edited.

Regulatory basis, checked against the text of the rule where available:

| Rule | Source | Used for |
|---|---|---|
| ISF due 24 hours before lading at the foreign port | [19 CFR 149.2(b)](https://www.law.cornell.edu/cfr/text/19/149.2) | `isf_due`, already in `isfDeadline.ts` |
| FROB data is due before lading, not 24 hours before | 19 CFR 149.2(b)(4) | Open question 6 |
| Entry within 15 calendar days after landing | [19 CFR 142.2(a)](https://www.law.cornell.edu/cfr/text/19/142.2) | The 15-day arrival window in 5.3, and later an entry-due clock |
| Entry summary within 10 working days after the time of entry | [19 CFR 142.12(b)](https://www.law.cornell.edu/cfr/text/19/142.12) | Later |

### 9.4 Queries

The server reads scalar columns of live shipments and classifies them in `rules.ts`. No row JSON is
read. This replaces the SQL `UNION` first proposed here, because rules in both SQL and TypeScript
would drift, and a deadline rule must have one source.

1. **Filings and entries.** Columns for live rows only, bounded by the windows in 5.3.
2. **Transmissions.** Only for rows with an action in flight, by `lastTransmissionId`.
3. **Classify.** `assemble` makes one pass, and counts, stages and rows all come from it, so they
   cannot disagree. Sorting and paging happen on that result, with keyset cursors.

Standalone entries (no `filingId`) count as shipments, and filings with two entries use the most
urgent entry rather than only the latest.

### 9.5 Prisma changes

```prisma
model Filing {
  @@index([orgId, status, filingDeadline])
}
model AbiDocument {
  @@index([orgId, filingId, updatedAt(sort: Desc)])
}
model Filing {
  @@index([orgId, updatedAt(sort: Desc)])   // Recent panel.
}
```

Additive only. No new tables and no new columns. Prod has little data today, so plain `CREATE
INDEX` is fine; if that changes before release, use one `CONCURRENTLY` migration per index.

No data migration. The cutoff is computed from the dates at read time, so old `filingDeadline` values
cannot mislead this page, and live alert timing does not change.

### 9.6 Measured, on a scratch database

Synthetic data: 1.13M filings and 780k entries across 405 orgs, with realistic JSON widths, on
Postgres 14 on this laptop, warm cache. These are directional, and must be remeasured on a staging
copy before Phase 2 closes.

| Query | Org size | Today's indexes | With composite indexes |
|---|---|---|---|
| Status counts | 120,000 | 45 ms | **8 ms** (index-only) |
| Status counts | 12,000 | 6 ms | **1 ms** |
| Top 50 by deadline | 120,000 | 5 ms | 9 ms, same plan: the global deadline index |
| Top 50 by deadline | 12,000 | 4 ms | **1 ms** |
| Stage counts with latest entry | 120,000 | 120 ms | 120 to 200 ms, **no gain** |
| Stage counts with latest entry | 12,000 | 13 ms | 11 ms |

So the index earns its place for counts, and it does nothing for the stage query at the largest
size. That query needs the design in 9.4: scope to live filings and the windows in 5.3.
The numbers above are for the unscoped worst case.

Measured again on the built endpoint, on a real Postgres with the real migrations, synthetic data
in which open rows never age out, so the live set is larger than a real org's:

| Org size | Live rows | p50 | Budget |
|---|---|---|---|
| 12,000 filings | about 2,000 | **70 ms** | 150 ms, met |
| 1,000 filings | about 170 | 22 ms | met |
| 120,000 filings | about 35,000 | **1,200 ms** | 400 ms, **not met** |

The miss is mostly loading the live rows. No org is near this size, so nothing is added for it now.
`dashboard.load` logs duration and open count per request. **Revisit if any org passes 30,000 filings
or the log shows more than 400 ms.**

### 9.7 Caching

**No server cache in v1.** At realistic sizes the queries take low tens of milliseconds, and a
cache would make the page stale right after someone fixes something, which is the moment they are
looking. Add a short per-org cache only if p95 exceeds budget on a staging copy.

On the client: `staleTime: 15s`, `gcTime: 5m`, keep previous data while filtering.

### 9.8 Live updates

Three layers, simplest first:

1. **Stream.** On any `notification` event, `useNotificationStream` invalidates `['dashboard']`, at
   most once per 15 seconds. A burst of events must not spend the 100-per-minute API limit, which a
   whole office shares behind one IP.
2. **Polling.** `refetchInterval: 60s` while the tab is visible, and refetch on focus. This is what
   viewers rely on, since they receive no action notifications. It also covers changes that raise no
   event, and a stream that dropped.
3. **Local clock.** Countdowns tick every 30 seconds from stored times, with no network. A row
   crossing a threshold changes colour by itself.

Rows never reshuffle under someone. If the pointer or keyboard focus is inside the queue, updates
wait behind a small `2 updates` button, and apply at once when focus leaves. Removal of the row
someone just fixed always applies.

No new SSE channel in v1. If a real org needs faster updates, an org-scoped `dashboard_changed`
signal can be added without changing the client contract.

## 10. Motion and interaction

The rule from the Emil skill decides everything here: **how often is this seen?** A page opened
dozens of times a day barely moves.

| What | Motion | Why | Reduced motion |
|---|---|---|---|
| Page load | None. Content is there | Seen all day | Same |
| Refetch | None. Numbers swap | Count-ups show wrong numbers for a second | Same |
| Focus Frame, first load of a session | Brackets close from +6px, 220ms, `--ease-out`, once | The signature: seen once per session, explains where you are | Appears, no movement |
| Focus Frame, j/k | **Instant** | Keyboard actions never animate | Same |
| Row added | Fade 180ms, tint fades over 1.2s | Shows what is new | Tint only |
| Row removed after fixing | Height and opacity, 200ms | Prevents a jump, confirms the work left | Opacity only, 120ms |
| Countdown crosses a threshold | Colour, 200ms | State change, no alarm | Same, colour is safe |
| Row hover | Background tint, 120ms, `can-hover:` only | Feedback | Same |
| Row press | Background tint, instant | Brand rule: no shrink on press | Same |
| Group expand | Height 200ms | Spatial continuity | Instant |
| Chip change | None | Used constantly | Same |
| Shortcut sheet | Fade and 4px rise, 160ms | Rare | Fade |
| Horizon bars | None | Data should not perform | Same |

All of this is CSS transitions and uses no Framer Motion, which keeps it interruptible and keeps
Framer out of this chunk. Hold-to-confirm and other gestures are not needed: nothing on this page
transmits to CBP. Every action navigates to the page that does.

### Keyboard

Shortcuts work only while focus is inside the queue, which satisfies WCAG 2.1.4 without a settings
toggle.

| Key | Action |
|---|---|
| `j` / `k` or arrows | Next or previous row, instant |
| `Enter` | Primary action |
| `o` | Open the record |
| `Space` | Expand or collapse a group |
| `1` to `5` | Switch filter chip |
| `?` | Shortcut sheet |
| `Esc` | Close sheet, clear filter |

`Tab` works normally for everyone. The queue has one entry point (roving tabindex), so reaching
the rail never takes 50 tabs.

## 11. Accessibility, performance and security

### 11.1 WCAG 2.1 AA

- **Structure:** one `h1` (the sentence), `h2` for lanes and rail titles, landmarks for main and
  complementary.
- **Lists:** the queue is a real `<ul>` of rows, each with a real link and button. It does not use
  `role="listbox"`, which forbids nested controls.
- **Status by more than colour** (1.4.1): every urgency has icon and words.
- **Contrast** (1.4.3, 1.4.11): 4.5:1 text and 3:1 for icons, focus and borders that carry meaning,
  checked for both themes.
- **Reflow** (1.4.10): 320px wide with no sideways page scroll. Text zoom 200% holds.
- **Countdowns:** `<time datetime>` with a full date in accessible text. Not a live region, because
  a ticking announcement is unusable.
- **Live region:** one polite region announcing only changes in the Now count, at most once a
  minute.
- **Focus:** never lost. If the focused row leaves, focus moves to the next row. Rings stay at 2px
  with a 2px offset.
- **Targets:** 44px on touch. **Hover:** nothing is hover-only.
- **Reduced motion, reduced transparency and increased contrast** are all honoured.
- **Horizon chart:** has a text equivalent, "6 cutoffs in the next 24 hours, 11 in the next 72."
- **Tested with** axe, keyboard-only, VoiceOver on macOS and iOS.

### 11.2 Performance budgets

| Metric | Budget | How it is checked |
|---|---|---|
| `GET /dashboard` p95, 12,000-filing org | ≤ 150 ms | Logged, staging copy |
| `GET /dashboard` p95, 120,000-filing org | ≤ 400 ms. **Not met: 1,200 ms, see 9.6** | Same |
| Response size | ≤ 40 KB raw | Playwright |
| Page chunk | ≤ 30 KB gzip, no Recharts, no Framer Motion | Build output |
| LCP | ≤ 2.0 s, 4G, cached shell | Lighthouse on staging |
| CLS | ≤ 0.02 | Skeleton matches final geometry |
| INP | ≤ 150 ms | Playwright trace |
| Requests on load | 1 for data, plus the existing subscription and bell | Network assertion |
| DOM rows | ≤ 100 | Test at 1,000+ |

A baseline of today's page gets recorded in Phase 0, so the improvement is measured rather than
claimed.

### 11.3 Security

- **Org isolation:** `orgId` comes only from `req.user`. Every SQL branch includes it, and a test
  creates two orgs and asserts no crossover on every source in the `UNION`.
- **Raw SQL:** Prisma tagged template only, no string building. Enums validated with zod.
- **Roles:** the server decides `primary.enabled`, `blockers[].fix` and what appears. The client only
  displays it. Writes stay protected by the existing viewer gate in `auth.ts`.
- **Plan gating:** capability filters are applied in SQL. A test asserts an ISF-only org receives no
  entry, in-bond or tracking data.
- **Platform admins:** this endpoint never reads another org. `isPlatformAdmin` adds links only.
- **Billing data:** dollars and usage appear only for owners and admins, matching `canManage`. This
  needs a server change, because `/billing/subscription` returns them to every role today (finding
  23). Phase 4 trims that response by role.
- **Text:** rejection text is translated and rendered as text, never as HTML.
- **Rate limits:** the existing `generalLimiter` applies. Worst case is about 5 requests per minute
  per tab.
- **Caching:** `private, no-store`, so a shared proxy cannot keep it.
- **Copy:** a test checks the rendered page and payload for banned terms: "CBP ABI certified",
  "direct connection", "CustomsCity", "gateway", "cleared", "released", "with CBP", "within
  minutes" and "usually". Every other statement about timing is caught in review.

## 12. Delivery

### 12.1 Phases

Each phase is independently shippable to `staging`. Work branches from `origin/staging`. Phase 0 can
go out with the next regular release. Nothing else reaches prod until Phase 9.

| Phase | Ships | Scope | Tests | Est. |
|---|---|---|---|---|
| **0. Honest labels** | Current page only: true labels, drafts split out, today's baseline measured. No flag | XS, 2 files | Unit | 0.5 d |
| **1. Rules and data** | `DASHBOARD_V2` setting, indexes, `rules.ts`, both endpoints. No UI change | L, split into three PRs | Unit for every rule and status; org isolation; plan gating; query timing | 4.5 d |
| **2. Queue** | Flagged v2 page for staff: headline, chips, queue, deadline pills at all widths, `?welcome=` | M | Component; Playwright core path | 2.5 d |
| **3. Strip and rail** | Flow strip, Awaiting, Recent, horizon, `?stage=` on both lists | M | Component; 744 and 390 layouts | 2.5 d |
| **4. Every user** | Blockers, setup card, viewer, operator, owner, platform admin, ISF-only, invoiced pilot, billing response trimmed | M | Playwright matrix per role and plan | 2 d |
| **5. Every state** | Empty, clear, error, stale, partial, overloaded; fixtures for 5, 100, 1,000, 10,000 | S | Visual check; 1,000-row test | 1 d |
| **6. Speed** | Keyboard, density, groups, live updates, deferred reshuffle | M | Keyboard tests; stream mock | 1.5 d |
| **7. Metrics move** | Volume block on Compliance, label updates in `LifecycleWidget` | S | Component | 0.5 d |
| **8. Polish and proof** | Dark mode pass, motion pass, axe, VoiceOver, budgets, sweep at 5 widths | S | Full sweep; Lighthouse | 1 d |
| **9. Rollout** | Flag to all on staging, your review, then prod, soak, remove the old page | S | Smoke | 0.5 d + soak |

**Total: about 17 working days of build and verification**, or about four weeks on the calendar
with your staging reviews. This is an honest estimate for one focused stream, and the range is 15 to
21 days. Phases 1 and 2 hold most of the risk, so the end of Phase 2 is the right time to re-estimate.
Phases 3, 5 and 7 can run in parallel once the API contract is fixed.

### 12.2 Checkpoints with you

1. **After Phase 2:** use the queue on staging. Does it feel right? This is the real go or no-go.
2. **After Phase 6:** the whole thing, on phone and desktop.
3. **Before Phase 9:** sign-off for prod.

### 12.3 Tests

- **Unit (vitest, `server/`):** one test per rule in 9.3, boundary times on each side of 24h, 72h
  and 7 days, stage mapping, group collapse, estimated basis, and the empty and null-date cases.
- **Integration (`server/src/routes/__tests__/dashboard.test.ts`):** org isolation, capability
  filtering, role-based `enabled` and `fix`, cursor stability under inserts, 400s on bad input.
- **Component (vitest):** `DeadlinePill` thresholds with a fake clock, `FilterChips`, `ActionRow`
  variants, focus move on removal.
- **Playwright (`tests/e2e/specs/dashboard.spec.ts`):** the first row is the most urgent; the
  primary action goes to the right page; a fix removes the row; viewer sees no create; ISF-only sees
  no entry; 1,000+ pages correctly; keyboard path. Use the existing one-login-per-worker fixture,
  because logins are limited to 10 a minute.
- **axe:** zero serious or critical issues on `/` in every state, both themes.
- **Screen sweep:** `/` at 390, 744, 1133, 1280, 1440, both themes, zero overflow. Run with
  `E2E_SWEEP=1` against staging.
- **Contrast check:** a small script over the token table, both themes, in CI.

### 12.4 Feature flag and rollout

The app has no flag system, and this needs only a small one.

- A server env var, `DASHBOARD_V2=off|staff|all`, default `off`, added to `env.ts` and the compose
  `environment:` list, exposed through `/auth/me` as `features.dashboardV2`. `staff` means platform
  admins. Phase 1 builds this.
- Rollout: `staff` on staging, `all` on staging, your review, `staff` on prod, `all` on prod.
- For two weeks after `all`, a small "Back to the old dashboard" link stays in the page footer. It
  is per browser and works instantly.
- Remove the flag, the link and the old page after the soak.

### 12.5 Rollback

| Layer | How | Time |
|---|---|---|
| One user | "Back to the old dashboard" link | Instant |
| Everyone | Set `DASHBOARD_V2=off`, then `docker compose up -d server`. No rebuild. This recreates the container, so the API and web app blink, and open tabs switch within 5 minutes or on reload | Target under 2 minutes, not yet measured. Rehearse on staging in Phase 9 |
| API | Additive; the old page never calls it | Nothing to do |
| Indexes | Harmless to leave; `DROP INDEX` if ever needed | Minutes |

### 12.6 Monitoring

Log `dashboard.load` with duration, row count and org size band. Alert only if p95 stays above
budget for 15 minutes. Client errors go through the existing `ErrorBoundary`.

### 12.7 Project basics

```
Frontend typecheck:   ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
Server typecheck:     cd server && ./node_modules/.bin/tsc --noEmit -p tsconfig.build.json
Frontend tests:       npm test
Server tests:         cd server && npm test
E2E:                  npx playwright test --config tests/e2e/playwright.e2e.config.ts
Screen sweep:         E2E_SWEEP=1 npx playwright test --config tests/e2e/playwright.e2e.config.ts sweep
```

New code lives in `src/components/dashboard/` and `server/src/services/dashboard/`. Code style follows
the surrounding files. A row shows the idiom:

```tsx
<li className={cn('relative border-t border-border/60', current && 'focus-frame')}>
  <Link to={item.primary.href} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 can-hover:hover:bg-muted/40">
    <span className="min-w-0">
      <span className="block truncate text-[14px] font-medium">{item.title}</span>
      <span className="block truncate text-[13px] text-muted-foreground">
        <code className="font-mono text-[12.5px]">{item.ref}</code>
        {item.party && ` · ${item.party}`}
      </span>
    </span>
    {item.due && <DeadlinePill dueAt={item.due.at} basis={item.due.basis} />}
  </Link>
</li>
```

### 12.8 Boundaries

- **Always:** staging first; typecheck with the explicit configs; test every rule; keep the old page
  working until the soak ends.
- **Ask first:** any schema change beyond section 9.5; any new dependency; anything that changes the
  action-queue endpoint's behaviour for Compliance; any prod step.
- **Never:** claim live CBP status the data does not hold; say "cleared" without proof; state CBP
  response timing; name a gateway in copy; put raw rejection text in the payload; transmit anything
  from this page.

## 13. Definition of done

On top of the standing bar in `.claude/references/definition-of-done.md`:

- [ ] The first row is correct against a test fixture for every role and plan.
- [ ] Every count matches a direct database query at 5, 100, 1,000 and 10,000 shipments.
- [ ] No figure is shown twice. The headline holds the Now count, chips hold the filters, and the strip holds the stages.
- [ ] No banned term appears in the page or the payload.
- [ ] Every state in 6.6 exists and has been seen at 5 widths in both themes.
- [ ] Zero serious or critical axe issues; keyboard-only and VoiceOver pass.
- [ ] All budgets in 11.2 pass on staging, with today's baseline recorded beside them.
- [ ] Rollback rehearsed on staging, with the time recorded.
- [ ] Old page, flag and dead components removed after the soak.
- [ ] **After the first real prod filing:** one reviewer walks that shipment through the page and
      confirms every label matches what CBP returned.

## 14. Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| A wrong rule hides or understates a real deadline | High | Medium | Pure functions, a test per rule, boundary tests, review with you before Phase 2 closes |
| Estimated cutoff reads as exact | High | Medium | `Est.` label and tooltip; a `isf_no_date` item when no clock can run |
| People read "Accepted" as "Released" | High | Low | Row detail states `Summary accepted` or `Release accepted`, and never "Released" |
| Live prod behaviour differs from CERT and mock | High | Medium | Show stored state only, and re-verify after the first real filing |
| Two rank engines drift (`/dashboard` and `/compliance/action-queue`) | Medium | High | Rules live in one module. Moving Compliance onto it is follow-up work and needs your decision |
| Raw SQL regresses as the schema changes | Medium | Medium | Integration tests on every branch of the `UNION` |
| Stage query is slow for very large orgs | Medium | Low today | Bounded by the 5.3 windows; add a cache only if measured |
| Rows moving under the cursor cause mis-clicks | Medium | Medium | Deferred reshuffle (10, 9.8) |
| A status the rules do not cover shows nothing | High | Medium | Stage and kind functions are exhaustive, with a test that fails on any status value without a mapping |
| Removing KPIs disappoints users who liked them | Low | Medium | They move to Compliance; link from the health line |
| Scope creep toward assignment, snooze or bulk actions | Medium | High | Explicitly out of v1 |
| Staging was a target for supply-chain attacks | Medium | Low | No new dependencies in this project; review what lands on `staging` before release |

Out of v1: assignment, snooze, bulk actions, entry-due clocks, UFLPA, PSC and in-bond in the queue,
saved views, widgets, a separate broker layout.

## 15. Open questions for Ibrahim

Each has a recommendation, so a one-word answer is enough.

| # | Question | My recommendation |
|---|---|---|
| 1 | Rename "Dashboard" in the sidebar to "Inbox"? | **Yes, at full rollout.** It matches the brand line, and the bell stays the event feed |
| 2 | Remove the four-column board entirely, with no toggle? | **Yes.** The strip links to filtered lists. Bring it back as a list view only if a client asks |
| 3 | Is it OK to ship without snooze? | **Yes.** Deadlines should not be hideable. Revisit if brokers ask |
| 4 | Move KPI trends and acceptance rate to Compliance? | **Yes.** Owners keep the health line |
| 5 | Fix the live gaps now, separately: the false "Entry Accepted" message, rejected amendments with no trace, rejected ISFs missing from alerts, overdue items dropping off, and deadlines with no ETD (findings 14 to 16, 19 to 21)? | **Yes, as a small separate PR, first.** These are real today, and the first prod filing could hit them |
| 6 | ISF-5 uses the same cutoff as ISF-10 today, while FROB data is due before lading, not 24 hours before. Keep the conservative rule? | **Keep it for now, labelled as a conservative cutoff.** Confirm the exact rule with your customs contact before changing it |
| 7 | When does `Ready for entry` become urgent, and when does it stop? Proposed: Soon at 5 days before arrival, Now once arrived, gone 15 days after arrival | **Start there.** An entry filed in another system never shows here, so the row has to expire. You know brokers' rhythm better than I do, so overrule this freely |
| 8 | Keep overdue ISFs in Now for 7 days, then move them to Later? | **Yes.** After that the vessel has likely sailed and the item is a record to resolve, not a race |
| 9 | Run Phase 0 now, ahead of the decision on the rest? | **Yes.** The live page has untrue labels, it costs half a day, and it stands alone |
| 10 | Build here in this session? | **Your call after review.** Phase 1 is a fine next step, with Phase 2 as the go or no-go |

## Sources

Linear [Inbox docs](https://linear.app/docs/inbox). Stripe [Dashboard home charts](https://support.stripe.com/questions/dashboard-home-charts-overview)
and [customizing them](https://support.stripe.com/questions/customize-your-dashboard-home-page-charts-for-better-business-insights).
Flexport [Platform Experience 2.0](https://www.flexport.com/blog/introducing-the-flexport-platform-experience-2-0-your-launchpad-for-greater/index.md).
Superhuman [Shortcuts and Cmd+K](https://help.superhuman.com/article/478-superhuman-command) and a
[third-party design study](https://blakecrosley.com/guides/design/superhuman). Descartes
[OneView CHB](https://www.descartes.com/sites/default/files/documents/pi_oneview_chb.pdf). McLeod
[Manage by Exception](https://www.mcleodsoftware.com/docs/whitepapers/McLeod_White_Paper_Manage_By_Exception_Brokers.pdf).
[19 CFR 149.2](https://www.law.cornell.edu/cfr/text/19/149.2),
[142.2](https://www.law.cornell.edu/cfr/text/19/142.2),
[142.12](https://www.law.cornell.edu/cfr/text/19/142.12).
