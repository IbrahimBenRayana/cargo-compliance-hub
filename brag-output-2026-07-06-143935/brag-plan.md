# Production Plan: MyCargoLens — "Follow One Shipment" (v2 launch film)

A 38.7-second, illustration-led launch film built to big-tech standards
(Stripe/Linear/Apple product-film grammar). Supersedes the 22s v1. The
duration exceeds the usual 15–25s law deliberately, per the brief: the film
adds an illustrated domain centerpiece and a compliance beat that make it
*informative*, not just declarative.

---

## 1 · Concept

### What is this app?
MyCargoLens is a US customs compliance platform — an inbox for CBP filings.
It ranks every filing by urgency, explains every CBP rejection in plain
English, and tracks UFLPA, ADD/CVD, and 314-day liquidation deadlines,
replacing 1995-era ABI terminals, faxes, and twelve browser tabs.

### The narrative device — one gold thread
The Focus Frame logo is four brackets locking onto one gold subject square.
This film makes that literal: **the gold square is one shipment**, and the
camera follows it end-to-end. It appears as the collapse point of the 1995
chaos, as the one gold container on the illustrated cargo ship, as the
urgent row the brackets lock onto in the queue, and as the subject that
clears the pipeline. Big-tech films run on one connective motif; this is ours.

### The angle
Every launch trailer screams. This one is the absence of noise — the brand
thesis ("an inbox for US customs, not another dashboard") acted out: chaos
→ focus → one calm surface → proof. The flex is restraint plus craft.

### Hook (first 2–3 seconds)
Dark navy. A blinking AS/400 terminal, a 12-tab browser strip, a faxed PDF,
a red `10MSCM REJECTED` chip drift in parallax under one quiet line:
**"US customs software hasn't changed since 1995."** Discomfort is the hook.

### Outro / punchline
Focus Frame mark + two-tone wordmark on warm white. **"File ISF, Entry, and
In-Bond with confidence."** → `mycargolens.com`. Music resolves to silence.

### User flow worth showing
1. **Entry** — ranked action queue surfaces the AI brief + the urgent ISF.
2. **Key action** — a CBP rejection (`10MSCM`) explained in numbered steps.
3. **Result** — the filing flips to Accepted; the lifecycle rail clears.

---

## 2 · Format · Tone · Duration

| | |
|---|---|
| Format | Landscape 1920×1080 |
| Frame rate | **60 fps** (fluidity is a requirement) |
| Duration | **38.7s** (user brief: ≥30s) |
| Tone preset | polished (cinematic-leaning) |
| Creative direction | quiet premium product film; illustrated domain storytelling in the brand's own hand-built SVG idiom |
| Interpretation | long holds, soft crossfades with a subtle 1.02→1.00 scale push; energy comes from resolution of clutter into order and from continuous ambient life in every frame — never from speed |

---

## 3 · Visual identity (from the codebase + design system)

- Warm white `hsl(220 25% 97%)` (calm scenes) · deep navy `hsl(222 47% 5%)` (hook)
- Ink `hsl(222 47% 8%)` · muted `hsl(220 14% 44%)` · border `hsl(220 20% 88%)`
- Gold `#FBBE24` (the one accent) · gold-deep `#D8920F` ("Lens", numerals on light)
- Frame navy `#1E2D4D` · frame reversed `#8C99B8` (on dark)
- Status: rose `hsl(0 72% 51%)` · amber `hsl(38 92% 50%)` · emerald `hsl(160 84% 39%)` · blue `hsl(217 91% 60%)` · Entry violet `hsl(262 83% 58%)`
- Type: Inter (semibold/bold, tracking-tight), `ui-monospace` for IDs/codes, tabular-nums on every number
- Logo: Focus Frame — brackets `M26 40L26 26L40 26` (+3 rotations), stroke 6.4 round; subject `rect 42,42 16×16 r4.6` gold

### Illustration idiom (must match `HeroScene`/brand exactly)
- `stroke="currentColor"`, **1.75px**, round caps/joins, `fill="none"`
- Gold used sparingly: waterline stripe (4px), one gold container (18% fill),
  checkmarks (2.5px), pulse halos
