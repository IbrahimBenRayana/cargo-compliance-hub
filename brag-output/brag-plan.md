# Brag Plan: MyCargoLens

## What is this app?
MyCargoLens is a US customs compliance platform that replaces the patchwork of
1990s-era customs software (AS/400 green-screen ABI terminals, faxed PDF
confirmations, twelve browser tabs to file one shipment) with a single calm
surface — an inbox for CBP filings. It ranks every filing by urgency, explains
every CBP rejection in plain English, and tracks ADD/CVD, UFLPA, and
liquidation deadlines.

## The angle
Every launch trailer screams. This one is the absence of noise — and that *is*
the brag. The brand thesis is literally "an inbox for US customs, not another
dashboard," and the logo is a 6-blade camera aperture: many things narrowing to
the one that matters right now. So the film opens in the chaos customs filers
have lived in for 30 years, then the aperture closes over it and everything
resolves into one calm, ranked queue. The flex isn't "we're powerful" — it's
"we made the noise stop." Confidence through restraint. Stripe/Linear/Mercury
energy, never Salesforce.

## Hook (first 2-3 seconds)
A dark navy field crawling with the old way: a blinking green AS/400 terminal
line, scattered fragments — "12 tabs", a faxed PDF, a rejection code in red
(`10MSCM`) — flickering with keyboard clatter and a glitch. One quiet line sits
above it: **"US customs software hasn't changed since 1995."** The discomfort of
the clutter is the hook; the viewer wants it to stop.

## Key moments (the middle)
- **The aperture closes.** The 6-blade iris mark sweeps in over the chaos and
  narrows to a single focused gold point — the noise collapses into it. The
  wordmark and tagline resolve out of the focus. This is the signature beat.
- **The action queue.** The calm inbox. An auto-generated AI brief types out:
  *"3 ISFs need attention. ISF-10 #X42191 — deadline in 4h."* Ranked filing rows
  carry real status pills (rose "Rejected", amber "Deadline 4h", emerald
  "Accepted"); one row flips to a green "Accepted" badge and settles.
- **The rejection coach.** A CBP rejection appears — *"Invalid manufacturer ID
  (10MSCM)"* — and the coach streams numbered plain-English fix steps (1, 2, 3).
- **The lifecycle pipeline + proof.** Stage dots light one by one: ISF (blue) →
  Manifest (amber) → Entry (violet) → Cleared (emerald), with count-up stats in
  tabular nums: 99.8% CBP acceptance · <90s avg filing · 100% audit-ready.

## Outro / punchline
Return to the calm aperture mark + wordmark on warm-white. Line: **"File ISF,
Entry, and In-Bond with confidence."** Then the URL: `mycargolens.com`. Music
settles to silence. No exclamation, no superlative — the quiet is the point.

