-- Container Tracking (Terminal 49). Persists a tracking request + a cached
-- shipment snapshot per org. Snapshot is refreshed on demand (Phase 1) and
-- by webhook ingestion (Phase 2). Idempotent so re-runs in any environment
-- are safe.

CREATE TABLE IF NOT EXISTS "tracked_shipments" (
  "id"                      UUID         NOT NULL DEFAULT gen_random_uuid(),
  "org_id"                  UUID         NOT NULL,
  "created_by"              UUID         NOT NULL,
  "filing_id"               UUID,

  "t49_tracking_request_id" VARCHAR(100),
  "t49_shipment_id"         VARCHAR(100),

  "request_type"            VARCHAR(20)  NOT NULL,
  "request_number"          VARCHAR(100) NOT NULL,
  "scac"                    VARCHAR(10)  NOT NULL,

  "status"                  VARCHAR(20)  NOT NULL DEFAULT 'pending',
  "failed_reason"           TEXT,

  "shipping_line_name"      VARCHAR(255),
  "port_of_lading_name"     VARCHAR(255),
  "port_of_discharge_name"  VARCHAR(255),
  "destination_name"        VARCHAR(255),
  "pod_vessel_name"         VARCHAR(255),
  "pol_etd_at"              TIMESTAMPTZ,
  "pol_atd_at"              TIMESTAMPTZ,
  "pod_eta_at"              TIMESTAMPTZ,
  "pod_ata_at"              TIMESTAMPTZ,
  "destination_eta_at"      TIMESTAMPTZ,
  "destination_ata_at"      TIMESTAMPTZ,
  "has_holds"               BOOLEAN      NOT NULL DEFAULT FALSE,
  "earliest_pickup_lfd"     TIMESTAMPTZ,

  "shipment_snapshot"       JSONB,

  "last_synced_at"          TIMESTAMPTZ,
  "sync_error"              TEXT,

  "created_at"              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "tracked_shipments_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (Prisma onDelete: Cascade / SetNull semantics).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracked_shipments_org_id_fkey'
  ) THEN
    ALTER TABLE "tracked_shipments"
      ADD CONSTRAINT "tracked_shipments_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracked_shipments_created_by_fkey'
  ) THEN
    ALTER TABLE "tracked_shipments"
      ADD CONSTRAINT "tracked_shipments_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracked_shipments_filing_id_fkey'
  ) THEN
    ALTER TABLE "tracked_shipments"
      ADD CONSTRAINT "tracked_shipments_filing_id_fkey"
      FOREIGN KEY ("filing_id") REFERENCES "filings"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX        IF NOT EXISTS "tracked_shipments_org_id_idx"            ON "tracked_shipments" ("org_id");
CREATE INDEX        IF NOT EXISTS "tracked_shipments_org_status_idx"        ON "tracked_shipments" ("org_id", "status");
CREATE INDEX        IF NOT EXISTS "tracked_shipments_org_created_at_idx"    ON "tracked_shipments" ("org_id", "created_at");
CREATE INDEX        IF NOT EXISTS "tracked_shipments_filing_id_idx"         ON "tracked_shipments" ("filing_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_shipments_org_t49_shipment_uniq" ON "tracked_shipments" ("org_id", "t49_shipment_id");