- Dashed 1px connectors at 15% opacity; horizon `4 6` dash
- Ambient CSS loops: bob 5–6s / 3–4px, wave drift 9–11s, pulse-glow 3s
- Soft radial gold glow as the only background accent — no boxes

---

## 4 · Illustration inventory (hand-built for this film)

| # | Asset | Contents | Used in |
|---|---|---|---|
| I1 | **Cargo ship** | hull with curved bow/stern, gold waterline stripe, bridge block + 3 windows + funnel with gold cap, 2-row container grid (14 slots, **one gold**), tug at stern | S3 |
| I2 | **Sea & sky** | dashed horizon, two wave paths drifting at different periods, two line clouds at 18% opacity | S3 |
| I3 | **Route arc** | dashed quadratic arc that draws itself L→R above the ship; 3 milestone chips pop along it | S3 |
| I4 | **Shield + halo** | brand shield outline, gold check, gold radial pulse halo | S5 |
| I5 | **Compliance donut** | grey ring + gold arc that draws to 92%, tabular count-up in the center | S6 |
| I6 | **Deadline clock** | line clock, gold minute hand sweeping, small pulse dot | S6 |
| I7 | **Focus Frame (animatable)** | brackets as 4 separate paths + subject rect — flies apart/locks; mini variant locks onto the urgent queue row | S2, S4, S8 |

---

## 5 · Storyboard (9 scenes · 38.7s)

Reading-time floor respected throughout: headlines ≥1.4s settled, chips ≥0.8s.

### S1 — THE OLD WAY — 0.0 → 4.0 (4.0s) · dark navy
Dot grid fades up. Eyebrow `US CUSTOMS SOFTWARE · 1995 → TODAY`; headline
**"US customs software hasn't changed since 1995."** (blur-in, expo).
Fragments stagger in with parallax drift (each drifts 6–10px on its own
period): AS/400 terminal, 12-tab strip, fax slip (−5°), red `✕ 10MSCM
REJECTED`, amber "ISF deadline missed". Rejection chip shudders at 2.7s.
Sequential/interaction: fragments arrive one-by-one, then all collapse
toward center at 3.2s (power3.inOut, blur 14px) — into the point where the
gold subject will appear.
Audio: 4 randomized keypresses; one glitch tick at the shudder. Music low.
Transition: collapse → hard resolve into S2.

### S2 — THE LOCK (brand reveal) — 4.0 → 8.5 (4.5s) · navy → warm
The gold subject square springs in at the collapse point (back.out 2.4) with
a glow bloom. Four brackets fly in from off-corner and lock around it,
staggered 100ms (expo.out 1.0s). A focus ring contracts onto the subject and
vanishes. On the lock: background resolves navy → warm white (0.8s), frame
recolors `#8C99B8 → #1E2D4D`. Mark lifts and scales down; wordmark
**MyCargo·Lens** (two-tone) + tagline **"US customs, finally in focus."**
(film tagline — ties the reticle mark to the 1995 hook) rack-focus in
beneath. Subject glow breathes once.
Audio: one soft impact on the lock (impactSoft_medium); music swells gently.
Transition: soft crossfade + 1.02 scale push → S3.

### S3 — THE VOYAGE (illustrated centerpiece) — 8.5 → 14.0 (5.5s) · warm
Brand-idiom sea scene (I1+I2+I3), navy `currentColor` on warm white, soft
gold radial behind. The ship **sails in from the left** (x −260→0 over
2.2s expo.out) while bobbing (5s loop); waves drift; clouds drift slowly.
The one **gold container glows softly** — the shipment. Above: the dashed
route arc draws itself L→R (stroke-dashoffset, 1.6s), and three milestone
chips pop along it in sequence, each holding ≥0.9s:
`ISF-10 · filed` (blue dot) → `Manifest · matched` (amber) → `Entry · accepted` (emerald).
Eyebrow `THE JOURNEY`; line: **"One shipment. Three federal filings."**
(settles ≥1.6s).
Sequential/interaction: ship entrance → arc draw → 3 chips L→R.
Audio: ship entrance lands on the 8.74s strong cue; card-place/drop per chip.
Transition: soft crossfade → S4.

