# MyCargoLens promo videos (2026-11-17)

Four videos of the real app, rendered from source. Nothing here is published: the founder approves
before anything goes out.

| File (in `final/`) | What | Format | Sound |
|---|---|---|---|
| `mycargolens-promo-4k.mp4`, `-1080p.mp4` | "Customs, in focus": product promo | 16:9, 60 fps | voiceover + music |
| `mycargolens-promo-1080p-music-only.mp4` | same picture | 16:9 | music only |
| `mycargolens-promo-square-1080.mp4`, `-1080-music-only.mp4` | same film for the LinkedIn feed | 1:1 | voiceover / music only |
| `mycargolens-vertical-1080x1920.mp4` | 15 s cut on the app's narrow layout | 9:16 | music and captions |
| `mycargolens-isf10-4k.mp4`, `-1080p.mp4`, `-1080p-music-only.mp4` | "File an ISF-10" feature video | 16:9 | voiceover + music / music only |
| `mycargolens-ai-preflight-4k.mp4`, `-1080p.mp4`, `-1080p-music-only.mp4` | "AI pre-flight review" feature video (added 2026-11-19) | 16:9 | voiceover + music / music only |

The MP4s are not in git (size). They are in `final/` on the machine that rendered them and were
sent to the founder. `plan.md` has the approved scripts and storyboards, `vo-script.md` the spoken lines.

## What is on screen

- The real app, built locally from the `staging` branch, on a local database `mycargolens_promo`.
  Staging, prod and the everyday local database are never touched.
- Only seeded, fictional data (`server/src/scripts/seedDemoData.ts`): Pacific Rim Trading Co.,
  Midwest Imports LLC, Atlantic Apparel Group, Shenzhen Bright Circuit, Hamburg Textile.
- No CBP transport, Stripe or email is configured. The ISF and AI pre-flight videos stop on the
  "Send this ISF to CBP?" dialog. Nothing is sent.
- The AI pre-flight video needs the app's AI settings (`AI_*` in `server/.env`, a key with credits).
  The review and the HTS suggestions on screen are the app's real answers for that draft; they are
  worded differently on every run, so read the new take before you publish a re-render.
- HTS suggestions need the tariff schedule in the promo database: in `server/`,
  `tsx src/abi-engine/refdata/ingestCli.ts <revision>` (reads the public USITC export), then restart the API.

Presentation changes, all in `pipeline/dataset/promo.sql` or `pipeline/capture/session.mjs`:

| Change | Why |
|---|---|
| Demo user renamed "Dana Whitfield", not a platform admin | no founder name, no admin menu |
| Org given the ISF + Entry plan, a fake card, entry prices and a made-up filer code `DM1` | no setup banners or locked pages |
| " (S7P)" removed from one option label; the Type 86 draft deleted | real filer code and a discontinued entry type stay off screen |
| One draft's HTS number cut to 4 digits, its US port set to a valid code | the rule check has something true to catch |
| Two-factor reminder snoozed; chat bubble, toasts and "AI coach off" note hidden | clutter |
| AI pre-flight video only: the review text is laid out as headings and bullets | the app prints the model's markdown as plain text (`**1. …**`, `- …`). Same words, nothing added or removed. **Ship the app fix that renders this markdown before publishing the video**, or re-record without `MARKDOWN` in `capture/shots.mjs` |
| AI pre-flight video only: the two-factor row hidden in the notification list | the reminder is snoozed for the film; the app re-adds its notification at sign-in |
| The same draft given a container | the review talks about the HTS number, not an empty optional field |
| "Took" column blanked on Submission logs; "Awaiting response" card hidden on Today; Transmission card hidden on the entry page | no response-time figures or internal ids on screen |

## Re-render

Run from `pipeline/`. Steps 1 to 3 are one-time; after a UI change re-run 4 and 6.

| Step | Command |
|---|---|
| 1. Tools | `pnpm install` (Hyperframes 0.9.56, GSAP 3.15, Playwright 1.65). Capture uses the installed Google Chrome. |
| 2. Database | `createdb mycargolens_promo`; point `server/.env` at it (own JWT secrets, `DASHBOARD_V2=all`, `SHIPMENTS_V2=all`, `CHAT_ENABLED=false`, `PORT=3011`, `FRONTEND_URL=http://localhost:8090`, no other keys); in `server/`: `prisma migrate deploy`, `tsx prisma/seed.ts`, `tsx src/scripts/seedDemoData.ts`; then `psql mycargolens_promo -f dataset/promo.sql` |
| 3. Run the app | `server/`: `tsx src/index.ts`; repo root: `VITE_API_URL=http://localhost:3011 vite --port 8090 --strictPort` |
| 4. Capture | `PROMO_SLOW=0.14 node capture/run.mjs [shot…]`. Playwright drives the app at 1440x810 CSS x 2.67 (3840 px frames) with the page clock slowed; ffmpeg resamples to 60 fps. Shots are in `capture/shots.mjs`; selectors target visible text. |
| 5. Voice | `<kokoro venv>/bin/python -I audio/tts.py af_heart 0.95 .work/vo/af_heart` (Kokoro-82M + misaki, local; model in `.work/tts/`). Lines: `audio/vo_lines.json`. |
| 6. Render | `bin/render.sh promo`, `promo-square`, `vertical`, `isf`, `ai`. Timeline and captions: `composition/timeline.mjs`; look: `composition/src/template.html`. Output: `.work/renders/`. |
| 7. Review | `review/check.sh <video>`: OCR every 0.25 s against the deny-list (founder and company names, gateway, real filer code, retired claims and prices, response times). Must print 0 hits (the AI video's only hits are the review's own "CPSC general certificate" line). |

The seed dates are relative to the day it runs ("15h left", "8h over"). Reseed (step 2) on the day
you capture, or the cutoff chips will read differently.

## Licences (all $0)

| Asset | Licence |
|---|---|
| Hyperframes 0.9.56 | Apache-2.0 |
| GSAP 3.15 | GSAP standard "no charge" licence (commercial use allowed) |
| Playwright 1.65 | Apache-2.0 |
| Kokoro-82M voice (`kokoro-onnx`, `misaki`) | Apache-2.0 / MIT |
| Music: "Digital Technology" by AtlasAudio (Pixabay #617560) | Pixabay Content Licence: commercial use, no attribution, no standalone redistribution of the track |
| Inter | SIL OFL 1.1 |

Popular stock tracks are sometimes flagged on YouTube. If that happens, dispute it citing the Pixabay licence.

## Gotchas

- The app keeps its access token in memory: capture navigates with the History API, never a reload.
- The page's JS clock runs slow during capture, so each shot's setup waits real seconds for entrance tweens.
- Screenshots are clipped in document coordinates, so the recorder follows the scroll position.
- The preview launcher could not read this worktree, so the two local servers were started from a shell.
