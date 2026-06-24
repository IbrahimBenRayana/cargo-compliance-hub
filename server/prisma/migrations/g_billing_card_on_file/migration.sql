-- ============================================================
-- Card-on-file + immediate per-shipment billing
-- ------------------------------------------------------------
-- Replaces the Stripe metered-subscription model with a saved card that is
-- charged immediately (a PaymentIntent) for each shipment CBP accepts. The
-- org keeps a default payment method; there is no recurring subscription.
--
--   subscriptions.status now means:
--     incomplete   — tier selected, no usable card yet
--     card_on_file — tier + card saved (can file)
--     delinquent   — a per-shipment charge failed; filing blocked until settled
--     active       — legacy (pre-migration); treated as card_on_file
-- ============================================================

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "default_payment_method_id" TEXT,
  ADD COLUMN IF NOT EXISTS "card_brand" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "card_last4" VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "card_exp_month" INTEGER,
  ADD COLUMN IF NOT EXISTS "card_exp_year" INTEGER;

ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'incomplete';

ALTER TABLE "shipment_charges"
  ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" TEXT;
