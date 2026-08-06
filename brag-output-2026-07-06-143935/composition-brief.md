# Hyperframes Composition Brief: MyCargoLens — "Follow One Shipment"

## Objective
Build the 38.7s illustration-led launch film specified in `../brag-plan.md`
(the creative contract — all 9 scenes, timings, copy, and audio cues live
there; S5.5 showcases the AI chat assistant + human handoff using the real
widget's states: "Chat assistant", AI-assistant badge → "Live agent: Sarah",
"Talk to a human", specialists 24/7). This brief pins the technical envelope.

## Output
- Composition: `brag-output-2026-07-06-143935/composition/` (scaffolded, id `main`)
- Render: `brag-output-2026-07-06-143935/brag.mp4` — 1920×1080 @ **60fps**, `-q high`
- Root `data-duration="38.7"`

## Source material (verbatim copy is in the plan's storyboard)
- Product: MyCargoLens. Film tagline (S2): "US customs, finally in focus."
- Logo: Focus Frame — brackets `M26 40L26 26L40 26` + 3 rotations, stroke 6.4
  round; subject `rect 42,42,16,16 r4.6` `#FBBE24`. Build as animatable
  inline SVG (4 bracket paths + subject as separate nodes). Mini variant
  locks onto the urgent queue row in S4.
- Illustrations I1–I7 per plan §4, in the brand idiom: 1.75px
  `currentColor` strokes, round caps, gold discipline (waterline stripe,
  one gold container, checks, halos), dashed 15%-opacity connectors,
  CSS ambient loops (bob 5–6s, wave 9–11s, pulse 3s).

## Visual identity
Tokens per plan §3. Inter + ui-monospace + tabular-nums. Cards: white,
1px border `hsl(220 20% 88%)`, radius 18px, soft foreground-tinted shadow.
Vignettes: heavy on dark scenes, whisper-soft on warm scenes.

## Motion contract (plan §6)
expo.out entrances · back.out(2.2–2.4) pops · power3.inOut collapses ·
sine.inOut ambient · blur(8px)→0 rack-focus on majors · 0.4s crossfades with
1.02→1.00 settle · `tl.set` hard kills at every clip boundary · initial
scene opacities 0 inline + timeline keyframes at t=0 · reading floors
(headlines ≥1.4s, chips ≥0.8s).

## Audio (plan §7)
- Music `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`,
  track 10, vol 0.26, full 33.5s slot, fade to silence last ~1.5s
  (implement fade via volume ramp if supported; else let the bed run low).
- Cue preset at `assets/music/cues/…music-cues.json` (0–25s window):
  strong locks → S3 ship 8.74s, S4 flip 17.47s. Beyond 25s run
  `npx hyperframes beats composition` and snap S7's four dots ±0.10s;
  fallback 0.545s spacing from ~27.6s.
- SFX staged under `assets/sfx/` (keyboard ×7, glitch, drops, select, bong,
  impactSoft ×2, card-place ×3, ui clicks ×2). Sparse, motion-matched,
  vol 0.24–0.55. Every `<audio>` needs an `id`. Music track 10; SFX 11+;
  no shared track-index among overlapping clips; slot durations may exceed
  media length (renderer trims — validate warnings acceptable).

## Hard gates
`lint` 0 errors → `validate` 0 errors → `inspect` 0 errors (annotate
intentional overlaps/overflow with `data-layout-allow-*`) → snapshot review
at ~2, 6, 11, 16, 18.5, 21, 25.5, 29, 32.5 → render → ffprobe verify.
