-- CreateTable
CREATE TABLE "hts_classifications" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID,
    "description" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "result" JSONB NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "revision" VARCHAR(40) NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "picked_code" VARCHAR(10),
    "picked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hts_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hts_classifications_org_id_created_at_idx" ON "hts_classifications"("org_id", "created_at");

-- AddForeignKey
ALTER TABLE "hts_classifications" ADD CONSTRAINT "hts_classifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hts_classifications" ADD CONSTRAINT "hts_classifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
