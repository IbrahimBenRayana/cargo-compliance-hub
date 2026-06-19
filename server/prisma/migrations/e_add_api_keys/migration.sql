-- ============================================================
-- API keys for the public API (/api/public/v1)
-- ------------------------------------------------------------
-- Customer-issued credentials for brokers/3PLs/ERP integrations. Full key is
-- shown once and stored as a SHA-256 hash; prefix is a non-secret display
-- fragment; scopes gate capability.
-- ============================================================

CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "prefix" VARCHAR(24) NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_by" UUID NOT NULL,
    "last_used_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX "api_keys_org_id_idx" ON "api_keys"("org_id");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
