-- AlterTable
ALTER TABLE "abi_documents" ADD COLUMN     "cbp_state" VARCHAR(12) NOT NULL DEFAULT 'NOT_ON_FILE',
ADD COLUMN     "last_transmission_id" UUID,
ADD COLUMN     "pending_action" VARCHAR(8),
ADD COLUMN     "release_requested" BOOLEAN NOT NULL DEFAULT false;


ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_cbp_state_check" CHECK ("cbp_state" IN ('NOT_ON_FILE', 'ON_FILE', 'DELETED'));
ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_pending_action_check" CHECK ("pending_action" IS NULL OR "pending_action" IN ('ADD', 'REPLACE', 'DELETE'));

-- Backfill: an entry CBP accepted is on file.
UPDATE "abi_documents" SET "cbp_state" = 'ON_FILE' WHERE "status" = 'ACCEPTED';
