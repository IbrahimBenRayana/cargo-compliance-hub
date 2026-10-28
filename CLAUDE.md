# MyCargoLens — working agreement

## Always route through the agent skills

Addy Osmani's engineering skills are installed in `.claude/skills/` (shared checklists in
`.claude/references/`). **Before starting any piece of work, check whether a skill covers it and
invoke it.** These are workflows, not suggestions — follow their steps in order, including the
verification step. Multiple skills usually apply to one task; run them in sequence.

| When you are… | Invoke |
|---|---|
| Given a vague or underspecified ask | `interview-me`, then `idea-refine` |
| Starting a feature with no spec | `spec-driven-development` → `planning-and-task-breakdown` |
| Writing code that spans >1 file | `incremental-implementation` |
| Building UI | `frontend-ui-engineering` (+ the design skills below) |
| Designing an endpoint or module boundary | `api-and-interface-design` |
| Working against a framework/library API | `source-driven-development` |
| In high-stakes, security-sensitive, or unfamiliar code | `doubt-driven-development` |
| Implementing logic or fixing a bug | `test-driven-development` |
| Verifying anything in a browser | `browser-testing-with-devtools` |
| Facing a failure, broken build, or surprise | `debugging-and-error-recovery` |
| About to merge | `code-review-and-quality` → `code-simplification` |
| Touching auth, user input, storage, integrations | `security-and-hardening` |
| Chasing latency, Core Web Vitals, N+1s | `performance-optimization` |
| Committing, branching, releasing | `git-workflow-and-versioning` |
| Changing the pipeline | `ci-cd-and-automation` |
| Adding logs, metrics, traces, alerts | `observability-and-instrumentation` |
| Removing or migrating a system | `deprecation-and-migration` |
| Making an architectural decision | `documentation-and-adrs` |
| Deploying | `shipping-and-launch` |

`using-agent-skills` is the meta-skill — it holds the full routing tree and the non-negotiable
operating behaviors (surface assumptions, manage confusion, push back when warranted, enforce
simplicity, scope discipline, verify rather than assume). The project-wide bar for every change is
`.claude/references/definition-of-done.md`.

Design and motion work additionally uses the skills in `.claude/skills/`: `apple-design`,
`emil-design-eng`, `animate`, `review-animations`, plus `mycargolens-design` for brand.

Note: `.claude/skills/` and `.claude/references/` are gitignored — they are installed per machine.
Reinstall with `npx skills add addyosmani/agent-skills` (whole-repo, so `../../references/` resolves).

## Project facts worth knowing

- **Deploys are staging-first.** Every change goes to the `staging` branch →
  staging.mycargolens.com for testing, then to `main`. Prod (app.mycargolens.com +
  mycargolens.com landing) must stay intact.
- **The marketing site is `landing/`** — a separate Next.js app with its own `package.json`,
  `CLAUDE.md`, and Docker image. It reads its own Next.js docs rule in `landing/AGENTS.md`.
- **Typechecks use explicit configs**: frontend `tsc --noEmit -p tsconfig.app.json`; server
  `tsconfig.build.json`. The root `tsconfig.json` checks nothing.
- **Never claim a live direct CBP ABI connection** in product or marketing copy. The native ABI
  engine is in CBP certification; filings currently route through the CustomsCity gateway.
