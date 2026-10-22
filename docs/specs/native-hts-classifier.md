# Spec: Native HTS classifier (replaces CustomsCity `/api/hts-classifier`)

Status: APPROVED in principle 2026-10-21 (Ibrahim), revised for the accuracy bar below.
Origin: testing week BUG-014 / TOOL-02.

## Objective

Brokers and importers describe a product and get the right 10-digit HTS code, or are told
exactly why the description isn't enough yet. The HTS code sets the duty; a wrong code can
cost a business a great deal (underpaid duty, penalties under 19 USC 1592, or overpaying for
years). So the engine must be:

- **Correct:** only real lines from the current schedule; the right one near the top.
- **Honest about doubt:** when the description is vague, it says so, asks the questions that
  matter, and offers "did you mean ..." readings instead of guessing.
- **Transparent about money:** every suggestion shows its duty rate, and the engine warns when
  plausible alternatives carry very different duty.
- **Never final on its own:** the user always picks; nothing auto-fills a filing.

No classifier can promise zero errors (CBP rulings themselves sometimes differ). The design goal
is that a wrong code is rare, and that when one is possible, the user sees it before filing.

Today both entry points call CustomsCity, which answers every request with
`AI_CLASSIFICATION_DISABLED`, and the app wrongly says "no results". Per the native-only
directive we build it on our own data and our own AI.

**Plans:** available on every plan for now (decision 2026-10-21; plans and marketing to be
revisited). Both routes drop the `HTS_CLASSIFICATION` capability gate; the wand and the
Classifier card show for everyone.

Entry points:
- the wand next to **HTS Code** in the ISF wizard (`src/components/HTSAutocomplete.tsx`,
  `POST /api/v1/integrations/hts-classify`)
- the **HTS Classifier** card on Compliance → Classification (`POST /api/v1/compliance/classify-hts`)

## How the engine works

### Step 1. Understand the product (AI)
The AI reads the description and returns structured facts: what it is, what it's made of,
what it does, how it's used, state (assembled, parts, kit), and anything that drives
classification for that kind of good (e.g. battery chemistry, textile fibre content, knit vs.
woven). It also rates **sufficiency**: can a 10-digit code be chosen from what was given?
It produces search terms in tariff vocabulary ("e-bike battery" → "lithium-ion accumulators",
"electric storage batteries").

### Step 2. Too vague? Ask, don't guess
If sufficiency is low, the engine returns no codes and instead:
- `status: "needs_detail"`, a plain sentence saying what's missing
  ("'Battery' could be several headings; the chemistry and use decide the code."),
- up to 3 **questions** that change the code ("Lithium-ion, lead-acid or nickel?"),
- 2-4 **did-you-mean** readings, each a complete description the user can click to re-run
  ("Lithium-ion battery pack for electric bicycles").
If the description is partly enough (heading clear, subheading not), it returns suggestions
**and** the questions, with confidence reduced.

### Step 3. Retrieve real candidates (our data)
Search `hts_rate_lines` (full USITC schedule, ~20k 10-digit lines, current revision) with the
expanded terms. Each 10-digit line is matched on its **full path text** (own description plus
its 8/6/4-digit and chapter parents, because many leaves just say "Other"). Keep the best ~60
lines, spread across the headings that matched, so the right heading is in the pool even when
the wording differs.

### Step 4. Classify the way a broker does (AI, GRI order)
The AI picks top-down, following the General Rules of Interpretation: heading first (GRI 1),
then subheading (GRI 6), then the statistical suffix, choosing **only from the candidate list**.
It returns up to 5 codes with confidence and a short reason that names the deciding words of
the heading or subheading.

### Step 5. Verify (second, independent AI pass)
A separate verification call gets the product facts and the top pick's full path text and
answers: does this line fit, yes or no, and why. A "no", or disagreement between the two
passes, lowers confidence and adds a warning. Temperature 0 for both passes.

### Step 6. Guard rails (code, not AI)
- Drop any code not in the candidate list (the AI cannot invent a code).
- Attach each code's **General duty rate** and units from `hts_rate_lines`.
- **Duty spread warning:** if the suggestions' rates differ materially (e.g. Free vs. 25%),
  say so plainly.
- Note that Chapter 99 (Section 301/232 etc.) and AD/CVD may add duty on top, which the
  suggestion does not include.
- Confidence labels the user can act on: **High** (verified, clear lead), **Medium**,
  **Low** (shown with "check before you file").
