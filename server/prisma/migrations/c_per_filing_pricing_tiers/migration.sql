-- ============================================================
-- Per-filing pricing migration
-- ------------------------------------------------------------
-- Replaces package/subscription tiers (starter/grower/scale) with metered
-- per-shipment tiers (isf/entry/full/enterprise), adds the `shipment_charges`
-- billing ledger, and retires the monthly hard-cap `filing_usage` counter.
--
-- Pre-launch: there are no live paying customers (Stripe price ids were never
-- wired up), so the old plan rows and any demo subscriptions are cleared. The
-- seed re-creates the new plan rows; orgs re-subscribe to a new tier.
-- ============================================================

-- 1. Clear obsolete billing data. subscriptions.plan_id FKs to plans, so the
--    subscriptions must go before the plan rows are reshaped/replaced.
DELETE FROM "subscriptions";
DELETE FROM "plans";

-- 2. Retire the monthly hard-cap counter — per-filing billing has no cap.
DROP TABLE IF EXISTS "filing_usage";

-- 3. Reshape plans: drop the subscription-era columns, add per-filing rate +
--    capability list. per_filing_cents/capabilities get defaults so the ALTER
--    succeeds on any residual rows (there are none after the DELETE above).
ALTER TABLE "plans" DROP COLUMN IF EXISTS "price_cents";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "billing_interval";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "filings_included";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "max_seats";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "overage_cents";
ALTER TABLE "plans" ADD COLUMN "per_filing_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 4. Billing ledger — one row per billed shipment. The shipment is anchored on
--    EITHER an ISF Filing OR a standalone ABI Entry (exactly one is set); a
--    linked Entry shares the ISF's filing_id so the two events bill once. The
--    unique index on each anchor enforces "one charge per shipment". Postgres
--    treats NULLs as distinct, so many rows may share a NULL anchor.
CREATE TABLE "shipment_charges" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "filing_id" UUID,
    "abi_document_id" UUID,
    "plan_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_meter_event_id" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "billed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_charges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shipment_charges_filing_id_key" ON "shipment_charges"("filing_id");
CREATE UNIQUE INDEX "shipment_charges_abi_document_id_key" ON "shipment_charges"("abi_document_id");
CREATE INDEX "shipment_charges_org_id_billed_at_idx" ON "shipment_charges"("org_id", "billed_at");
CREATE INDEX "shipment_charges_status_idx" ON "shipment_charges"("status");

ALTER TABLE "shipment_charges" ADD CONSTRAINT "shipment_charges_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_charges" ADD CONSTRAINT "shipment_charges_filing_id_fkey"
    FOREIGN KEY ("filing_id") REFERENCES "filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_charges" ADD CONSTRAINT "shipment_charges_abi_document_id_fkey"
    FOREIGN KEY ("abi_document_id") REFERENCES "abi_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_charges" ADD CONSTRAINT "shipment_charges_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
