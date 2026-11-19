# MyCargoLens promo videos: plan

Date: 2026-11-17. Status: **approved by the founder the same day (same voice, new music track) and produced.**

## What changed in production

- **Rule-check scenes.** The wizard's Review step is a summary, not a list of checks. Both films show
  the shipment page's "Start submission" check instead. Video 1: it catches an HTS number cut to
  4 digits. Video 3: it passes and stops on the "Send this ISF to CBP?" dialog. Nothing is sent.
- **Filer code.** The promo org files under a made-up code of its own (`DM1`), and " (S7P)" is
  removed from the one option label that prints it, so the wizard is shown from its first step.
- **Response times.** The "Took" column (Submission logs), the "Awaiting response" card (Today) and
  the Transmission card (entry page) are hidden for the shots.
- **Vertical cut.** Recorded on the app's own narrow layout, not cropped from the desktop capture.
- **Lengths.** Video 1 is 45.5 s, Video 2 15.6 s, Video 3 41 s (the voice lines set the pace).
- **Video 3 end card** reads "File your next ISF-10 from a template." above the price line.

The tables below are the plan as approved; `pipeline/composition/timeline.mjs` and `vo-script.md`
are what was built.

## Approach

Same pipeline as the CyberGuard posture video, because it shows the real product at a quality a
screen recorder cannot reach:

1. **Real app, local build of `staging` (3ba4d81)** against a new local database `mycargolens_promo`,
   filled by the repo's own `seedDemoData.ts`. Staging, prod and the existing local `mycargolens`
   database are not touched. No external service is configured (no CBP, Stripe, email or AI keys).
2. **Capture:** Playwright drives the app at 1440x810 CSS, 2.67x density (3840 px frames), with the
   page clock slowed so every transition resamples to a smooth 60 fps.
3. **Edit:** Hyperframes + GSAP. Captions, camera pushes, a drawn cursor, navy and gold brand frames, Inter.
4. **Sound:** Kokoro voice generated on this Mac, one Pixabay music track, music ducked under the
   voice, -14 LUFS. Every cut also ships music-only.
5. **Review:** OCR of every quarter second against a deny-list (founder name, CustomsCity, filer
   code, real emails, "certified", retired prices), plus a frame-by-frame look.

Higgsfield is not used: generated footage would break "real UI, no stock" and adds nothing here.

## Presentation fixes in the promo database only

| Seen in recon | Fix |
|---|---|
| Top-right user is "Ibrahim Ben Rayana" (founder name) | Demo user renamed to a fictional operator, "Dana Whitfield" |
| Org is "US Imports Inc." | Kept (fictional, from the seed) |
| "No plan selected" banner, "ABI Entry isn't on your plan yet" | Promo org gets the plan that includes entries |
| "Set up two-factor authentication" banner | Dismissed before recording |
| Platform admin nav (Clients, CBP traffic) | Demo user is not a platform admin in the promo DB |
| Chat bubble, "AI coach off" label | Hidden for the recording (no AI key locally) |
| Filer code "S7P" on the ISF wizard's first step | Not framed: the wizard shot starts below that card |
| Type 86 draft, in-bond pages | Never shown (not marketable) |

Seed data is fictional: Pacific Rim Trading Co., Midwest Imports LLC, Atlantic Apparel Group,
Shenzhen Bright Circuit, Hamburg Textile.

## Video 1. "Customs, in focus" (product promo, about 42 s)

Formats: 16:9 in 4K and 1080p; 1:1 1080 for the LinkedIn feed. Voiceover and music-only versions.
Use: homepage, LinkedIn company post, opening of a sales demo.

| # | Time | Screen (real UI) | On-screen caption | Voiceover |
|---|---|---|---|---|
| 1 | 0-4 s | Navy frame, gold lens mark | Which filing needs you now? | Which filing needs you right now? |
| 2 | 4-11 s | Dashboard "Today": KPI strip, then push in on Action items ("ISF cutoff passed", "ISF due") | Open the app. See what needs you. | MyCargoLens opens on today's work: the ISFs near their cutoff, at the top. |
| 3 | 11-17 s | Shipments list: status tabs, ISF cutoff column, click "Drafts" | Every ISF, with its own deadline clock. | Every ISF carries its own deadline clock. |
| 4 | 17-24 s | ISF draft, Review step: validation results | Checked before you submit. | Each draft is checked against the rules before you submit it. |
| 5 | 24-30 s | Compliance: daily brief, "Filings needing attention" cards | Open work, ranked by urgency. | Open work is ranked by urgency, in one inbox. |
| 6 | 30-35 s | Accepted entry detail (7501), linked ISF | The entry starts from the accepted ISF. | When the ISF is accepted, the entry starts prefilled from it. |
| 7 | 35-38 s | Submission logs list | Every CBP request and response, logged. | And every request and response is logged. |
| 8 | 38-42 s | Navy end card, logo | An inbox for US customs, not another dashboard. Book a demo: mycargolens.com/book-a-demo | MyCargoLens. An inbox for US customs. Book a demo. |

