-- CBP foreign importer of record rule (docs/specs/foreign-ior-rule.md §3).
-- Additive and nullable/defaulted: no backfill, nothing existing changes.

-- The filer org's own CTPAT validation (self-attested), for pre-send warnings.
ALTER TABLE "organizations" ADD COLUMN "ctpat_status" VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN';

-- U.S. | FOREIGN from the entry's declaration, for lists and reporting.
ALTER TABLE "abi_documents" ADD COLUMN "ior_us_status" VARCHAR(8);

-- Saved importers: the org's last declaration per importer of record.
CREATE TABLE "importer_profiles" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "ior_number" VARCHAR(12) NOT NULL,
    "ior_number_type" VARCHAR(3) NOT NULL,
    "name" VARCHAR(255),
    "us_ior_status" VARCHAR(8) NOT NULL,
    "ctpat_status" VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',
    "declared_by_id" UUID,
    "declared_by_email" VARCHAR(255),
    "declared_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "importer_profiles_org_id_ior_number_key" ON "importer_profiles"("org_id", "ior_number");

ALTER TABLE "importer_profiles" ADD CONSTRAINT "importer_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