### S4 — THE ACTION QUEUE (product) — 14.0 → 19.0 (5.0s) · warm
The inbox card. AI brief **types out**: `3 ISFs need attention. ISF-10
#X42191 — deadline in 4h.` Three ranked rows arrive (amber Deadline 4h /
rose Rejected / emerald Accepted). Then the motif returns: **four mini
Focus-Frame brackets draw around the urgent row** (the product "locks on"),
and its pill flips amber → emerald **Accepted** with a spring.
Caption: "Every filing, ranked by urgency."
Sequential/interaction: typing → rows ×3 → bracket lock → pill flip.
Audio: soft type ticks; drop per row; quiet click on the bracket lock;
warm impact on the flip (17.47s strong cue).
Transition: soft slide-up crossfade → S5.

### S5 — THE COACH — 19.0 → 23.5 (4.5s) · warm
Header: **"Plain English explains every CBP rejection."** Card: rejection
pill + `Invalid manufacturer ID (10MSCM)` mono. The coach visibly *works*:
an AI **thinking indicator** (gold subject bullet + three pulsing dots)
appears under the rejection while a **gold scan-line draws itself under the
error code** — the coach reading it. The indicator yields, and three
numbered fix steps stream in (hold ≥0.8s each): Read the CBP code. / Fix
the manufacturer ID. / Resubmit — we revalidate first. Beside the card, the
**shield illustration** (I4) fades in, gold check draws, halo pulses.
Sequential/interaction: rejection → thinking dots + scan → steps ×3 → shield.
Audio: quiet click as the scan completes; gentle drop per step; music steady.
Transition: soft crossfade → S6.

### S5.5 — ALWAYS WITH YOU (chat + human handoff) — 23.5 → 28.7 (5.2s) · warm
The real chat widget, animated through its actual state machine. Panel:
"Chat assistant" header with the mini Focus-Frame avatar and the gold
**AI assistant** badge. A user bubble pops: `Where's Entry #X41955?` —
typing dots appear, then the assistant answers **agentically** (it knows the
org's filings): `Cleared at 06:42 this morning — want the 7501?` (typed
reveal). Then the human path: the **"Talk to a human"** button pops, the
badge flips to emerald **"Live agent: Sarah"**, and a specialist row slides
in — avatar, "Sarah — compliance specialist", Online now, gold **24/7**
pill. Headline: **"Ask anything. Or talk to a human — 24/7."**
Sequential/interaction: user bubble → typing dots → typed AI reply →
button pop → badge flip → specialist row.
Audio: drop on the user bubble; quiet key ticks under the typed reply;
click on the button; select on the badge flip; drop as Sarah joins.
Transition: soft crossfade → S6.

### S6 — ALWAYS WATCHING (compliance) — 28.7 → 32.7 (4.0s) · warm
Eyebrow `ALWAYS WATCHING`. Left: **compliance donut** (I5) — gold arc draws
0→92, tabular count-up center, label "Compliance score". Right: three watch
chips slide in sequentially with the **clock illustration** (I6) whose gold
hand sweeps: `UFLPA screening` · `ADD/CVD scope` · `Liquidation · day 314`.
Line: **"UFLPA, ADD/CVD, and liquidation — watched for you."**
Sequential/interaction: donut draw + count-up, then chips ×3.
Audio: soft tick under the count-up; drop per chip; music steady.
Transition: soft crossfade → S7.

### S7 — THE PIPELINE + PROOF — 32.7 → 36.2 (3.5s) · warm
Lifecycle rail: 4 stage dots light L→R on the beat grid (ISF blue →
Manifest amber → Entry violet → Cleared emerald) with a blue→emerald
gradient fill chasing them. Stats settle + count up (tabular):
**99.8%** CBP acceptance · **<90s** avg filing · **100%** audit-ready.
Audio: click per dot (beat-gridded); drop under the stats.
Transition: soft crossfade → S8.

### S8 — OUTRO — 36.2 → 38.7 (2.5s) · warm
Focus Frame mark (navy) + **MyCargo·Lens** + **"File ISF, Entry, and
In-Bond with confidence."** + `mycargolens.com`. Gold glow breathes once;
music fades to silence on the URL.
Audio: one low bell accent, then quiet.

**Scene sum: 4.0+4.5+5.5+5.0+4.5+5.2+4.0+3.5+2.5 = 38.7s ✓**