No price in this video: the $45 card must not be quoted to volume filers, and this cut goes to all four audiences.

## Video 2. Vertical cut (15 s, 9:16, 1080x1920)

Use: LinkedIn mobile feed, founder post. Music and captions only (most feed views are muted).

| # | Time | Screen | Caption |
|---|---|---|---|
| 1 | 0-2.5 s | Navy frame | Which ISF is about to miss its cutoff? |
| 2 | 2.5-7 s | Dashboard Action items, cropped tall, push in on the "8h over" and "15h" chips | Today's work, most urgent first. |
| 3 | 7-11 s | Shipments list ISF cutoff column, cropped tall | A deadline clock on every ISF. |
| 4 | 11-15 s | End card | MyCargoLens. An inbox for US customs. Book a demo. |

## Video 3. "File an ISF-10" (feature video, about 35 s)

Formats: 16:9 in 4K and 1080p. Voiceover and music-only versions.
Use: the ISF page on the site, sales follow-up email, LinkedIn post aimed at importers.

| # | Time | Screen | Caption | Voiceover |
|---|---|---|---|---|
| 1 | 0-3 s | Navy frame | ISF-10, without the retyping. | Filing an ISF-10 should not mean retyping it. |
| 2 | 3-9 s | Shipments, "From template" menu, pick "Electronics from Shenzhen" | Start from a template. | Start from a saved template: parties, ports, HTS and bond are already in. |
| 3 | 9-17 s | Wizard: Trade parties, Transport, Cargo steps moving past, "% filled in" rising | Six steps. Most already filled. | Walk the six steps and add what is new for this shipment. |
| 4 | 17-24 s | Review and submit step: checks list | Rule checks before you submit. | Before it goes, every field is checked against the filing rules. |
| 5 | 24-30 s | Accepted ISF detail: status summary, deadline, history | Status and history in one place. | After you submit, the filing's status and full history stay in one place. |
| 6 | 30-35 s | End card: "ISF $45 per accepted ISF. No monthly fee." then Book a demo | ISF $45 per accepted ISF. Book a demo. | Forty-five dollars per accepted ISF. Book a demo at mycargolens.com. |

Scene 5 shows a seeded accepted filing. Nothing is transmitted, and no caption or line says how
fast CBP answers.

## Copy rules applied

No "certified", no "direct connection", no response timing, no gateway, no founder name, no
dates, no customers or metrics. Price appears only in Video 3 as "ISF $45 per accepted ISF".
CTA is always "Book a demo".

## Claims to confirm

- Video 1 scene 4 and Video 3 scene 4 depend on what the Review step actually shows for a clean
  draft. The caption will describe what is on screen.
- Video 1 scene 6: the prefilled-from-ISF line (approved claim A26) is spoken over an accepted
  entry that links to its ISF. If the link is not visible on that page, the line changes to
  "Entries live next to the ISF they came from."

## Video 4. "AI pre-flight review" (feature video, 46 s), added 2026-11-19

Script approved by the founder on 2026-11-18. Formats: 16:9 in 4K and 1080p, voiceover and music-only.

| # | Screen (real UI) | Caption | Voiceover |
|---|---|---|---|
| 1 | Navy frame | Catch it before CBP does. | A rejected filing means rework. Catch the problem before you send. |
| 2 | Compliance page, the bell opens the notification list | Drafts waiting on you. | MyCargoLens shows which drafts are waiting, most urgent first. |
| 3 | Draft page: click "AI pre-flight review", the panel fills in | One click. A full review. | Run an AI pre-flight review on any draft. |
| 4 | Push in on the review: what to fix, UFLPA and agency items, the "hint, not legal advice" note | What to fix, in plain English. | It checks every field, flags possible UFLPA and agency risks, and lists what to fix. |
| 5 | Edit the draft: "HTS suggestions" from the description, the suggested code is used | Fix it. Then you decide. | Get HTS code suggestions from the description, fix the draft, and run the rule check. |
| 6 | "Start submission": the check passes, "Send this ISF to CBP?" opens. Nothing is sent. | Checked, then you confirm. | You confirm before anything goes to CBP. |
| 7 | End card | AI pre-flight review, on every draft. Book a demo. | MyCargoLens. Book a demo. |

Wording limits: the review flags and explains only. No accuracy claim, no promise about penalties.
Scene 6's caption was added in production (the approved script had one caption for scenes 5 and 6).
Founder tweaks on 2026-11-19: the bell opens the notification list in scene 2, scene 5 shows HTS
suggestions instead of typing the code, and the music is one continuous stretch with a fade (46 s).
