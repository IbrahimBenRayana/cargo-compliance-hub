-- Defense-in-depth: a single (notification, recipient, channel) tuple must
-- never appear twice in notification_deliveries. The application-level
-- dispatcher already dedupes via Notification.dedupeKey, but adding the
-- DB-level guarantee stops duplicate emails even if a caller forgets to
-- pass a dedupeKey or a future regression reintroduces the race.
--
-- We first delete any pre-existing duplicates (keeping the row with the
-- earliest created_at per tuple — the "winner" that any drainer would have
-- picked up first), then create the unique index. The delete is the riskier
-- step; we deliberately keep one row per tuple rather than dropping all of
-- them so opted-in users still receive their notification, just once.

BEGIN;

-- Delete duplicate rows, keep the earliest.
DELETE FROM "notification_deliveries"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("notification_id", "recipient", "channel") "id"
  FROM "notification_deliveries"
  ORDER BY "notification_id", "recipient", "channel", "created_at" ASC, "id" ASC
);

-- Now safe to add the unique index. Prisma's canonical naming so it matches
-- the @@unique([notificationId, recipient, channel]) attribute.
CREATE UNIQUE INDEX IF NOT EXISTS "notification_deliveries_notification_id_recipient_channel_key"
  ON "notification_deliveries" ("notification_id", "recipient", "channel");

COMMIT;