---

## 6 · Motion system (the "extremely smooth" contract)

1. **60 fps render** (`-f 60 -q high`).
2. **Ease vocabulary:** `expo.out` for entrances, `back.out(2.2–2.4)` for
   pops, `power3.inOut` for collapses, `sine.inOut` for ambient loops.
   Nothing linear except deliberate typewriter steps.
3. **No dead frames:** every scene carries ambient life (waves, bob, cloud
   drift, glow breathing, halo pulse) via CSS loops layered under GSAP.
4. **Rack-focus grammar:** major reveals animate `filter: blur(8px) → 0`
   with y-travel — the "camera finds focus" feel.
5. **Continuity motif:** the gold square appears in S1's collapse point,
   S2's subject, S3's gold container, S4's bracket-locked row, S8's mark.
6. **Transitions:** 0.4s crossfades with a 1.02→1.00 scale settle on the
   incoming scene; hard kills (`tl.set`) at every clip boundary for
   seek-safe rendering.
7. **Reading floor:** fast-in **then hold** — nothing exits before its
   settled time (headlines ≥1.4s, chips ≥0.8s, stats ≥1.2s).

---

## 7 · Audio design

- **Role:** warm, restrained corporate bed; the audio brags by getting quieter.
- **Music:** `happy-beats-business-moves-vol-12` (109.96 BPM, 117s — covers
  33.5s), volume 0.26, gentle swell into the S2 lock, fade to silence over
  the final 1.5s.
- **Music cue guidance:** bundled preset covers 0–25s: strong cues 8.74s
  (→ S3 ship entrance), 17.47s (→ S4 pill flip), 18.56s, 22.93s, 24.56s.
  Beat spacing ≈0.545s. **Beyond 25s** (S7 dots ~33.3–34.9s): run
  `npx hyperframes beats` on the composition and snap the four dots to the
  detected grid (±0.10s); else fall back to 0.545s arithmetic spacing.
  Restraint: 2–3 strong locks max; cues never override readability.
- **SFX posture:** sparse, motion-matched, 0.24–0.55 volume. Keyboard set
  (S1, S4 typing), glitch_002 (S1), impactSoft_medium (S2 lock, S4 flip),
  card/drop family (chips, rows, steps), ui clicks (dots, bracket lock),
  bong_001 low (S8). Music track-index 10; SFX 11+; never share an index
  between overlapping clips.
- **Audio-reactive:** subtle stand-in (glow/halo breathing tweens); no
  waveforms. Extraction helper unavailable — documented, not blocking.

---

## 8 · Production pipeline & QA gates

| Phase | Work | Gate |
|---|---|---|
| P1 | This plan | storyboard sums to 33.5s ✓ |
| P2 | `composition-brief.md` + copy music/SFX/cue preset into `composition/assets/` | assets present |
| P3 | Scaffold (`hyperframes init`, Tailwind, landscape) + build all 7 illustrations as inline SVG + 8 scene DOM | — |
| P4 | GSAP choreography + audio wiring + `hyperframes beats` for >25s grid | `lint` **0 errors** |
| P5 | `validate` + `inspect` | 0 errors, overlaps annotated |
| P6 | `snapshot` at 9 beats incl. every text hold; visual review of each | every frame on-brand & readable |
| P7 | Render `-q high -f 60 -w 4` → `brag.mp4`; ffprobe check | 1920×1080@60, ~33.5s, AAC audio |
| P8 | `share-copy.txt` + delivery summary | files exist |

**Output dir:** `brag-output-2026-07-06-143935/` (timestamped; v1 kept intact).
**Model note:** production runs on Fable 5 per the session's `/model` switch.

## 9 · Risks & mitigations
- **SVG stroke animation cost at 60fps** → pre-size viewBoxes, `will-change`,
  avoid filters on large groups (blur only on text/cards).
- **Cue preset ends at 25s** → `hyperframes beats` fallback (P4).
- **33.5s vs 15–25s law** → explicit user requirement; every added second is
  a distinct informative beat (voyage, compliance), not padding.
- **Illustration fidelity** → geometry lifted from `HeroScene` idiom, not
  invented: 1.75px currentColor strokes, gold discipline, bob/pulse loops.
