-- Billing v2, Phase 1 (pricing plan v2 §8.2): invoiced accounts for paid pilots.
-- Per-org billing mode + monthly-minimum terms, a saved ACH bank account, and
-- a mirror of each monthly Stripe invoice.

ALTER TABLE "subscriptions" ADD COLUMN "billing_mode" VARCHAR(20) NOT NULL DEFAULT 'card';
ALTER TABLE "subscriptions" ADD COLUMN "monthly_minimum_cents" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN "included_isfs" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN "billing_starts_on" DATE;
ALTER TABLE "subscriptions" ADD COLUMN "billing_hold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN "ach_payment_method_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "ach_bank_name" VARCHAR(100);
ALTER TABLE "subscriptions" ADD COLUMN "ach_last4" VARCHAR(4);

CREATE TABLE "billing_invoices" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'creating',
    "stripe_invoice_id" TEXT,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "last_error" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_invoices_stripe_invoice_id_key" ON "billing_invoices"("stripe_invoice_id");
CREATE UNIQUE INDEX "billing_invoices_org_id_period_start_kind_key" ON "billing_invoices"("org_id", "period_start", "kind");
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shipment_charges" ADD COLUMN "invoice_id" UUID;
ALTER TABLE "shipment_charges" ADD CONSTRAINT "shipment_charges_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
