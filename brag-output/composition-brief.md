# Hyperframes Composition Brief: MyCargoLens

## Objective
Create a ~22s landscape launch-style brag video for MyCargoLens — a calm,
premium product film built on the brand's own chaos→calm arc and the
aperture-closing-to-focus logo metaphor.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22 seconds

## Source Material
- Project root: /Users/mac/Desktop/MyCargoLens/cargo-compliance-hub
- Primary files read: landing/app/home-client.tsx, landing act sections,
  mycargolens-design skill (README + colors_and_type.css + logo assets)
- Product name: MyCargoLens
- Tagline / strongest claim: "An inbox for US customs. Not another dashboard."
- Key UI/visual moments to recreate:
  - The 6-blade camera-aperture logo mark closing to a single gold focus point
  - The dashboard "Action queue" with a typed AI brief + ranked filing rows
  - The AI rejection coach streaming numbered plain-English fix steps
  - The lifecycle pipeline (ISF → Manifest → Entry → Cleared) + proof stats
- Copy that must appear verbatim:
  - "US customs software hasn't changed since 1995."
  - "An inbox for US customs. Not another dashboard."
  - "3 ISFs need attention. ISF-10 #X42191 — deadline in 4h."
  - "Invalid manufacturer ID (10MSCM)"
  - "Plain English explains every CBP rejection."
  - "99.8% CBP acceptance" · "<90s avg filing" · "100% audit-ready"
  - "File ISF, Entry, and In-Bond with confidence."
  - "mycargolens.com"

## Creative Direction
- Tone preset: polished (cinematic-leaning)
- Creative direction: a quiet premium product film; the brag is the *absence*
  of noise. Stripe/Linear/Mercury energy, never Salesforce.
- Interpretation: fewer scenes, longer holds, soft crossfades. Energy comes from
  clutter resolving into order, not from speed or loudness.
- Angle: Every launch trailer screams; this one makes the noise stop. Open in the
  chaos customs filers have lived in for 30 years (green-screen terminal, 12 tabs,
  faxed PDF, red rejection code), then the aperture closes over it and everything
  resolves into one calm, ranked queue. The flex is restraint.
- Hook: a dark navy field crawling with the old way under one quiet line —
  "US customs software hasn't changed since 1995."
- Outro / punchline: the calm aperture mark + wordmark on warm-white, "File ISF,
  Entry, and In-Bond with confidence." then mycargolens.com. Music fades to silence.
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract filler visuals / color washes
  - Any emoji (brand rule: never), exclamation marks, marketing superlatives
  - Unrelated visual redesign — stay inside the navy + gold system

## Visual Identity
- Background: warm-white hsl(220 25% 97%) calm scenes; deep navy hsl(222 47% 6%) chaos
- Text: near-black navy hsl(222 47% 8%) on light; hsl(210 40% 94%) on dark
- Accent: amber gold hsl(43 96% 56%) — the only gold; aperture center, status, CTA glow
- Status: rose hsl(0 72% 51%) · amber hsl(38 92% 50%) · emerald hsl(160 84% 39%) · blue hsl(220 70% 55%)
- Lifecycle: ISF hsl(217 91% 60%) · Manifest hsl(38 92% 55%) · Entry hsl(262 83% 58%) · Cleared hsl(160 84% 39%)
- Display font: Inter (semibold, tracking-tight). Body: Inter. ui-monospace for IDs/codes.
- Numbers: tabular-nums always (font-variant-numeric: tabular-nums)
- Borders: 1px hairlines; cards rest on white with soft 2-layer shadow, radius 12-16px
- Visual references: 6-blade aperture mark (assets/logo-mark.svg), wordmark
  (assets/wordmark.svg), dot-grid on dark, soft radial gold glow as the only bg accent

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The old way (chaos) — 3.5s — dark navy, jittering legacy fragments (green AS/400
   line, "12 tabs", faxed PDF, red 10MSCM), one quiet line.
