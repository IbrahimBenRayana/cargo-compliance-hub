-- ============================================================
-- Multi-factor authentication (TOTP + email OTP fallback + recovery codes)
-- ------------------------------------------------------------
-- Adds MFA state to `users` and two child tables:
--   • mfa_recovery_codes — single-use break-glass codes (bcrypt-hashed)
--   • mfa_email_codes     — 6-digit email OTP fallback (bcrypt-hashed)
-- TOTP secrets live encrypted (AES-256-GCM) in users.mfa_secret_enc /
-- mfa_pending_secret_enc. mfa_last_used_step is the RFC 6238 replay guard.
-- Fully idempotent so re-runs in any environment are safe.
-- ============================================================

-- ── users: MFA columns ─────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled"            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret_enc"         TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_pending_secret_enc" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_pending_created_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_last_used_step"     INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enrolled_at"        TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enforced"           BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_failed_attempts"    INTEGER NOT NULL DEFAULT 0;

-- ── mfa_recovery_codes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mfa_recovery_codes" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID         NOT NULL,
  "code_hash"  VARCHAR(255) NOT NULL,
  "used_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mfa_recovery_codes_user_id_fkey'
  ) THEN
    ALTER TABLE "mfa_recovery_codes"
      ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "mfa_recovery_codes_user_id_idx"
  ON "mfa_recovery_codes" ("user_id");

-- ── mfa_email_codes ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mfa_email_codes" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID         NOT NULL,
  "code_hash"   VARCHAR(255) NOT NULL,
  "expires_at"  TIMESTAMPTZ  NOT NULL,
  "attempts"    INTEGER      NOT NULL DEFAULT 0,
  "consumed_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "mfa_email_codes_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mfa_email_codes_user_id_fkey'
  ) THEN
    ALTER TABLE "mfa_email_codes"
      ADD CONSTRAINT "mfa_email_codes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "mfa_email_codes_user_id_idx"
  ON "mfa_email_codes" ("user_id");