- Every response carries the notice: a suggestion, not a binding ruling; the importer is
  responsible for the declared code; CBP binding rulings (19 CFR 177) are the route to
  certainty.

### Fallbacks (always honest)
- AI not configured or failing → keyword-only matches, labelled "based on matching words
  only", no confidence shown.
- No match → no codes, "No matching HTS lines. Try describing what it is and what it's made of."
- Our own failure → HTTP 503 "HTS suggestions are temporarily unavailable." Never a fake
  "no results".

## Response shape (both routes)

```ts
{
  status: 'ok' | 'needs_detail' | 'keyword_only' | 'no_match',
  message?: string,                       // plain sentence for the user
  questions?: string[],                   // what would change the code
  didYouMean?: string[],                  // full descriptions to re-run
  suggestions: Array<{
    code: string,                         // 10 digits, always a real schedule line
    description: string,                  // full path text, readable
    confidence: 'high' | 'medium' | 'low' | null,
    reason?: string,
    generalRate: string, units: string[],
    warnings?: string[],
  }>,
  dutySpreadWarning?: string,
  notice: string,                         // not-a-ruling notice
  revision: string,                       // HTS edition used
}
```
The old fields (`code`, `description`, `score`) stay readable so nothing breaks mid-rollout.

## Accuracy is measured, not assumed

- **Evaluation set:** at least 60 real CBP rulings from CROSS (rulings.cbp.gov) across the
  chapters our users hit most (electronics/84-85, textiles/61-63, plastics/39, metals/72-73,
  furniture/94, toys/95, vehicles and parts/87), each with the product description and the
  ruled code, citing the ruling number. Stored as a fixture in the repo; refreshed when the
  schedule revision changes.
- **Script:** `server/scripts/htsEval.ts` runs the set and reports top-1 / top-3 at 4, 6 and
  10 digits, the "needs detail" rate, and latency.
- **Release gate (proposed, confirm after the first run):** heading top-1 ≥ 90%, 10-digit
  in top-3 ≥ 85%, and zero cases where a wrong code is shown as High confidence.
- Vague-input set: ~15 deliberately vague descriptions ("parts", "battery", "shirt"); all must
  come back `needs_detail` with useful questions.

## Tech stack, commands, structure

Express + Prisma + Postgres, React + React Query, Vitest; AI through `server/src/services/ai.ts`
(OpenAI client, training-data storage off). No new dependencies.

- Server tests: `cd server && ./node_modules/.bin/vitest run`
- Server typecheck: `cd server && ./node_modules/.bin/tsc --noEmit -p tsconfig.build.json`
- Frontend tests / typecheck: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- Evaluation: `cd server && npx tsx scripts/htsEval.ts` (against staging data)

New code in `server/src/services/htsClassifier/`: `understand.ts` (step 1-2), `retrieve.ts`
(step 3), `classify.ts` (step 4), `verify.ts` (step 5), `guards.ts` (step 6), `index.ts`
(`classifyProduct()`), tests in `__tests__/`. Routes `integrations.ts` and `compliance.ts` call
`classifyProduct()`; `classifyHTS` leaves the gateway contract. UI: the wand popover and the
Classifier card render status, questions, did-you-mean chips, confidence, duty rate and
warnings.

## Boundaries

- **Always:** real schedule lines only; show duty rate and the not-a-ruling notice; ask when
  vague; keep the per-user AI rate limit; log latency and tokens; measure on the eval set
  before every release.
- **Ask first:** database schema changes (e.g. a classification audit log or a full-text
  index); changing AI provider or model; changing the release-gate thresholds.
- **Never:** call CustomsCity for classification; name CustomsCity in the UI; auto-fill a
  code into a filing; present a suggestion as a binding ruling; send anything but the product
  description to the AI.

## Success criteria

1. Wand and Classifier card work on staging for every plan, with no CustomsCity call.
2. Every suggested code is a real 10-digit line in the current schedule.
3. Release gate met on the CROSS evaluation set; zero wrong codes at High confidence.
4. All vague-input cases return `needs_detail` with questions and did-you-mean readings.
5. Duty rate on every suggestion; spread warning when rates differ materially.
6. p95 under 8 s on staging (three AI calls); keyword fallback under 1 s.
7. Honest fallbacks: keyword-only when AI is off, 503 "temporarily unavailable" on our failure.
8. Unit, route and UI tests pass; typechecks clean.

