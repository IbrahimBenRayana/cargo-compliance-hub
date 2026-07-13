# Marketing Site Remediation Plan — Final QA (2026-07)

Source: `mycargolens-final-audit/MyCargoLens Final Website QA.md`, pa11y run against `/platform/compliance`, Lighthouse + linkinator artifacts.

Scope of this plan: every P1/P2 finding + every watchlist item that has a concrete surface to change. Legal + Lighthouse-perf-on-local left for staging re-measurement.

## Findings map → PR grouping

The 7 findings + 4 watchlist items collapse into **5 shippable PRs**. Sequenced so each stands alone (revertable), and so the two low-risk ones ship first and buy us CI confidence for the bigger changes.

| PR | Finding IDs | Risk | Wall-clock |
|---|---|---|---|
| PR-A: SEO canonicals per route | F07 | ~zero | 30 min |
| PR-B: Nav — search, tablet clip | F02, F06 | low | 45 min |
| PR-C: A11y — labels + light-mode contrast | F03, F04 | medium | 2–3 h |
| PR-D: Funnel copy alignment | F05 | medium | 1–2 h |
| PR-E: API config + watchlist verification | F01 + watchlist | env-only | 30 min |

Deliberately **not** bundling A11y with copy — the a11y pass touches design tokens across every page and needs a clean, focused review.

---

## PR-A — Per-route canonicals (F07)

**Root cause:** `landing/app/layout.tsx:48-50` sets `alternates.canonical: "/"`. Next 16 propagates root metadata to every route unless a child page overrides it. Every page currently emits `<link rel="canonical" href="https://mycargolens.com">`.

**Fix — mechanical, one-line each:**

