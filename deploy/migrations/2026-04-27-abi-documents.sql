-- ============================================================
-- 2026-04-27 — Add abi_documents table for the ABI Entry Summary 7501
-- feature (commits 4667daf, deacf6b).
--
-- Purely additive: creates one new table + 4 indexes + 4 FKs back to
-- existing tables (organizations, users, filings, manifest_queries).
-- No existing rows are touched. Safe to run while the app is online.
--
-- Apply on the production VPS (after pulling the new image, before
-- restarting the server, or in either order — additive change):
--
--   ssh deploy@<vps>
--   cd /opt/mycargolens
--   docker compose exec -T db psql -U mycargolens -d mycargolens \
--       < deploy/migrations/2026-04-27-abi-documents.sql
--
-- Verify:
--   docker compose exec db psql -U mycargolens -d mycargolens \
--       -c '\d abi_documents'
--
-- Rollback (only if something is catastrophically wrong):
--   docker compose exec db psql -U mycargolens -d mycargolens \
--       -c 'DROP TABLE abi_documents;'
-- ============================================================

-- CreateTable
CREATE TABLE "abi_documents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "entry_summary_status" VARCHAR(20),
    "cargo_release_status" VARCHAR(20),
    "entry_type" VARCHAR(2) NOT NULL,
    "mode_of_transport" VARCHAR(2) NOT NULL,
    "entry_number" VARCHAR(50),
    "cc_document_id" VARCHAR(100),
    "mbol_number" VARCHAR(100),
    "hbol_number" VARCHAR(100),
    "ior_number" VARCHAR(100),
    "ior_name" VARCHAR(255),
    "consignee_name" VARCHAR(255),
    "port_of_entry" VARCHAR(10),
    "destination_state_us" VARCHAR(2),
    "entry_date" VARCHAR(8),
    "import_date" VARCHAR(8),
    "arrival_date" VARCHAR(8),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sent_at" TIMESTAMPTZ,
    "responded_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "poll_attempts" INTEGER NOT NULL DEFAULT 0,
    "filing_id" UUID,
    "manifest_query_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abi_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "abi_documents_entry_number_key" ON "abi_documents"("entry_number");

-- CreateIndex
CREATE INDEX "abi_documents_org_id_status_idx" ON "abi_documents"("org_id", "status");

-- CreateIndex
CREATE INDEX "abi_documents_mbol_number_idx" ON "abi_documents"("mbol_number");

-- CreateIndex
CREATE INDEX "abi_documents_entry_number_idx" ON "abi_documents"("entry_number");

-- CreateIndex
CREATE INDEX "abi_documents_org_id_created_at_idx" ON "abi_documents"("org_id", "created_at");

-- AddForeignKey
ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_filing_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "filings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abi_documents" ADD CONSTRAINT "abi_documents_manifest_query_id_fkey" FOREIGN KEY ("manifest_query_id") REFERENCES "manifest_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
