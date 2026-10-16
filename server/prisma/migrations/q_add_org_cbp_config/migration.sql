-- AlterTable
ALTER TABLE "filings" ADD COLUMN     "isf_filer_mode" VARCHAR(8);

-- CreateTable
CREATE TABLE "org_cbp_configs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "gateway" VARCHAR(8) NOT NULL DEFAULT 'NATIVE',
    "filer_code" VARCHAR(3),
    "isf_filer_mode_default" VARCHAR(8) NOT NULL DEFAULT 'SIGMA',
    "service_center_approved_at" TIMESTAMPTZ,
    "service_center_approved_by" VARCHAR(200),
    "notes" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_cbp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_cbp_configs_org_id_key" ON "org_cbp_configs"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_cbp_configs_filer_code_key" ON "org_cbp_configs"("filer_code");

-- AddForeignKey
ALTER TABLE "org_cbp_configs" ADD CONSTRAINT "org_cbp_configs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Allowed values, enforced by the database.
ALTER TABLE "org_cbp_configs" ADD CONSTRAINT "org_cbp_configs_gateway_check" CHECK ("gateway" IN ('NATIVE', 'CC'));
ALTER TABLE "org_cbp_configs" ADD CONSTRAINT "org_cbp_configs_isf_mode_check" CHECK ("isf_filer_mode_default" IN ('SIGMA', 'CLIENT'));
-- A client's filer code is three alphanumerics and never Sigma's own S7P.
ALTER TABLE "org_cbp_configs" ADD CONSTRAINT "org_cbp_configs_filer_code_check" CHECK ("filer_code" IS NULL OR ("filer_code" ~ '^[A-Z0-9]{3}$' AND "filer_code" <> 'S7P'));
ALTER TABLE "filings" ADD CONSTRAINT "filings_isf_filer_mode_check" CHECK ("isf_filer_mode" IS NULL OR "isf_filer_mode" IN ('SIGMA', 'CLIENT'));
