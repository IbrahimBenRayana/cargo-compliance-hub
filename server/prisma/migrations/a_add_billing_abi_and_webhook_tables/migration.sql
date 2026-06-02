-- ============================================================
-- 10_add_billing_abi_and_webhook_tables
--
-- Reconciles 5 schema tables that never got captured as migrations
-- (plans, subscriptions, filing_usage, manifest_queries, abi_documents)
-- and adds 1 new one for Stripe-webhook idempotency.
--
-- Production already has plans/subscriptions/filing_usage/manifest_queries
-- (created via `prisma db push` during the 2026-04-23 VPS reinstall) and
-- abi_documents (created via deploy/migrations/2026-04-27-abi-documents.sql).
-- Every statement here is therefore wrapped in an IF NOT EXISTS / conname
-- guard so it's a no-op on prod. On a fresh DB (CI, staging, dev clone,
-- DR rebuild) the same statements create the tables for the first time.
--
-- See audit Phase 4 — pre-fix `prisma migrate deploy` would fail on any
-- fresh DB because migration 2 references abi_documents in an FK that
-- can't resolve. Migration 2 has been amended to guard its FK creation
-- with a table-existence check; this migration adds the FK once the
-- table exists.
-- ============================================================

-- ── plans ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stripe_price_id" TEXT,
    "stripe_product_id" TEXT,
    "price_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "billing_interval" VARCHAR(20) NOT NULL,
    "filings_included" INTEGER NOT NULL,
    "max_seats" INTEGER NOT NULL,
    "overage_cents" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "plans_stripe_price_id_key" ON "plans"("stripe_price_id");

-- ── subscriptions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMPTZ,
    "current_period_end" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ,
    "trial_end" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_org_id_key" ON "subscriptions"("org_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");

-- ── filing_usage ─────────────────────────────────────────────────────
-- Per-org per-month filing counter. The unique (org_id, month) lets the
-- atomic plan-limit enforcement use INSERT ... ON CONFLICT DO UPDATE.
CREATE TABLE IF NOT EXISTS "filing_usage" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filing_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "filing_usage_org_id_month_idx" ON "filing_usage"("org_id", "month");
CREATE UNIQUE INDEX IF NOT EXISTS "filing_usage_org_id_month_key" ON "filing_usage"("org_id", "month");

-- ── manifest_queries ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "manifest_queries" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bol_number" VARCHAR(100) NOT NULL,
    "bol_type" VARCHAR(20) NOT NULL DEFAULT 'BOLNUMBER',
    "cc_request_id" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "response" JSONB,
    "error_message" TEXT,
    "poll_attempts" INTEGER NOT NULL DEFAULT 0,
    "filing_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manifest_queries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "manifest_queries_org_id_idx" ON "manifest_queries"("org_id");
CREATE INDEX IF NOT EXISTS "manifest_queries_bol_number_idx" ON "manifest_queries"("bol_number");
CREATE INDEX IF NOT EXISTS "manifest_queries_org_id_created_at_idx" ON "manifest_queries"("org_id", "created_at");

-- ── abi_documents ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "abi_documents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "entry_summary_status" VARCHAR(20),
    "cargo_release_status" VARCHAR(20),
    "entry_type" VARCHAR(2) NOT NULL,
    "mode_of_transport" VARCHAR(2) NOT NULL,
    "entry_number" VARCHAR(50),
    "cc_document_id" VARCHAR(100),
    "mbol_number" VARCHAR(100),
    "hbol_number" VARCHAR(100),
    "ior_number" VARCHAR(100),
    "ior_name" VARCHAR(255),
    "consignee_name" VARCHAR(255),
    "port_of_entry" VARCHAR(10),
    "destination_state_us" VARCHAR(2),
    "entry_date" VARCHAR(8),
    "import_date" VARCHAR(8),
    "arrival_date" VARCHAR(8),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sent_at" TIMESTAMPTZ,
    "responded_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "poll_attempts" INTEGER NOT NULL DEFAULT 0,
    "filing_id" UUID,
    "manifest_query_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abi_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "abi_documents_entry_number_key" ON "abi_documents"("entry_number");
CREATE INDEX IF NOT EXISTS "abi_documents_org_id_status_idx" ON "abi_documents"("org_id", "status");
CREATE INDEX IF NOT EXISTS "abi_documents_mbol_number_idx" ON "abi_documents"("mbol_number");
CREATE INDEX IF NOT EXISTS "abi_documents_entry_number_idx" ON "abi_documents"("entry_number");
CREATE INDEX IF NOT EXISTS "abi_documents_org_id_created_at_idx" ON "abi_documents"("org_id", "created_at");