## Decisions (2026-10-21)

- **AI model:** stay on OpenAI; the classifier gets its own `HTS_AI_MODEL` setting (default:
  `AI_MODEL`, which is `gpt-4o` on staging). Compare against a stronger OpenAI reasoning model
  on the eval set and pick the one that clears the gate.
- **Audit log:** yes. New table `hts_classifications` (org, user, description, status,
  suggestions shown, model, HTS revision, latency, code picked if reported back, time).

## Implementation plan (ordered; each task ends green: tests + typecheck)

1. **Audit table**: Prisma model + migration `hts_classifications`. Files: `schema.prisma`,
   migration. Verify: migration applies locally; server typecheck.
2. **Retrieve** (`retrieve.ts`): full-path text for 10-digit lines (parents by prefix), term
   scoring, heading spread, top ~60. Verify: unit tests on a fixture slice of real HTS rows
   (battery, laptop, T-shirt, bolts) find the right lines.
3. **Understand** (`understand.ts`): AI step 1 prompt, Zod-validated JSON (facts,
   sufficiency, search terms, questions, did-you-mean). Verify: unit tests with mocked AI,
   including malformed JSON → safe fallback.
4. **Classify + verify** (`classify.ts`, `verify.ts`): GRI-ordered pick from candidates only;
   independent yes/no verification. Verify: unit tests; invented codes are dropped; a "no"
   lowers confidence.
5. **Guards + orchestration** (`guards.ts`, `index.ts`): duty rate, spread warning, confidence
   labels, notice, fallbacks, audit-log write. Verify: unit tests per branch.
6. **Routes**: both endpoints call `classifyProduct()`, no capability gate, 503 on our failure;
   `classifyHTS` leaves the gateway contract. Verify: route tests; server suite.
7. **UI**: wand popover and Classifier card show status, questions, did-you-mean chips,
   confidence, duty rate, warnings, notice; shown on every plan. Verify: component tests;
   frontend suite; typecheck.
8. **Evaluation**: `scripts/htsEval.ts` over the CROSS fixture against staging data; tune
   prompts until the gate is met; record results here. Verify: report meets the gate.
9. **Staging**: deploy, sweep, manual review by Ibrahim; tracker TOOL-02 and BUG-014.

## v3: precedent rulings, legal notes, deciding-fact questions, cross-model check

Status: direction approved by Ibrahim 2026-10-21. v2 on staging scored heading@1 77%,
10-digit@1 63%, 10-digit top-3 68% (gpt-5.5, effort low), below the gate. The right heading was
in the candidate headings ~91-94% of the time, but the chosen heading held the right code only
~78-81%: the heading choice is the main error, and a same-model second opinion shares the first
pick's blind spots.

### 1. Precedent rulings (CBP CROSS)
- `precedent.ts` searches the public CROSS API (`rulings.cbp.gov/api/search?term=`) with
  2-3 short queries (the understand step's `rulingQueries`, e.g. "cat toy", "plastic jugs",
  falling back to its product name). CROSS search ANDs the words, so queries stay short.
- Results are merged (rulings found by several queries rank first, then by CROSS relevance),
  revoked rulings and rulings without a tariff number are dropped, Chapter 99 numbers ignored.
  The best 6 go to the prompts as subject + ruled code + date; the best 3 also get a short
  excerpt of the ruling text (the goods and the holding sentences), fetched from
  `api/ruling/{N}`.
- Ruled codes are "as ruled at the time": they may have been renumbered, so precedent never
  becomes a suggestion by itself. Precedent headings that exist in today's schedule join the
  candidate headings (better recall), and the AI still picks only from real schedule lines.
- Cached in memory (search and ruling text, 24 h, bounded size); 4 s timeout; any CROSS
  failure means "no precedent", never an error. No new table (a persistent rulings cache
  would be a schema change: ask first).
- **Evaluation honesty:** the eval passes each case's own ruling number as `exclude`; a
  ruling is dropped if it is that ruling, lists it among its related rulings, or cites it in
  its text. The eval runs with and without precedent (`HTS_PRECEDENT=off`).

### 2. Legal notes (USITC, public domain)
- `server/scripts/gen-hts-notes.py` extracts the section and chapter notes (legal notes,
  subheading notes, additional U.S. notes, statistical notes) from the USITC chapter PDFs into
  a generated module `htsNotes.ts` (~0.5 MB, Revision 21 (2026)); re-run on a new revision.
  Chosen over a DB ingest (no schema change, no runtime dependency on hts.usitc.gov).
