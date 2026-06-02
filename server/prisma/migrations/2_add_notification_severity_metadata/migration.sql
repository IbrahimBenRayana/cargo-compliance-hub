-- Phase 1 of the notification rethink. Purely additive — old code keeps
-- writing the same rows; new fields are optional with safe defaults so any
-- existing reader that ignores them works unchanged.
--
-- Backfill at the end seeds severity for the historical rows so the new
-- "Critical" tab in the bell shows the right items immediately after deploy.

-- ── 1. Severity enum ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_severity') THEN
    CREATE TYPE "notification_severity" AS ENUM ('info', 'warning', 'critical');
  END IF;
END
$$;

-- ── 2. New columns on notifications ──────────────────────────────────
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "severity"        "notification_severity" NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS "link_url"        VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "metadata"        JSONB,
  ADD COLUMN IF NOT EXISTS "read_at"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "abi_document_id" UUID;

-- ── 3. Foreign key for abi_document_id (matches filing_id behaviour) ─
-- ⚠ Guarded by table existence as well as constraint existence: when this
-- migration first shipped (2026-05-04), abi_documents had already been
-- created on prod via deploy/migrations/2026-04-27-abi-documents.sql, so
-- the ALTER worked. On any fresh DB (CI, staging, dev clone, DR rebuild)
-- abi_documents does NOT exist yet — the FK creation would error out and
-- abort the whole migration. We added the table-existence check so the FK
-- is only added when the referenced table is present; the matching FK is
-- added by migration `a_add_billing_abi_and_webhook_tables` when it
-- creates abi_documents on fresh envs. (The new migration uses an `a_`
-- prefix so it sorts after `9_tracked_shipments` lexicographically — the
-- existing 0_/1_/.../9_ scheme is non-standard, and `10_*` would have
-- sorted between `1_` and `2_`.)
--
-- Editing an already-applied migration is normally a Prisma anti-pattern,
-- but on prod the FK exists and this DO block remains a no-op, so the only
-- observable effect of the checksum change is a one-time warning from
-- `prisma migrate status` that's resolved by running
-- `prisma migrate resolve --applied 2_add_notification_severity_metadata`
-- against the prod DB (no SQL is re-executed).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_abi_document_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'abi_documents'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_abi_document_id_fkey"
      FOREIGN KEY ("abi_document_id") REFERENCES "abi_documents"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- ── 4. Indexes powering the new bell feed and Critical tab ───────────
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
  ON "notifications"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notifications_user_id_severity_created_at_idx"
  ON "notifications"("user_id", "severity", "created_at" DESC);

-- ── 5. Backfill severity for known-critical historical rows ──────────
-- Anything matching these types should have surfaced as critical from
-- day one. Backfilling lets the new Critical tab show real history.
UPDATE "notifications"
SET "severity" = 'critical'
WHERE "severity" = 'info'
  AND "type" IN ('filing_rejected', 'deadline_overdue', 'api_error');

UPDATE "notifications"
SET "severity" = 'warning'
WHERE "severity" = 'info'
  AND "type" IN ('deadline_warning', 'filing_on_hold', 'filing_stale');

-- ── 6. Backfill read_at for already-read rows ────────────────────────
-- We don't know the actual read time; createdAt is a defensible upper
-- bound (the row was created before it could be read).
UPDATE "notifications"
SET "read_at" = "created_at"
WHERE "is_read" = TRUE AND "read_at" IS NULL;
