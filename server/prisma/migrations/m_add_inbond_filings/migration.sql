-- Native in-bond (7512) filings + lifecycle events.
CREATE TABLE "inbond_filings" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "entry_type" VARCHAR(2) NOT NULL,
    "inbond_number" VARCHAR(12),
    "carrier_code" VARCHAR(4),
    "port_of_destination" VARCHAR(4),
    "primary_bill" VARCHAR(30),
    "payload" JSONB NOT NULL,
    "wire_text" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbond_filings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inbond_filings_org_id_idx" ON "inbond_filings"("org_id");

CREATE TABLE "inbond_events" (
    "id" UUID NOT NULL,
    "filing_id" UUID NOT NULL,
    "action" VARCHAR(1) NOT NULL,
    "payload" JSONB NOT NULL,
    "wire_text" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RECORDED',
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbond_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inbond_events_filing_id_idx" ON "inbond_events"("filing_id");

ALTER TABLE "inbond_filings" ADD CONSTRAINT "inbond_filings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbond_filings" ADD CONSTRAINT "inbond_filings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inbond_events" ADD CONSTRAINT "inbond_events_filing_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "inbond_filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
