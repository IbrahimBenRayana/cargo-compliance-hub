# CBP / MQ outage and manual fallback (gate G8)

What we do when filings can't reach CBP, or CBP's answers can't reach us: who notices, how pilots are
told, how they keep filing by their previous method, and how we confirm recovery. The technical steps
for the connection are in `docs/abi-engine/CBP_MONITORING_RUNBOOK.md` (arrives with #208) and
`docs/abi-engine/MQIPT_RUNBOOK.md`.

## Support window

| | Hours | Who |
|---|---|---|
| Main window | **Mon-Fri 07:00-19:00 CET** (01:00-13:00 ET in winter) | Ibrahim on the connection. The founder who owns the account talks to the pilot |
| Evening check | **15:00 ET every weekday** (21:00 CET in winter) | Whoever is on that day: one look at the signals below, and pilot notices if needed |
| Outside both | Best effort | No promise to the pilot. The order form's support window is the one above |

Each pilot gives us, at onboarding, a named contact (email + phone) for outage notices and its
fallback filing method (its broker, its previous ISF software or service). Both go in the account sheet.
Day 1 doesn't start without them (pilot offer §4.1 Gate B).

## 1. Who notices

| Signal | What it means | Who sees it | State on prod (Nov 4 2026) |
|---|---|---|---|
| External uptime monitor on `https://app.mycargolens.com/api/v1/status/cbp` (503 = no successful CBP pull for 5 min) and `/api/health` | MQ connection or server down | Email/SMS to **both founders** | **Not live.** Needs #208 on main, plus a monitor account. Until then, check by hand |
| `GET /api/health` → `jobs["cbp-inbound"].lastError` / `lastSuccessAt` | The CBP pull failing | Whoever checks | Live |
| `/admin/cbp` (platform admin): last inbound time, pending dispatch, **unknown outcomes**, unmatched messages | Sends in doubt, answers not matched | Platform admin | Live |
| "No answer from CBP" bell on a filing (20 min after sending) | One send got no answer: a lost message, or a sign-on or profile problem | The **pilot's operators**. On our side only a server log line | Live, but it doesn't page us |
| A submit returns "could not be sent to CBP" (502) | The bridge was unreachable, so nothing left. Safe to retry | The pilot user | Live |
| Pilot email or call | Anything | Account founder | Always |

Until the monitor is live, the on-duty founder opens `/api/health` and `/admin/cbp` at 07:00 CET, at
13:00 CET, and at the 15:00 ET check.

## 2. Is it an outage?

Declare an outage (and start section 3) when any of these holds in the window:

- `cbp-inbound` has had no success for **15 minutes** (the monitor's 503, or `lastSuccessAt` in `/api/health`);
- sends fail with 502 for more than **15 minutes**;
- **two or more** transmissions are unanswered after 20 minutes, or one is with less than 12 hours to its ISF cutoff;
- the server or database is down (`/api/health` fails).

**Not an outage:** a CBP rejection of one filing. Its codes and narrative are on the filing, nothing is
billed, and the pilot fixes and resubmits. Help in the window as usual.

**Triage** (Ibrahim; commands in `CBP_MONITORING_RUNBOOK.md`):

| Finding | Likely cause | Action |
|---|---|---|
| `/api/health` down | Our server, DB or VPS | `docs/ops/ROLLBACK.md`; Contabo status |
| Health up, bridge `/health` errors, bridge logs show MQRC codes | MQ channel, TLS or keystore | `MQIPT_RUNBOOK.md`. If CBP refuses the channel, email **MQSTAFFOPS@cbp.dhs.gov** |
| Bridge healthy, sends go out, no answers to anyone | CBP-side (ACE or ABI outage) or our A-record sign-on | Check CBP's CSMS messages for an ACE outage. Email our CBP client rep (Michael Barela) with times and MQ message ids |
| One org's sends unanswered, others fine | That org's filer code or profile (CLIENT mode: client-rep approval) | Their CBP client rep. For a pilot in SIGMA mode (S7P), treat it as the row above |

## 3. Telling pilots

The founder who owns the account does it, by email to the named contact, plus a phone call if any ISF
is within 24 hours of its cutoff.

| When | Send |
|---|---|
| Within **30 minutes** of declaring, in the window (at the 15:00 ET check otherwise) | First notice |
| Every **2 hours** while it lasts, in the window | Update, even if nothing changed |
| When section 5 is done | All clear, with the status of each of their filings sent during the outage |

**First notice (template, plain text):**

> Subject: MyCargoLens: ISF transmission to CBP interrupted
>
> Hi [NAME],
>
> Since [TIME ET] we can't confirm that filings reach CBP. Your drafts and data are safe.
>
> What to do now: file any ISF due in the next [N] hours by your usual backup method ([THEIR FALLBACK]).
> Here is the status of your filings in MyCargoLens:
> - Not sent yet: [LIST]. File these by your backup method.
> - Sent, waiting for CBP: [LIST]. Don't refile these yet. We'll tell you by [TIME] whether CBP has them.
>
> Next update by [TIME ET]. Call me on [PHONE] with anything urgent.
>
> [FOUNDER NAME], MyCargoLens

**All clear:** the time it ended, then for each filing sent during the outage: accepted (with its ISF
transaction number), rejected (with the reason), or filed by them elsewhere (with what we did about our
copy, see section 4). Don't explain causes we haven't confirmed, and make no promises about CBP timing.

## 4. Manual fallback: the pilot files by its previous method

The pilot keeps its previous way of filing ready for the whole pilot (pilot offer §4.1 Gate B). During an
outage the rule is **one ISF per bill at CBP**:

| Filing's state in MyCargoLens | Fallback |
|---|---|
| Draft, never submitted | File it by the fallback method. Then cancel the draft in MyCargoLens, so it isn't sent later |
| Submit failed ("could not be sent to CBP") | Nothing reached CBP. Same as a draft |
| **Submitted, waiting for CBP** (sent, or outcome unknown) | It may already be at CBP. **Don't refile while there's time.** Once the cutoff is **less than 12 hours** away and we still can't confirm, the pilot files by the fallback method. After recovery, if CBP accepted ours as well, we delete our copy (an ISF delete from the filing, with the pilot's OK) and say so in the all-clear |
| Accepted | Nothing to do. An update (replace) that can't be sent waits, or goes through their fallback filer only if that filer files the original too |

We **don't** file for a pilot through any other channel ourselves, and we don't resend in-doubt
transmissions blindly: an unknown outcome is settled from CBP's answer, which waits on the queue and is
picked up when the connection returns.

Billing: nothing is billed without CBP acceptance, so a filing made elsewhere costs the pilot nothing
with us. If we failed to transmit a filing the pilot gave us in time, the order form's fee credit
applies. Log it in the billing sheet.

## 5. Recovery: confirming it's over

1. `cbp-inbound` succeeding again for 10 minutes, and the bridge `/health` showing QGP2 with both queues open.
2. `/admin/cbp`: pending dispatch back to 0. Each transmission sent during the outage is now ACCEPTED,
   REJECTED or still SENT. Review the unmatched inbound list for anything that belongs to a pilot.
3. Any transmission still unanswered 30 minutes after recovery, or UNKNOWN: ask CBP (client rep) whether
   it was received, quoting its MQ message id. Don't resend until they answer, unless the cutoff forces
   the fallback in section 4.
4. Resolve the duplicates from section 4, with the pilot.
5. Send the all-clear (section 3).
6. Write a short incident note in `docs/ops/incidents/YYYY-MM-DD.md`: start, end, how it was noticed,
   cause, pilots affected, filings moved to fallback, fee credits, and what we change.

## 6. Dry run (once before the first pilot's Day 1, then every quarter)

On **staging** only, with the founders' own test org (never prod):

1. Note the time, then stop the staging bridge: `docker stop mycargolens-mq-bridge`.
2. Check that the monitor alerts both founders, or, before the monitor exists, that the 15-minute rule is caught by the hand check.
3. Submit one test ISF on staging. Expect the 502 "could not be sent" path, and a draft left to refile.
4. The account founder sends the first-notice template to an internal address, filled in from `/admin/cbp`.
5. Start the bridge, and walk section 5 through to the all-clear.
6. Write down how long each step took and anything unclear, and fix this runbook.

## 7. Contacts

| Who | For |
|---|---|
| Ibrahim | Connection, server, prod changes |
| Account founder (Ibrahim or Imran) | The pilot's named contact |
| MQSTAFFOPS@cbp.dhs.gov | MQ channel or queue manager (QGP2) refused, TLS |
| Michael Barela, CBP client representative | S7P profile, A-record sign-on, whether CBP received a transmission |
| CBP CSMS messages | Announced ACE outages |
| Contabo support | VPS down |