1. Remove `alternates.canonical` from [layout.tsx:48-50](landing/app/layout.tsx#L48-L50). Root layout should not claim `/` — the home page's own `page.tsx` should.
2. Add `alternates: { canonical: "/<route>" }` to each of the 13 page-level `metadata` exports:
   - `app/page.tsx` → `/`
   - `app/pricing/page.tsx` → `/pricing`
   - `app/about/page.tsx`, `changelog/page.tsx`, `security/page.tsx`, `solutions/page.tsx`, `contact/page.tsx`, `book-a-demo/page.tsx`, `features/page.tsx`, `why-mycargolens/page.tsx`
   - `app/platform/{ai,automation,compliance,filings,lifecycle}/page.tsx`
   - `app/legal/{privacy,terms}/page.tsx`
3. `metadataBase` on the root layout keeps resolving relative paths against `https://mycargolens.com`, so `"/pricing"` becomes the fully-qualified canonical automatically. Do not hard-code the domain.

**Verify:** `curl -s https://mycargolens.com/pricing | grep canonical` returns `href="https://mycargolens.com/pricing"`. Repeat for one platform page.

---

## PR-B — Nav: hide disabled search + fix tablet clip (F02, F06)

**F06 — disabled search control.** [components/nav.tsx:328](landing/components/nav.tsx#L328) renders a `button[aria-label="Search (coming soon)"][disabled]`. A visible-but-broken affordance is worse than no affordance.

- Simplest fix: remove the button entirely for now. The visual weight it added on the nav gets recovered as breathing room for the CTA — which addresses F02 in the same edit.
- Alternative if we want to keep future optionality: gate on `process.env.NEXT_PUBLIC_SEARCH_ENABLED === "true"` and default to `undefined` → nothing renders.

Recommendation: remove now, re-introduce with the real command-palette PR later. Half-built UI is a broken promise.

**F02 — tablet nav clips CTA at 768px.** Current breakpoint switches to mobile nav at `lg` (1024px). Between 768 and 1024 the desktop nav is active but not wide enough for logo + 4 primary links + Platform dropdown + CTA. Document width measures 776px against a 768px viewport.

Two orthogonal fixes; do both:

- Switch the nav's `md`/`lg` toggles so **`md` (768px) is treated as mobile**: `hidden md:flex` → `hidden lg:flex` for the desktop cluster; `flex md:hidden` → `flex lg:hidden` for the hamburger. This is the boundary Stripe/Linear use — a compressed desktop nav at tablet width always feels wrong.
- Removing the disabled search (above) also reclaims ~44px which handles residual overflow on the widest tablet.

**Verify:** Playwright at 768×1024, 900×1200, 1024×768 — no horizontal overflow, hamburger visible at 768/900, desktop cluster visible at 1024+.

---

## PR-C — A11y: mock inputs + light-mode contrast (F03, F04)

Two structurally different fixes; ship together because both touch shared design tokens.

### F03 — Compliance mockup uses real `<input readonly>` elements

Locations confirmed:
- [app/platform/compliance/compliance-client.tsx:579-585](landing/app/platform/compliance/compliance-client.tsx#L579-L585) — `0207.13.00 · Chicken, fresh`
- [app/platform/compliance/compliance-client.tsx:600-604](landing/app/platform/compliance/compliance-client.tsx#L600-L604) — `12-3456789`
- [app/platform/compliance/compliance-client.tsx:621-625](landing/app/platform/compliance/compliance-client.tsx#L621-L625) — `polyester athletic socks, women's`
- Same pattern likely echoes in [ai-client.tsx](landing/app/platform/ai/ai-client.tsx) — grep confirmed the same literals live there too.

These are decorative — they're not part of a form, no submit handler, no state. The right fix is to stop rendering them as form controls:

```tsx
// Before
<input readOnly value="0207.13.00 · Chicken, fresh" className="..." />
// After
<div role="presentation" aria-hidden="true" className="... font-mono text-xs">
  0207.13.00 · Chicken, fresh
</div>
```

Keep the visual (same border, same padding, same font); screen readers stop announcing them as unlabeled fields. This is what Stripe does on their pricing calculator mockups.

### F04 — Light-mode contrast failures

pa11y reported 30+ contrast fails on light mode. They cluster into 4 token buckets, not 30 individual fixes:

1. **`text-muted-foreground`** — used on nav links, footer links + headings, section eyebrows, muted copy, section-status footer strip. In light mode the current value fails 4.5:1 for body text. Ship a darker light-mode `--muted-foreground`. Current is roughly slate-500; move to slate-600 or slate-700.
2. **`text-gradient-gold`** utility applied to small eyebrow labels ("Platform", `text-[11px]`) — gradient text at 11px never passes contrast reliably. Ship a solid `--gold-eyebrow` token used for `text-[11px]` eyebrows and reserve the gradient for h1/h2 accents only.
3. **Severity badge text** — e.g. the "Live" badge on `/features`, `text-emerald-700 dark:text-emerald-300` (light-mode fine on paper but the ring + tint reduce effective contrast against the tinted background). Bump to `emerald-800` on light mode; verify with axe.
4. **SVG mockup labels** — the animated Compliance Center SVG has 15+ text elements at `font-size: 7-10` with `fill-opacity: 0.55-0.8`. In light mode against a near-white background these fail. Options: (a) raise fill-opacity to ≥0.85 and add `aria-hidden="true"` on the SVG so axe skips it *and* the labels are still legible; (b) mark the SVG `role="img"` with an `aria-label` describing it, then hide inner text from a11y tree. Recommendation: **(a) + (b)** — bump the visible opacity for sighted users, add `role="img"` + `aria-label="Compliance Center preview"` so the whole graphic gets one accessible name instead of 30 unnamed text fragments.

Landing has one design-tokens file (`app/globals.css`) — buckets (1)–(3) are one-file edits. Bucket (4) is per-SVG. After the changes, re-run `pa11y https://mycargolens.com/platform/compliance` and confirm 0 errors.

**Cross-check:** current design-tokens include the `impeccable` `text-gradient-gold` utility which the design-taste skill has been happy with — we're not killing it, only pulling it off the tiny 11px eyebrows where it fails contrast every time.

---

## PR-D — Funnel copy alignment (F05)

**Current mixed messaging** (from grep — every match, confirmed):

- [components/sections/closing-cta.tsx:80](landing/components/sections/closing-cta.tsx#L80) — "A 20-minute demo. No credit card. Cancel anytime." — visible on **every** page since ClosingCta is used site-wide.
- [app/why-mycargolens/why-mycargolens-client.tsx:250](landing/app/why-mycargolens/why-mycargolens-client.tsx#L250) — "Sign up free … No card, no commitment."
- [app/changelog/changelog-client.tsx:66](landing/app/changelog/changelog-client.tsx#L66) — "Sign up free and draft as much as you like — no card, no time limit."
- [app/solutions/solutions-client.tsx:474](landing/app/solutions/solutions-client.tsx#L474) — "Start free — the same product works for all three."

Real product state (per memory: sales-led onboarding + card-on-file):
- Self-serve signup is disabled — the only path in is `/book-a-demo`.
- After demo → provisioning → user gets a set-password email → adds a card via Stripe SetupIntent → charged only when a filing is accepted by CBP.
- Free plan does *not* exist for the public; the pricing page's "add a card once" language is the truth.

**Canonical copy** — write once, use everywhere:

- Hero CTA lockup: **"Request a demo"** primary, **"See how it works"** or **"See pricing"** secondary. Fine print under the CTAs: **"20-minute walkthrough. Card added when you're provisioned. Billed only when we file for you."**
- Closing CTA fine print: **"A 20-minute walkthrough. Billed only when we file — never for drafts or drafts held back."** Remove "No credit card."
- Anywhere that says "Sign up free," rewrite to "Book a walkthrough" or "Request a demo" — self-serve isn't a live option, so the CTA is misleading.
- Pricing keeps "Add a card once" — that's now the accurate description; make sure it's clearly the canonical explanation.

**Files touched:**
- `components/sections/closing-cta.tsx:80` — rewrite fine print
- `app/why-mycargolens/why-mycargolens-client.tsx:250` + the step-tracker around it — rewrite step 01
- `app/changelog/changelog-client.tsx:66` — rewrite CTA line
- `app/solutions/solutions-client.tsx:474` — rewrite intro
- `app/home-client.tsx` — check hero and act closers; confirm no lingering "no card" (the current hero fine print is `"Free plan • No credit card required"` at line 219 — needs the same rewrite)
- `app/pricing/pricing-page-client.tsx` — verify the "Add a card once" section reads as the canonical explanation, not a competing message

**Verify with a single grep after the rewrite:**
```bash
cd landing && grep -rn "no card\|No credit card\|Sign up free\|Start free" --include="*.tsx"
```
Expected output: empty, or only inside `pricing-page-client.tsx` where the "Start free" pill is explicitly framed as the platform's free-to-draft posture.

---

## PR-E — API config + watchlist verification (F01 + watchlist)

Not a code PR — a staging verification checklist that produces one env-config change if any endpoint is misconfigured.

**F01 — API URL fallback**

Marketing site talks to the app API. Fallback is `http://localhost:3001` in 4 places:
- `next.config.ts:9` (used for CSP construction)
- `app/contact/page.tsx:45`
- `app/book-a-demo/book-a-demo-client.tsx:52`
- `lib/chatClient.ts:19`

Verification against prod (`app.mycargolens.com`) + staging (`staging.mycargolens.com`):

```bash
# Confirm env is set in the docker container on both boxes
ssh vps-prod  'docker inspect landing-app --format "{{.Config.Env}}" | grep NEXT_PUBLIC_API_URL'
ssh vps-stage 'docker inspect landing-app --format "{{.Config.Env}}" | grep NEXT_PUBLIC_API_URL'
# Confirm the app allows the marketing origin
curl -s -H "Origin: https://mycargolens.com" -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  https://app.mycargolens.com/api/v1/chat/config
# Confirm a real submit works — smoke via the site
curl -s -H "Content-Type: application/json" -H "Origin: https://mycargolens.com" \
  -d '{"name":"audit smoke","email":"claude-audit@example.com","message":"remove me"}' \
  https://app.mycargolens.com/api/v1/contact
```

If any of these fails, the fix is env — set `NEXT_PUBLIC_API_URL=https://app.mycargolens.com` on the landing container in prod (`staging.mycargolens.com` app URL for staging), redeploy, re-verify.

**Watchlist items — verify or update copy:**

1. **"Zero-retention API tier" / "SOC-2 friendly"** — currently on `/security`. Confirm the OpenAI contract is on a zero-retention tier before shipping. If not: soften to "We do not train on your data" (accurate — that's the API default). Kill "SOC-2 friendly" unless we have a Type I or Type II underway; the term is non-standard and reads as marketing.
2. **"Every action, logged forever"** — `/security`. Match to actual `AuditLog` retention (`server/prisma/schema.prisma` — check for TTL). If no TTL: keep. If there is: rewrite to "every action logged, retained per your plan's audit window."
3. **Illustrative status strip** ("Last CBP ping 14s ago" etc.) — currently rendered as if live in the footer. Two options: (a) wire to real values from a `/status` endpoint, (b) mark visibly as illustrative ("*As of last check*") and freeze at plausible values. Recommendation: **(b)** for now, ticket (a) for later. Silent staleness on a compliance site erodes trust.
4. **Lighthouse LCP 4.1s locally** — re-run on the prod URL: `npx lighthouse https://mycargolens.com --preset=desktop --output=json`. If prod is under 2.5s, close. If not, the two suspects are the hero R3F scene and above-fold framer-motion staggering — investigate before treating it as done.

---

## Order of operations

**Recommended sequence** — smallest-safest first, riskiest last so we have deployment confidence banked:

1. **PR-E verification** — no code change if endpoints work; a staging env-var change if they don't. Do this first so we know whether F01 is a real bug or a phantom-of-the-local-build.
2. **PR-A (canonicals)** — ~zero risk, 20 min to write, big SEO upside.
3. **PR-B (nav)** — small, contained, unblocks tablet users immediately.
4. **PR-D (copy)** — reviewer just reads the diff; no design token surface changes.
5. **PR-C (a11y)** — largest surface area; needs the design skill loaded and per-page pa11y confirmation.

Each PR ships to staging (`staging.mycargolens.com`) first for a smoke pass, then to prod.

## What we're not doing this round

- **Legal boilerplate** (`/legal/privacy`, `/legal/terms`) — pending founder + counsel.
- **Real search / command palette** — proper feature, not a QA fix.
- **Full lighthouse remediation** — pending prod re-measurement (locally-measured LCP is not authoritative).
- **New content pages** (blog, docs, help) — out of scope for this remediation.

## Sign-off criteria

- pa11y clean on `/`, `/pricing`, `/platform/compliance`, `/security`, `/changelog`.
- Playwright layout check clean at 390, 768, 1024, 1440.
- `curl` shows a route-specific canonical on 3 sample pages.
- Smoke-successful demo submit + contact submit + chat launcher config load against prod API from `https://mycargolens.com`.
- One grep run confirms no orphaned "no card" / "Sign up free" copy.
- One founder pass on the funnel copy — the audit rewrite reads like the founder's voice, not mine.
