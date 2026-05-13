-- Email verification: 6-digit code emailed to the user. We store the bcrypt
-- hash, not the code itself, even though the search space is small — proper
-- defense is the 15-min TTL + 5-attempt cap + per-user rate limit. Hashing
-- just removes "DB-dump = instant verification" as a class of leak.

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID         NOT NULL,
  "code_hash"   VARCHAR(255) NOT NULL,
  "expires_at"  TIMESTAMPTZ  NOT NULL,
  "attempts"    INTEGER      NOT NULL DEFAULT 0,
  "consumed_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_verification_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE "email_verification_tokens"
      ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Lookup pattern: most recent un-consumed token for a given user.
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_consumed_at_created_at_idx"
  ON "email_verification_tokens" ("user_id", "consumed_at", "created_at");
