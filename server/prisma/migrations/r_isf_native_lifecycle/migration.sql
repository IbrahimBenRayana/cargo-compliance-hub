-- AlterTable
ALTER TABLE "filings" ADD COLUMN     "cbp_state" VARCHAR(12) NOT NULL DEFAULT 'NOT_ON_FILE',
ADD COLUMN     "house_bill_scac" VARCHAR(4),
ADD COLUMN     "isf_filer_code" VARCHAR(3),
ADD COLUMN     "last_transmission_id" UUID,
ADD COLUMN     "pending_action" VARCHAR(8);


ALTER TABLE "filings" ADD CONSTRAINT "filings_cbp_state_check" CHECK ("cbp_state" IN ('NOT_ON_FILE', 'ON_FILE', 'DELETED'));
ALTER TABLE "filings" ADD CONSTRAINT "filings_pending_action_check" CHECK ("pending_action" IS NULL OR "pending_action" IN ('ADD', 'REPLACE', 'DELETE'));

-- Backfill from history: an ISF CBP accepted (or later amended) is on file;
-- a cancelled one that was accepted before is treated as deleted.
UPDATE "filings" SET "cbp_state" = 'ON_FILE' WHERE "status" IN ('accepted', 'amended', 'on_hold');
UPDATE "filings" SET "cbp_state" = 'DELETED' WHERE "status" = 'cancelled' AND "accepted_at" IS NOT NULL;
