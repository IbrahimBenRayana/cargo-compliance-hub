-- CreateTable
CREATE TABLE "cbp_currency_rates" (
    "id" UUID NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "rate_date" DATE NOT NULL,
    "rate" DECIMAL(14,6) NOT NULL,
    "indicator" VARCHAR(1) NOT NULL,
    "remarks" VARCHAR(50),
    "inbound_message_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbp_currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cbp_currency_rates_currency_code_rate_date_idx" ON "cbp_currency_rates"("currency_code", "rate_date");

-- CreateIndex
CREATE UNIQUE INDEX "cbp_currency_rates_country_code_currency_code_rate_date_ind_key" ON "cbp_currency_rates"("country_code", "currency_code", "rate_date", "indicator");


-- %R broadcasts already stored before this table existed are dispatched
-- again so their rates are captured.
UPDATE "cbp_inbound_messages" SET "dispatched_at" = NULL
WHERE "application" = '%R' AND "matched_entity_id" IS NULL;
