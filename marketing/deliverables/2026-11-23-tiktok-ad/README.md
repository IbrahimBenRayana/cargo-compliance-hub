# MyCargoLens TikTok ad (2026-11-23)

A 20 s vertical ad (1080x1920, 60 fps) for a paid TikTok campaign. Mostly drawn 3D animation,
one flat look at the real app. Nothing here is published: the founder approves before it goes out.

| File (in `final/`, not in git) | Sound |
|---|---|
| `mycargolens-tiktok-1080x1920.mp4` | voiceover + music |
| `mycargolens-tiktok-1080x1920-music-only.mp4` | music only |

## Script as built

| Time | Picture | On screen | Voice |
|---|---|---|---|
| 0.0-2.6 | Camera moves down a row of shipping containers; three light up gold | Importer. Broker. NVOCC. | Importer, broker, or NVOCC? |
| 2.6-5.25 | Sixteen filing cards fade in, hanging loose in the air at different depths, drifting gently | Still chasing CBP filings by hand? | Still chasing CBP filings by hand? |
| 5.25-8.65 | The gold focus frame closes; the cards fall into one stack, most urgent on top; the app's real Today screen sits over it, flat | Every filing. One inbox. | MyCargoLens puts every filing in one inbox. |
| 8.65-17.45 | Five drawn cards, one at a time: a template filling the fields, a description turning into a suggested HTS code, a countdown ring, a column of checks, one flagged line | Start from a template. / HTS codes, suggested. / Track every deadline. / Check every field. / AI flags what to fix. | Start from a template. Get HTS code suggestions. Track every deadline. Check every field. And let AI flag what to fix. |
| 17.45-20.0 | The cards fold into the logo mark | MyCargoLens. An inbox for US customs. Book a demo. mycargolens.com/book-a-demo | MyCargoLens. Book a demo. |

Copy rules applied: no certification or connection claim, no CBP response timing, no promise about
penalties, no price (the ad goes to importers, brokers and NVOCCs alike), CTA "Book a demo".
All type sits inside TikTok's ad safe area (clear of the top bar, the right-hand buttons and the
bottom caption block); the `#guide` layer in the composition shows those zones when its
`display` is switched on.

## What is real and what is drawn

- Drawn: the containers, the filing cards (labels "ISF", "Entry" and made-up time chips), the five
  feature cards. The HTS card shows a description and code the app really returned for it in the
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
| Voice lines | ids `t01`-`t05` (`t04a`-`t04e` for the five features) in the promo pipeline's `audio/vo_lines.json`; `python -I audio/tts.py af_bella 1.0 .work/vo/af_bella t` (Kokoro voice "Bella", chosen by the founder) |
| Sound timing | the `tiktok` scene in the promo pipeline's `composition/timeline.mjs` |
| Text scan | `../2026-11-17-promo-videos/pipeline/review/check.sh <video>` must print 0 hits |

The film is one file, `pipeline/composition/index.html`: a Three.js scene drawn from timeline time
(camera path, containers, cards, focus frame) under HTML type animated by one paused GSAP timeline.
Beat times are the `T` object at the top of its script; keep them in step with the voice times.

## Licences (all $0)

Three.js 0.169 with its RoomEnvironment helper (MIT), GSAP 3.15 (standard no-charge licence), Hyperframes 0.9.56 (Apache-2.0),
Kokoro-82M voice (Apache-2.0), Inter (SIL OFL 1.1), music "Digital Technology" by AtlasAudio
(Pixabay Content Licence, the same track as the promo videos).
