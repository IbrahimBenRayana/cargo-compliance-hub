-- Dashboard work queue: org-scoped counts, recent activity, and the entries of a filing.
CREATE INDEX "filings_org_id_status_filing_deadline_idx" ON "filings"("org_id", "status", "filing_deadline");
CREATE INDEX "filings_org_id_updated_at_idx" ON "filings"("org_id", "updated_at" DESC);
CREATE INDEX "abi_documents_org_id_filing_id_updated_at_idx" ON "abi_documents"("org_id", "filing_id", "updated_at" DESC);
