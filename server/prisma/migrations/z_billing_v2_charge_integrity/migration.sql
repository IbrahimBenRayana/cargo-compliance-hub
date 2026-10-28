-- Billing v2, Phase 0 (pricing plan v2 §8.1; billing audit P1 G1-G5).
-- 1. Per-org prices on the subscription (planSync never rewrites them).
-- 2. Charges priced by what was filed (kind), one linked entry per ISF.
-- 3. Charge attempts are claimed and counted, so retries are idempotent.
-- 4. The retired Complete ($280) tier: its orgs move to the admin-assigned
--    "ISF + Entry" plan, keeping their entry price and capabilities.

-- ─── 1. Per-org prices ─────────────────────────────────────────────
ALTER TABLE "subscriptions" ADD COLUMN "isf_cents" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN "entry_linked_cents" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN "entry_only_cents" INTEGER;

-- ─── 2 + 3. Charge kind, linked ISF, attempt tracking ──────────────
ALTER TABLE "shipment_charges" ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'isf';
ALTER TABLE "shipment_charges" ADD COLUMN "linked_filing_id" UUID;
ALTER TABLE "shipment_charges" ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "shipment_charges" ADD COLUMN "last_attempt_at" TIMESTAMPTZ;
ALTER TABLE "shipment_charges" ADD COLUMN "last_error" VARCHAR(500);
ALTER TABLE "shipment_charges" ALTER COLUMN "status" SET DEFAULT 'processing';

-- Entry-anchored rows are entry-only charges. (Pre-v2, a linked entry billed
-- against its ISF's filing anchor, so those rows stay kind 'isf'.)
UPDATE "shipment_charges" SET "kind" = 'entry' WHERE "abi_document_id" IS NOT NULL;

-- Every pre-v2 row had exactly one attempt, keyed by the row id — the same key
-- attempt 1 uses now, so a re-run of a stuck row can never double-charge.
UPDATE "shipment_charges" SET "attempt_count" = 1, "last_attempt_at" = "billed_at"
  WHERE "status" IN ('pending', 'paid', 'failed', 'requires_action', 'refunded');
-- Orphaned 'pending' rows (P1 G1: a Stripe error left them unbilled) become
-- 'processing' with a stale attempt, so the hourly sweep picks them up.
UPDATE "shipment_charges" SET "status" = 'processing' WHERE "status" = 'pending';

CREATE UNIQUE INDEX "shipment_charges_one_linked_entry_per_isf"
  ON "shipment_charges" ("linked_filing_id") WHERE "kind" = 'entry_linked';

-- ─── 4. Retire Complete; keep old tier prices for entries ──────────
-- Pre-v2 a tier price applied to every shipment. ISF now bills the ISF price
-- ($45); entries keep what the org's tier charged: linked add-on = tier - $45,
-- entry-only = tier. Only rows without a price yet are touched.
UPDATE "subscriptions" SET "entry_linked_cents" = 13500, "entry_only_cents" = 18000
  WHERE "plan_id" = 'entry' AND "entry_linked_cents" IS NULL AND "entry_only_cents" IS NULL;
UPDATE "subscriptions" SET "plan_id" = 'entry', "entry_linked_cents" = 23500, "entry_only_cents" = 28000
  WHERE "plan_id" = 'full' AND "entry_linked_cents" IS NULL AND "entry_only_cents" IS NULL;
UPDATE "subscriptions" SET "plan_id" = 'entry' WHERE "plan_id" = 'full';
-- Enterprise was never charged; its entries stay free until an admin prices them.
UPDATE "subscriptions" SET "entry_linked_cents" = 0, "entry_only_cents" = 0
  WHERE "plan_id" = 'enterprise' AND "entry_linked_cents" IS NULL AND "entry_only_cents" IS NULL;

-- The plan rows: planSync rewrites isf/entry/enterprise on boot; the retired
-- row stays (old charges reference it) but can't be assigned.
UPDATE "plans" SET "is_active" = false, "is_public" = false WHERE "id" = 'full';
UPDATE "plans" SET "is_public" = false WHERE "id" = 'entry';
