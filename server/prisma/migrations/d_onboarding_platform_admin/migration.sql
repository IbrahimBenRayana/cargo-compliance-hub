-- ============================================================
-- Sales-led onboarding
-- ------------------------------------------------------------
-- Adds a platform-admin flag (MyCargoLens staff who provision client orgs) and
-- a password-setup token table used to let a newly provisioned client owner
-- set their first password via an emailed link.
-- ============================================================

-- 1. Platform-admin flag (distinct from the org-scoped role).
ALTER TABLE "users" ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- 2. Password setup / reset tokens (single-use, hashed link tokens).
CREATE TABLE "password_setup_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_setup_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_setup_tokens_token_hash_key" ON "password_setup_tokens"("token_hash");
CREATE INDEX "password_setup_tokens_user_id_consumed_at_created_at_idx" ON "password_setup_tokens"("user_id", "consumed_at", "created_at");

ALTER TABLE "password_setup_tokens" ADD CONSTRAINT "password_setup_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
