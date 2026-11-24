# MyCargoLens TikTok ad (2026-11-23)

A 41.7 s vertical ad (1080x1920, 60 fps) for a paid TikTok campaign. Mostly drawn 3D animation,
one flat look at the real app. Nothing here is published: the founder approves before it goes out.

| File (in `final/`, not in git) | Sound |
|---|---|
| `mycargolens-tiktok-1080x1920.mp4` | voiceover + music |
| `mycargolens-tiktok-1080x1920-music-only.mp4` | music only |

## Script as built

| Time | Picture | On screen | Voice |
|---|---|---|---|
| 0.0-3.7 | Camera moves down a row of shipping containers; three light up gold | Importer, Broker, or NVOCC? | Importer, broker, or NVOCC? |
| 3.7-6.8 | Eight filing cards glide away down the lane in one curved stream, one behind another; the camera follows them | Still chasing CBP filings by hand? | Still chasing CBP filings by hand? |
| 6.8-7.85 | The gold focus frame closes; the stream gathers into one stack, most urgent on top | | |
| 7.85-13.35 | Introduction: the stack folds into the frame, which becomes the logo mark and rises; the name comes up letter by letter; the second line of the tagline sharpens from a blur as a gold ring pulses from the mark | MyCargoLens. US customs filings, finally in focus. | Meet MyCargoLens. US customs filings, finally in focus. |
| 13.35-16.3 | The app's real Today screen, flat | Every filing. One inbox. | Every filing, in one inbox. |
| 16.3-38.85 | Five drawn cards come round one at a time (about 4 s each, 5.5 s for the last two), each under its own 3D object: three sheets over a template that fills the four parties in; a carton scanned into a suggested HTS code; a clock over three filings that re-sort, closest cutoff on top; a green token over four named fields being checked, one coming back "Missing", then "Fixed" and "Ready to send"; a gold spark over a filing that a gold band reads top to bottom, one line flagged, then a note opening under it ("Why it matters", "How to fix it"). Five dots show progress | Start from a template. / HTS codes, suggested. / Track every deadline. / Check every field. See what's missing. / AI flags what to fix. And why, and how. | Start from a template. Your saved details fill in. Describe the goods. Get HTS code suggestions. Track every deadline, most urgent first. Check every field against the filing rules. See what's missing before you send. Then let AI review the whole filing, and flag what to fix and why. |
| 38.85-41.7 | End card with the logo mark | MyCargoLens. An inbox for US customs. Book a demo. mycargolens.com/book-a-demo | MyCargoLens. Book a demo. |

Copy rules applied: no certification or connection claim, no CBP response timing, no promise about
penalties, no price (the ad goes to importers, brokers and NVOCCs alike), CTA "Book a demo".
All type sits inside TikTok's ad safe area (clear of the top bar, the right-hand buttons and the
bottom caption block); the `#guide` layer in the composition shows those zones when its
`display` is switched on.

## What is real and what is drawn

- Drawn: the containers, the filing cards (labels "ISF", "Entry" and made-up time chips), the five
  feature cards and the 3D objects above them (a second Three.js scene on its own clear canvas, `#gl2`). The template card's party names are the fictional seed companies. The HTS card shows a description and code the app really returned for it in the
  promo build ("Upholstered wooden-frame chairs", 9401.61.40.11, tagged "Review before you file");
  the template name is from the seed data. No accuracy figure is shown or claimed. They stand for the product; they are not screenshots.
- Real: the Today screen at 7 s, from the local promo build and its fictional seed data
  (`../2026-11-17-promo-videos`, shot `m-dashboard`).

## Re-render

Tools, voice model, music and the capture live in `../2026-11-17-promo-videos/pipeline` (see its README).

| Step | Command |
|---|---|
| Picture and sound | `pipeline/bin/render.sh` (`KEEP_PICTURE=1` redoes only the sound). Output: `pipeline/.work/renders/` |
| Look at single moments | in `pipeline/composition`: `hyperframes snapshot --at 1.2,6.6,9.4 --no-end -o ../.work/snap .` |
| Voice lines | ids `t01`-`t05` (`t03i` for the introduction, `t04a`-`t04e` for the five features) in the promo pipeline's `audio/vo_lines.json`. The voice is ElevenLabs "Zara" (voice id `jqcCZkN6Knx8BJ5TBdYR`, model `eleven_v4`), one clip per line, generated in the founder's ElevenLabs workspace (flow "MyCargoLens TikTok ad voiceover") and saved as `.work/vo/el_zara/<id>.wav` (48 kHz mono, trailing silence trimmed). In the generated text the product name is written "My Cargo Lens"; `t01` carries a `[curious]` tag, `t03i` and `t05` a `[warmly]` tag. `bin/render.sh af_bella` renders with the earlier local Kokoro voice instead, but the picture is timed to the ElevenLabs clips |
| Sound timing | the `tiktok` scene in the promo pipeline's `composition/timeline.mjs` |
| Text scan | `../2026-11-17-promo-videos/pipeline/review/check.sh <video>` must print 0 hits |

The film is one file, `pipeline/composition/index.html`: a Three.js scene drawn from timeline time
(camera path, containers, cards, focus frame) under HTML type animated by one paused GSAP timeline.
Beat times are the `T` object at the top of its script; keep them in step with the voice times.

## Licences (all $0)

Three.js 0.169 with its RoomEnvironment helper (MIT), GSAP 3.15 (standard no-charge licence), Hyperframes 0.9.56 (Apache-2.0),
ElevenLabs voice "Zara" (generated on the founder's paid ElevenLabs plan; check that the plan's commercial-use terms cover paid ads before publishing), Inter (SIL OFL 1.1), music "Digital Technology" by AtlasAudio
(Pixabay Content Licence, the same track as the promo videos).