- Heading step: section + chapter legal notes for the candidate headings' chapters. Line
  step and second opinion: all notes of the chosen heading's chapter and section. Long notes
  are trimmed to the numbered notes that mention the candidate headings, within a budget.

### 3. Deciding-fact questions
The line-pick reply gains `decidingQuestion`: when the top lines differ by a fact the
description does not state (fibre content, knit/woven, voltage, use, ...), that exact
question. If it is present and the pick is not clear-cut (second pick within 0.3, or the
second opinion disagrees), the result is `needs_detail` with that question and the
suggestions, and the top pick cannot be labelled "Two independent checks agree".

### 4. Cross-model second opinion
`HTS_AI_VERIFY_MODEL` (default: the classifier model) runs the blind second opinion on a
different model, so agreement is evidence from two models, not one model twice.
Labels unchanged: "Two independent checks agree" / "Review before you file" /
"Checks disagree: check carefully" / "Alternative".

### v3 evaluation results

**Run 1, 2026-10-21 (gpt-5.5, effort low, same-model second opinion): INCOMPLETE.** The
OpenAI account ran out of credit (`credit_balance_exhausted`) about halfway through both runs
(with and without precedent, run concurrently), so their totals are not valid. On the 49
CROSS cases that completed cleanly in both runs:

| | heading@1 | 10-digit@1 | wrong at "Two independent checks agree" |
|---|---|---|---|
| with precedent (own + citing rulings excluded) | 43/49 (88%) | 37/49 (76%) | 4 |
| without precedent (notes + deciding questions only) | 43/49 (88%) | 34/49 (69%) | 4 |

Small sample; indicative only. Precedent was found for ~2/3 of cases; many hits were 1990s
rulings with renumbered codes (fixed: recent rulings now rank first). All 4 wrong
"agree" labels had a same-model second opinion agreeing (shoe trees 3926 vs 3924, sweater
6102 vs 6110, fibre content 6108.32 vs 6108.92, a 6307.90.98 suffix), which is what the
cross-model check targets. Latency p50 ~16 s, p95 ~40 s (four cases at a time).
The eval now aborts when the account is out of credit instead of scoring failures.

**Full runs, 2026-10-22 (gpt-5.5 effort low, o3 second opinion, precedent on with own and
citing rulings excluded; 101 rulings + 15 vague):**

| run | heading@1 | 10-digit@1 | 10-digit top-3 | right heading among candidates | wrong at "agree" | vague asked |
|---|---|---|---|---|---|---|
| v2 baseline (same-model check) | 77% | 63% | 68% | ~91-94% | 10 | 15/15 |
| v3 run A | 80.2% | 69.0% | 72.0% | 92.1% | 10 of 60 | 15/15 |
| v3 run B (+ detailed descriptions no longer refused as "too vague") | **82.2%** | **73.0%** | **77.0%** | **97.0%** | **10 of 52** | 15/15 |
| gate | ≥ 90% | | ≥ 85% | | 0 | all |

**Gate: not met.** Run B (current staging code) is the best setup measured. Latency p50 ~26 s,
p95 ~43 s (four cases at a time). Cost per classification ~$0.12 (gpt-5.5 $5/$30 per 1M
tokens, o3 $2/$8): ~18k input tokens for gpt-5.5 and ~8.5k for o3; a full eval run is ~$13.5.
The without-precedent full run was not repeated to save credit; the partial comparison above
(+7 points at 10 digits on 49 cases) is the only ablation.

What moved the numbers: precedent headings lifted candidate-heading recall from ~92% to 97%;
refusing nothing that is described in 12+ words recovered 6 cases that were wrongly "too
vague". What did not: the heading choice itself (the right heading is a candidate 97% of the
time but chosen 82%), and the cross-model check: with o3 as the blind second opinion, 10 wrong
codes still got "Two independent checks agree". Of those, 4 are a wrong statistical suffix or
8-digit line inside the right heading, 6 a wrong heading or subheading, and in 7 a prior CBP
ruling on similar goods has exactly the wrongly chosen code (CBP ruled differently this time,
or the fixture summary lacks the deciding fact). Requiring precedent support for "agree"
would leave 7 of 36 wrong, so no label rule built on these signals reaches zero.
