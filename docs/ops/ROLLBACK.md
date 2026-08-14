# Rollback runbook

Every deploy is reversible. This is the path — read it before you need it.

## What the pipeline already does for you

`.github/workflows/ci-cd.yml` deploys **SHA-tagged images** and self-heals:

1. Records the currently-live tag from `/opt/mycargolens/.env` (`LANDING_IMAGE_TAG` / `IMAGE_TAG`).
2. Pulls and starts the new tag.
3. Polls the health endpoint for ~30s.
4. **If health fails, it restores the previous tag and restarts automatically.**

So a deploy that never becomes healthy has already rolled itself back. The manual paths below are for
the harder case: the deploy *is* healthy, but the change is wrong.

## Trigger conditions

Roll back without debating it when:

- Error rate exceeds ~2× baseline (Sentry — server DSN via `SENTRY_DSN`, browser via
  `NEXT_PUBLIC_SENTRY_DSN` / `VITE_SENTRY_DSN`, both baked in at image build)
- P95 latency is >50% above baseline and payload sizes are unchanged
- A filing path is producing wrong CBP output — data correctness outranks uptime here
- Any auth, MFA, or API-key regression

## Path A — redeploy the previous image (fastest, no git history)

On the host, in `/opt/mycargolens`:

```bash
grep LANDING_IMAGE_TAG .env          # note the current tag first
sed -i "s|^LANDING_IMAGE_TAG=.*|LANDING_IMAGE_TAG=<previous-sha>|" .env
docker compose up -d landing         # swap `landing` for `server` / `app` as needed
curl -fsS http://localhost:3000 > /dev/null && echo OK
```

Time to recover: **under 2 minutes.** The previous SHA is in the deploy job log of the run before
the bad one (`gh run list --branch main`).

## Path B — revert the commit (keeps git and prod in sync)

```bash
git revert <bad-sha> && git push origin main
```

Slower (full pipeline, ~4–5 min) but leaves no drift between `main` and what's running. Prefer this
once the immediate bleeding is stopped by Path A.

## Landing-only rollbacks

The marketing site (`landing/`) is a separate image from the app. Reverting it never touches filing
data, so it carries essentially no data risk — Path A on the `landing` service alone is sufficient.

## Database considerations

Migrations live in `deploy/migrations/`. **A code rollback does not undo a migration.** Before
rolling back past a migration, confirm the old code tolerates the new schema — additive changes
(new nullable column, new table) are safe; destructive ones (dropped/renamed column) are not, and
need a forward fix instead of a rollback.

## After any rollback

1. Confirm health: all routes 200, error rate back to baseline.
2. Say so in the team channel — a silent rollback gets re-deployed by the next person.
3. Write the failure into the fix so it can't recur: a test, a validation, or a check in CI.