## User flow worth showing
The product *in use*, three beats:
1. **Entry** — the ranked action queue surfaces the AI brief and the most urgent
   filing (ISF-10 #X42191, deadline 4h).
2. **Key action** — a CBP rejection (`10MSCM`) is explained by the coach in
   numbered steps; the filer fixes and resubmits.
3. **Result** — the filing flips to "Accepted", the lifecycle pipeline advances
   to Cleared. This is the centerpiece — the product doing its job, not
   describing it.

## Tone
- Preset: polished (cinematic-leaning)
- Creative direction: a quiet premium product film built on the brand's own
  chaos→calm arc and the aperture-closing-to-focus logo metaphor.
- Interpretation: fewer scenes, longer holds, soft crossfades. Energy comes from
  the *resolution* of clutter into order, not from speed or loudness. Restraint
  is the brand; the film must feel expensive and calm.

## Format: landscape — 1920x1080
## Duration: 22 seconds

## Visual identity (from the project)
- Background: warm-white `hsl(220 25% 97%)` for calm scenes; deep navy
  `hsl(222 47% 6%)` for the chaos hook
- Accent: amber gold `hsl(43 96% 56%)` (the only gold; lives in the aperture
  center, status, CTA glow)
- Text: near-black navy `hsl(222 47% 8%)` on light; `hsl(210 40% 94%)` on dark
- Status: rose `hsl(0 72% 51%)` rejected · amber `hsl(38 92% 50%)` deadline ·
  emerald `hsl(160 84% 39%)` accepted · blue `hsl(220 70% 55%)` info
- Lifecycle: ISF `hsl(217 91% 60%)` · Manifest `hsl(38 92% 55%)` · Entry
  `hsl(262 83% 58%)` · Cleared `hsl(160 84% 39%)`
- Display font: Inter (semibold, tracking-tight, optical sizing on)
- Body font: Inter; `ui-monospace` for filing IDs / HTS / error codes
- Numbers: tabular-nums, always
- Strongest visual element: the 6-blade aperture logo mark closing to a gold
  focus point (assets in mycargolens-design skill: `logo-mark.svg`,
  `wordmark.svg`)

## Share copy (draft)
US customs software hasn't changed since 1995. So we rebuilt it as an inbox —
ranked by urgency, every CBP rejection explained in plain English. This is
MyCargoLens.

## Audio direction
- Role: warm, restrained corporate bed — present but quiet, gets out of the way.
- Music: "Happy Beats / Business Moves" vol-12 (bundled, 109.96 BPM, steady/clean
  — the polished/cinematic pick). Optimistic, restrained.
- Music treatment: start low under the chaos, swell gently on the aperture-focus
  beat, hold steady under the product scenes, fade to silence on the outro.
- Music cue guidance: track `happy-beats-business-moves-vol-12`; bundled preset in
  `assets/music/cues/`. Strong cues in window: 8.74s, 17.47s, 18.56s, 22.93s.
  Target one subtle lock for the aperture-focus beat (~Scene 2; use natural timing
  or nudge toward the 5.34s beat). Use the beat grid (~0.54s spacing) only for the
  pipeline stage dots in Scene 5 (non-text accents). Restraint note: this is
  polished — keep cues subtle, never let music drive the cut.
- Audio-reactive treatment: subtle; let the gold focus point and CTA glow breathe
  with music energy. No waveform bars, no flashing.
- SFX posture: sparse, professional, motion-matched. Keyboard clatter + one
  glitch in the chaos; a single soft "lock" impact on the aperture focus; quiet
  UI clicks for the queue settle and pipeline dots; gentle type ticks for the AI
  brief and coach steps.
- Audio-coupled moments: typed AI brief, typed coach steps, stage-dot sequence,
  stat count-ups, the aperture lock.
- Restraint rule: no riser/whoosh stacks, no big drops, no exclamation in sound.
  If a cue feels like a hype trailer, cut it. The quiet is the brand.

## Storyboard

### Scene 1 — The old way (chaos) — 3.5s
Deep navy field (`hsl(222 47% 6%)`) with a faint dot-grid. Fragments of legacy
customs work flicker in and jitter: a blinking green AS/400 terminal line, a
"12 tabs" browser strip, a faxed-PDF corner, a red rejection code `10MSCM`.
Slightly overwhelming, deliberately cluttered. Quiet line holds above it:
**"US customs software hasn't changed since 1995."**
Sequential/interaction: yes — fragments stutter in out of sync, building clutter.
Audio intent: low unease; the noise the product will silence.
Audio-coupled idea: keyboard keypress clatter + one glitch tick.
Music: low, sparse, tense-but-warm.
Transition mood: dramatic (the aperture sweeps in) → Scene 2

### Scene 2 — The aperture closes (brand reveal) — 4s
The 6-blade aperture iris (logo mark) sweeps over the chaos and narrows; the
clutter is pulled into and collapses behind the closing blades, resolving to a
single focused gold center point. Out of that point, the **MyCargoLens** wordmark
and tagline resolve: **"An inbox for US customs. Not another dashboard."** Field
settles to warm-white. Hold on the calm.
Sequential/interaction: yes — blades close, then wordmark + tagline fade up.
Audio intent: relief and arrival; the moment the noise stops.
Audio-coupled idea: one soft "lock" impact on the focus; music swells gently here.
Music: gentle swell on the focus beat, then settle.
Transition mood: soft crossfade → Scene 3

### Scene 3 — The action queue (entry) — 4.5s
The calm product inbox on warm-white. A glass-headed panel titled "Action queue".
An AI brief types out in the header: **"3 ISFs need attention. ISF-10 #X42191 —
deadline in 4h."** Below, three ranked filing rows with monospace IDs and status
pills: one rose "Rejected", one amber "Deadline 4h", one emerald "Accepted".
The top row settles into place last.
Sequential/interaction: yes — AI brief types out, then rows arrive top-to-bottom;
hold the full brief + rows ~2s after they land so it reads.
Audio intent: calm competence; things landing in their right place.
Audio-coupled idea: subtle type ticks for the brief; one quiet UI click as rows settle.
Music: steady warm bed.
Transition mood: soft slide → Scene 4

### Scene 4 — The rejection coach (key action) — 4s
A chat-style panel. A CBP rejection bubble appears: **"Invalid manufacturer ID
(10MSCM)"**. Then the coach streams three numbered plain-English fix steps
(1 · 2 · 3) one by one. Caption: **"Plain English explains every CBP rejection."**
Sequential/interaction: yes — rejection appears, then steps 1→2→3 stream in;
hold each step ~0.8s, full set held ~1s at the end.
Audio intent: reassurance; the hard thing made legible.
Audio-coupled idea: gentle type ticks per streamed step.
Music: steady warm bed.
Transition mood: soft crossfade → Scene 5

### Scene 5 — Pipeline + proof — 3.5s
The lifecycle pipeline as a horizontal rail. Stage dots light one by one:
ISF (blue) → Manifest (amber) → Entry (violet) → Cleared (emerald). As Cleared
lights, three count-up stats settle in tabular nums:
**99.8% CBP acceptance · <90s avg filing · 100% audit-ready.**
Sequential/interaction: yes — 4 stage dots light left-to-right (beat-grid windows
ok here, accents not text), then stats count up.
Audio intent: momentum resolving to confidence.
Audio-coupled idea: soft UI click per stage dot; ticks under the count-ups.
Music: steady, slight lift into the outro.
Transition mood: soft crossfade → Scene 6

### Scene 6 — Outro / CTA — 2.5s
Warm-white. The aperture mark + **MyCargoLens** wordmark, centered and calm.
Line: **"File ISF, Entry, and In-Bond with confidence."** Then the URL:
**mycargolens.com**. Gold CTA glow breathes once.
Sequential/interaction: none — clean hold.
Audio intent: settled, done; quiet confidence.
Audio-coupled idea: music fades to silence on the URL.
Music: fade out.
Transition mood: end.

**Music mood for this video:** warm, restrained, optimistic corporate bed (not upbeat-loud).
**Audio summary:** Low tense-warm noise under the chaos → a single soft swell and
lock on the aperture focus → a steady calm bed under the product scenes with
sparse type ticks and UI clicks → fade to silence on the URL. The audio brags by
getting quieter, not louder.
