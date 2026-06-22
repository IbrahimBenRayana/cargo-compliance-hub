-- ============================================================
-- Webhook endpoints for the public API (/api/public/v1)
-- ------------------------------------------------------------
-- Org-registered callback URLs (Plan B Phase 1). On a filing/entry status
-- change we POST a JSON event signed with HMAC-SHA256 so integrators get push
-- instead of polling. The signing secret is stored as-is (the server must
-- re-sign every payload); it is shown in full only on create / rotate.
--
-- Idempotent (IF NOT EXISTS / conname guards) so `prisma migrate deploy` is a
-- safe no-op if the table already exists on any environment.
-- ============================================================

CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "secret_prefix" VARCHAR(24) NOT NULL,
    "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(200),
    "created_by" UUID,
    "last_status" INTEGER,
    "last_error" VARCHAR(500),
    "last_delivery_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "webhook_endpoints_org_id_idx" ON "webhook_endpoints"("org_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_endpoints_org_id_fkey') THEN
    ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
