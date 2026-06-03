-- Add consolidation grouping to filings.
--
-- ISF is filed at the lowest bill of lading level: when a shipment has one
-- Master BOL and N House BOLs, that's N separate ISF filings to CBP — but
-- the user-facing concept is a single "consolidation." We tag the sibling
-- filings with a shared UUID so list/detail views can group them.
--
-- consolidation_id is nullable: a single-HBL filing has no consolidation,
-- and pre-existing rows stay un-tagged.

ALTER TABLE "filings"
  ADD COLUMN "consolidation_id" UUID;

CREATE INDEX "filings_consolidation_id_idx" ON "filings"("consolidation_id");
