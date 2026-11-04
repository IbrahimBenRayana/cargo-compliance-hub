-- Pilot price ladder (pilot offer §2 clause 6): per-org ISF volume bands for
-- invoiced accounts, e.g. [{"fromIsf":251,"cents":400}] = $4 per ISF from the
-- 251st accepted ISF of the month. Nullable, no backfill: null keeps one rate.
ALTER TABLE "subscriptions" ADD COLUMN "isf_bands" JSONB;
