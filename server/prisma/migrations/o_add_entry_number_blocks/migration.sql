-- Entry-number blocks: filer-assigned ranges drawn atomically at filing time.
CREATE TABLE "entry_number_blocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "filer_code" VARCHAR(3) NOT NULL,
  "range_start" INTEGER NOT NULL,
  "range_end" INTEGER NOT NULL,
  "next_sequence" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "label" VARCHAR(100),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "entry_number_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "entry_number_blocks_org_id_fkey" FOREIGN KEY ("org_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "entry_number_blocks_org_id_active_idx" ON "entry_number_blocks"("org_id", "active");
