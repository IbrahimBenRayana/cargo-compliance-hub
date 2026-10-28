-- ABI certification console (workstream H): run parameters + transmissions.
CREATE TABLE "cert_params_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "filer_code" VARCHAR(3) NOT NULL DEFAULT 'ZZZ',
    "importer_of_record_number" VARCHAR(12) NOT NULL DEFAULT '26-164751100',
    "importer_name" VARCHAR(60) NOT NULL DEFAULT 'SIGMA TECHNOLOGY PARTNERS LLC',
    "consignee_number" VARCHAR(12) NOT NULL DEFAULT '26-164751100',
    "surety_company_code" VARCHAR(3) NOT NULL DEFAULT '123',
    "district_port_of_entry" VARCHAR(4) NOT NULL DEFAULT '2704',
    "current_year" VARCHAR(4) NOT NULL DEFAULT '2026',
    "applicability_date" VARCHAR(8) NOT NULL DEFAULT '20260820',
    "sender_site_code" VARCHAR(4) NOT NULL DEFAULT 'LA',
    "sender_id_code" VARCHAR(4) NOT NULL DEFAULT 'MCL',
    "sender_password" VARCHAR(6) NOT NULL DEFAULT 'PASSWD',
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cert_params_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cert_transmissions" (
    "id" UUID NOT NULL,
    "scenario_id" VARCHAR(3) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'generated',
    "wire_text" TEXT NOT NULL,
    "evidence_text" TEXT,
    "response_text" TEXT,
    "response_parsed" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cert_transmissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cert_transmissions_scenario_id_idx" ON "cert_transmissions"("scenario_id");
