-- A rejected replace must leave the record as CBP holds it, with the user's
-- edits kept to fix and resend. All nullable: rows already on file simply have
-- no accepted version until CBP next accepts them.

ALTER TABLE "filings" ADD COLUMN "pending_changes" JSONB;
ALTER TABLE "filings" ADD COLUMN "rejected_changes" JSONB;
ALTER TABLE "abi_documents" ADD COLUMN "accepted_version" JSONB;
ALTER TABLE "abi_documents" ADD COLUMN "rejected_payload" JSONB;