-- ── stripe_webhook_events (idempotency ledger) ──────────────────────
-- Stripe retries event delivery on 5xx and occasionally after 2xx. Without
-- a ledger, the same event can run our handler twice — duplicate
-- notifications, clobbered cancelled_at timestamps, double-charges in
-- aggressively-retried flows. event_id is the natural PK; INSERT ON
-- CONFLICT DO NOTHING at handler entry tells us whether to proceed.
CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("event_id")
);
CREATE INDEX IF NOT EXISTS "stripe_webhook_events_received_at_idx" ON "stripe_webhook_events"("received_at" DESC);

-- ── Foreign keys ─────────────────────────────────────────────────────
-- All guarded by conname so this migration is idempotent on prod where
-- the FKs were created by `prisma db push` or the out-of-band SQL.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_org_id_fkey') THEN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_plan_id_fkey') THEN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'filing_usage_org_id_fkey') THEN
    ALTER TABLE "filing_usage" ADD CONSTRAINT "filing_usage_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifest_queries_org_id_fkey') THEN
    ALTER TABLE "manifest_queries" ADD CONSTRAINT "manifest_queries_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifest_queries_user_id_fkey') THEN
    ALTER TABLE "manifest_queries" ADD CONSTRAINT "manifest_queries_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifest_queries_filing_id_fkey') THEN
    ALTER TABLE "manifest_queries" ADD CONSTRAINT "manifest_queries_filing_id_fkey"
      FOREIGN KEY ("filing_id") REFERENCES "filings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'abi_documents_org_id_fkey') THEN
    ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'abi_documents_user_id_fkey') THEN
    ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'abi_documents_filing_id_fkey') THEN
    ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_filing_id_fkey"
      FOREIGN KEY ("filing_id") REFERENCES "filings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'abi_documents_manifest_query_id_fkey') THEN
    ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_manifest_query_id_fkey"
      FOREIGN KEY ("manifest_query_id") REFERENCES "manifest_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- Migration 2 skipped this FK on fresh DBs because abi_documents didn't
  -- exist yet. Now that we've just created it, add the FK here.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_abi_document_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_abi_document_id_fkey"
      FOREIGN KEY ("abi_document_id") REFERENCES "abi_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Schema drift reconciliation ──────────────────────────────────────
-- The remaining statements clean up drift between the migration history
-- and the actual schema introduced by past `prisma db push` runs. All
-- are idempotent: DROP DEFAULT on a column with no default is a no-op
-- under Postgres; the FK / index renames are guarded.

-- Drop DB-level UUID defaults that Prisma generates client-side now.
ALTER TABLE "add_cvd_orders"            ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "add_cvd_orders"            ALTER COLUMN "hts_prefixes" DROP DEFAULT;
ALTER TABLE "email_verification_tokens" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "filing_score_snapshots"    ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "notification_deliveries"   ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "tracked_shipments"         ALTER COLUMN "id" DROP DEFAULT;

-- tracked_shipments: re-create FKs under Prisma's canonical naming
-- (`_org_id_fkey` etc.). The drop is guarded by an existence check so
-- this is safe on a fresh DB where the constraints don't exist yet.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracked_shipments_org_id_fkey') THEN
    ALTER TABLE "tracked_shipments" DROP CONSTRAINT "tracked_shipments_org_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracked_shipments_created_by_fkey') THEN
    ALTER TABLE "tracked_shipments" DROP CONSTRAINT "tracked_shipments_created_by_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracked_shipments_filing_id_fkey') THEN
    ALTER TABLE "tracked_shipments" DROP CONSTRAINT "tracked_shipments_filing_id_fkey";
  END IF;
  ALTER TABLE "tracked_shipments" ADD CONSTRAINT "tracked_shipments_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "tracked_shipments" ADD CONSTRAINT "tracked_shipments_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "tracked_shipments" ADD CONSTRAINT "tracked_shipments_filing_id_fkey"
    FOREIGN KEY ("filing_id") REFERENCES "filings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END $$;

-- tracked_shipments index renames: only rename if the old name exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='tracked_shipments_org_created_at_idx') THEN
    ALTER INDEX "tracked_shipments_org_created_at_idx" RENAME TO "tracked_shipments_org_id_created_at_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='tracked_shipments_org_status_idx') THEN
    ALTER INDEX "tracked_shipments_org_status_idx" RENAME TO "tracked_shipments_org_id_status_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='tracked_shipments_org_t49_shipment_uniq') THEN
    ALTER INDEX "tracked_shipments_org_t49_shipment_uniq" RENAME TO "tracked_shipments_org_id_t49_shipment_id_key";
  END IF;
END $$;
