# MyCargoLens TikTok ad (2026-11-23)

A 45.5 s vertical ad (1080x1920, 60 fps) for a paid TikTok campaign. Mostly drawn 3D animation,
one flat look at the real app. Nothing here is published: the founder approves before it goes out.

| File (in `final/`, not in git) | Sound |
|---|---|
| `mycargolens-tiktok-1080x1920.mp4` | voiceover + music |
| `mycargolens-tiktok-1080x1920-music-only.mp4` | music only |

## Script as built

| Time | Picture | On screen | Voice |
|---|---|---|---|
| 0.0-3.7 | Camera moves down a row of shipping containers; three light up gold | Importer, Broker, or NVOCC? | Importer, broker, or NVOCC? |
| 3.7-6.8 | Four 3D objects (a paper form, an email, a clock, a spreadsheet) go round on one tilted ring over the yard | Still chasing CBP filings by hand? | Still chasing CBP filings by hand? |
| 6.8-7.85 | The ring tightens and speeds up; the objects spiral into its centre and become the logo's gold dot | | |
| 7.85-13.35 | Introduction: the logo's brackets close round the gold dot and the mark rises; the name comes up letter by letter; the second line of the tagline sharpens from a blur as a gold ring pulses from the mark | MyCargoLens. US customs filings, finally in focus. | Meet MyCargoLens. US customs filings, finally in focus. |
| 13.35-16.3 | The app's real Today screen, flat | Every filing. One inbox. | Every filing, in one inbox. |
| 16.3-38.85 | Five drawn cards come round one at a time (about 4 s each, 5.5 s for the last two), each under its own 3D object: three sheets over a template that fills the four parties in; a carton scanned into a suggested HTS code; a clock over three filings that re-sort, closest cutoff on top; a green token over four named fields being checked, one coming back "Missing", then "Fixed" and "Ready to send"; a gold spark over a filing that a gold band reads top to bottom, one line flagged, then a note opening under it ("Why it matters", "How to fix it"). Five dots show progress | Start from a template. / HTS codes, suggested. / Track every deadline. / Check every field. See what's missing. / AI flags what to fix. And why, and how. | Start from a template. Your saved details fill in. Describe the goods. Get HTS code suggestions. Track every deadline, most urgent first. Check every field against the filing rules. See what's missing before you send. Then let AI review the whole filing, and flag what to fix and why. |
| 38.85-45.5 | End card with the logo mark; the closing line comes in two parts, then the button | MyCargoLens. From ISF to entry, all in one place. Book a demo. mycargolens.com/book-a-demo | MyCargoLens. From ISF to entry, all in one place. Book a demo. |

Copy rules applied: no certification or connection claim, no CBP response timing, no promise about
penalties, no price (the ad goes to importers, brokers and NVOCCs alike), CTA "Book a demo".
All type sits inside TikTok's ad safe area (clear of the top bar, the right-hand buttons and the
bottom caption block); the `#guide` layer in the composition shows those zones when its
`display` is switched on.

## What is real and what is drawn

- Drawn: the containers, the four objects on the ring (form, email, clock, spreadsheet), the five
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
| Voice lines | ids `t01`-`t05` (`t03i` for the introduction, `t04a`-`t04e` for the five features) in the promo pipeline's `audio/vo_lines.json`. The voice is ElevenLabs "Jim Pro read" (voice id `isPBwir9PGVoRncT0vZa`, model `eleven_v4`, no direction tags; earlier takes with "Siren", `eXpIbVcVbLo8ZJQDlDnl`, and "Zara", `jqcCZkN6Knx8BJ5TBdYR`, are in `.work/vo/el_siren` and `.work/vo/el_zara` and render with `bin/render.sh el_siren` or `el_zara`), one clip per line, generated in the founder's ElevenLabs workspace (flow "MyCargoLens TikTok ad voiceover") and saved as `.work/vo/el_jim/<id>.wav` (48 kHz mono, trailing silence trimmed). In the generated text the product name is written "My Cargo Lens"; the Siren and Zara takes carried `[curious]` and `[warmly]` tags, the current one none. `bin/render.sh af_bella` renders with the earlier local Kokoro voice instead, but the picture is timed to the ElevenLabs clips |
| Sound effects | four ElevenLabs sounds (`eleven_text_to_sound_v3`, same flow): a soft whoosh on each changeover, a focus click when the frame closes and the logo lands, a chime on "in focus", "Ready to send" and the end card, a soft pop on the fills, checks, the AI flag and the button. Trimmed to `.work/sfx/<id>.wav` in the promo pipeline; times and volumes are the `sfx` list of the `tiktok` entry in `composition/timeline.mjs`, mixed by `audio/mix.mjs` (also in the music-only file) |
| Sound timing | the `tiktok` scene in the promo pipeline's `composition/timeline.mjs` |
| Text scan | `../2026-11-17-promo-videos/pipeline/review/check.sh <video>` must print 0 hits |

The film is one file, `pipeline/composition/index.html`: a Three.js scene drawn from timeline time
(camera path, containers, cards, focus frame) under HTML type animated by one paused GSAP timeline.
Beat times are the `T` object at the top of its script; keep them in step with the voice times.

## Licences (all $0)

Three.js 0.169 with its RoomEnvironment helper (MIT), GSAP 3.15 (standard no-charge licence), Hyperframes 0.9.56 (Apache-2.0),
ElevenLabs voice "Jim Pro read" and sound effects (generated on the founder's paid ElevenLabs plan; check that the plan's commercial-use terms cover paid ads before publishing), Inter (SIL OFL 1.1), music "Digital Technology" by AtlasAudio
(Pixabay Content Licence, the same track as the promo videos).
