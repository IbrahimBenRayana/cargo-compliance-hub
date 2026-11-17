-- Presentation fixes for the LOCAL promo database only (mycargolens_promo).
-- Run after prisma/seed.ts and src/scripts/seedDemoData.ts.
-- A fictional operator instead of the seed's name, and no platform-admin menu.
UPDATE users SET first_name = 'Dana', last_name = 'Whitfield', is_platform_admin = false
 WHERE email = 'demo@mycargolens.com';
-- A plan with entries and a (fake) card on file, so no plan banners or locked pages.
INSERT INTO subscriptions (id, org_id, plan_id, status, default_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, updated_at)
SELECT gen_random_uuid(), o.id, 'entry', 'card_on_file', 'pm_promo_local', 'visa', '4242', 12, 2030, now()
  FROM organizations o
ON CONFLICT (org_id) DO UPDATE SET plan_id = 'entry', status = 'card_on_file';
-- Entry prices set (never shown) so the dashboard has no "pricing not set up" banner.
UPDATE subscriptions SET entry_linked_cents = 1, entry_only_cents = 1;
-- A made-up filer code of the org's own, so the real one never appears on screen.
INSERT INTO org_cbp_configs (id, org_id, gateway, filer_code, isf_filer_mode_default, service_center_approved_at, updated_at)
SELECT gen_random_uuid(), o.id, 'NATIVE', 'DM1', 'CLIENT', now(), now() FROM organizations o
ON CONFLICT (org_id) DO UPDATE SET filer_code = 'DM1', isf_filer_mode_default = 'CLIENT', service_center_approved_at = now();
UPDATE filings SET isf_filer_mode = 'CLIENT', isf_filer_code = 'DM1' WHERE isf_filer_mode IS NOT NULL OR status = 'draft';
-- Type 86 was discontinued by CBP: its seeded draft must never be on screen.
DELETE FROM abi_documents WHERE entry_type = '86';
-- The draft the film validates: a real US port code, and one HTS number cut short,
-- so the rule check has something true to catch on camera.
UPDATE filings SET foreign_port_of_unlading = '3901',
       commodities = jsonb_set(commodities, '{0,htsCode}', '"9401"')
 WHERE master_bol = 'HLCU349102260' AND status = 'draft';
