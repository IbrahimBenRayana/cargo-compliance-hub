-- Add deduplication key column to notifications table
-- Used by background jobs to prevent duplicate deadline alerts across server restarts

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" VARCHAR(255);

-- Create unique index (allows multiple NULLs, only enforces uniqueness on non-NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