2. The aperture closes — 4s — iris blades close over the chaos to a gold focus
   point; wordmark + tagline resolve on warm-white. Signature beat.
3. The action queue — 4.5s — calm inbox; typed AI brief + 3 ranked filing rows
   with status pills; top row flips to "Accepted".
4. The rejection coach — 4s — CBP rejection bubble, then 3 numbered fix steps
   stream in; caption.
5. Pipeline + proof — 3.5s — 4 stage dots light L→R; 3 count-up stats in tabular nums.
6. Outro / CTA — 2.5s — aperture mark + wordmark, closing line, mycargolens.com.

## Audio
- Audio role: warm, restrained corporate bed — present but quiet; the audio brags
  by getting quieter, not louder.
- Audio arc: low tense-warm under the chaos → one soft swell + "lock" on the
  aperture focus → steady calm bed under product scenes with sparse type ticks /
  UI clicks → fade to silence on the URL.
- Music: assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3
  (109.96 BPM, steady/clean — the polished/cinematic pick). Volume 0.30, fade out
  by the outro.
- Music treatment: start ~0.0s low; gentle swell into the aperture-focus beat;
  hold steady; fade to silence over the last ~1.5s.
- Music cue guidance: bundled preset at
  assets/music/cues/happy-beats-business-moves-vol-12...music-cues.json.
  Strong cues in window: 8.74s, 17.47s, 18.56s, 22.93s. Target one strong lock
  for the aperture-focus reveal near a strong cue (~8.74s is too late; the focus
  lands ~Scene 2 at ~5.5s — use natural timing there, or nudge toward the 5.34s
  beat). Beat grid (109 BPM, ~0.54s spacing) available for the 4 pipeline stage
  dots in Scene 5 (non-text accents — fine to hit consecutive beats). Restraint
  note: polished — 1–2 subtle locks max; never let music drive the cut.
- Audio-reactive treatment: subtle; let the gold focus point and the CTA glow
  breathe slightly with music RMS. No waveform/equalizer visuals, no strobing.
- Audio-coupled moments:
  - Scene 1 chaos — randomized keyboard keypresses + one glitch tick
  - Scene 2 aperture focus — one soft impact "lock"; music swells here
  - Scene 3 AI brief — subtle type ticks; soft "drop" as rows settle
  - Scene 4 coach — gentle type tick per streamed step
  - Scene 5 pipeline — soft UI click per stage dot (4); tick under stat count-ups
  - Scene 6 outro — music fades to silence; optional single soft bell accent low
- SFX selection guidance: coherent, sparse, professional. Keyboard set for typing,
  interface/glitch_002 for the one chaos glitch, impact/impactSoft_medium_* for the
  aperture lock (safest family), interface/drop_00* for gentle landings,
  ui/click* or interface/select_008 for stage dots, interface/bong_001 (low) for a
  soft outro accent if it fits. All SFX 0.45–0.70 volume (polished restraint).
- SFX analysis guidance: read assets/sfx/sfx-analysis.md (copied in); prefer low
  high-frequency-risk files for the repeated keypresses and stage dots.
- Exact SFX choice: Hyperframes picks filenames/timestamps/volume after the
  animation exists. Music bed on track-index 10; SFX on 11+ (never share an index).
- Audio files: copy chosen music + SFX into brag-output/composition/assets/.

## Hyperframes Instructions
- Composition id is `main` (scaffolded). Set root data-duration="22".
- Use the scaffolded Tailwind v4 browser runtime already wired in index.html.
- Build the aperture mark as inline SVG (6 blades) so it can animate closed to a
  gold center — reference assets/logo-mark.svg for geometry; recreate animatable.
- Show real product surfaces (action queue, rejection coach, pipeline) — the
  product doing its job, not describing it.
- Keep all text readable: short label ~0.8s settled; the AI brief sentence holds
  ~2s after it lands. Fast-in, then hold.
- Total duration 15–25s (target 22). Run `npm run check` (lint+validate+inspect);
  fix all errors before render. Render to ../brag.mp4.
