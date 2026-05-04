-- Phase 5 of the notification rethink: per-user, per-kind opt-out.
--
-- Missing rows behave as {inApp: true, email: true} so we never need to
-- seed the cross product of users × kinds. Users only get rows once they
-- actively toggle a preference off.

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id"    UUID         NOT NULL,
  "kind"       VARCHAR(50)  NOT NULL,
  "in_app"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "email"      BOOLEAN      NOT NULL DEFAULT TRUE,
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "kind")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_preferences_user_id_fkey'
  ) THEN
    ALTER TABLE "notification_preferences"
      ADD CONSTRAINT "notification_preferences_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
