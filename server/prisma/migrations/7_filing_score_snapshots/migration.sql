-- Filing score snapshots: a row per scoring event so we can render true
-- score trajectories (validation-driven) instead of status-band guesses.
-- Trigger events: 'created', 'submitted', 'rejected', 'accepted',
-- 'amended', 'cancelled', 'on_hold', 'manual'.

CREATE TABLE IF NOT EXISTS "filing_score_snapshots" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "filing_id"      UUID         NOT NULL,
  "score"          INTEGER      NOT NULL,
  "status"         VARCHAR(30)  NOT NULL,
  "critical_count" INTEGER      NOT NULL DEFAULT 0,
  "warning_count"  INTEGER      NOT NULL DEFAULT 0,
  "info_count"     INTEGER      NOT NULL DEFAULT 0,
  "trigger_event"  VARCHAR(40)  NOT NULL,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "filing_score_snapshots_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'filing_score_snapshots_filing_id_fkey'
  ) THEN
    ALTER TABLE "filing_score_snapshots"
      ADD CONSTRAINT "filing_score_snapshots_filing_id_fkey"
      FOREIGN KEY ("filing_id") REFERENCES "filings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "filing_score_snapshots_filing_id_created_at_idx"
  ON "filing_score_snapshots" ("filing_id", "created_at");
