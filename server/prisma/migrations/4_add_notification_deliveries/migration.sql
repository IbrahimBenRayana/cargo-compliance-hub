-- Phase 6 of the notification rethink: out-of-band delivery queue.
--
-- One row per (notification, channel) pair the system plans to deliver.
-- Email is the only channel in this phase; the schema is general so that
-- push can land later without another migration.

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "notification_id"  UUID         NOT NULL,
  "channel"          VARCHAR(20)  NOT NULL,
  "recipient"        VARCHAR(255) NOT NULL,
  "status"           VARCHAR(20)  NOT NULL DEFAULT 'queued',
  "attempts"         INTEGER      NOT NULL DEFAULT 0,
  "last_error"       TEXT,
  "next_attempt_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "sent_at"          TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_deliveries_notification_id_fkey'
  ) THEN
    ALTER TABLE "notification_deliveries"
      ADD CONSTRAINT "notification_deliveries_notification_id_fkey"
      FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Worker drain index — column order matches the WHERE in the worker
-- (status='queued' AND next_attempt_at <= now() ORDER BY next_attempt_at).
CREATE INDEX IF NOT EXISTS "notification_deliveries_status_next_attempt_at_idx"
  ON "notification_deliveries" ("status", "next_attempt_at");

CREATE INDEX IF NOT EXISTS "notification_deliveries_notification_id_idx"
  ON "notification_deliveries" ("notification_id");
