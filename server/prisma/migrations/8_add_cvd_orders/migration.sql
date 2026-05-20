-- ADD/CVD orders: moves the bundled JSON seed into the DB so the list
-- can be refreshed by the Federal Register sync cron without redeploys.
-- status='active' = live; 'pending' = sync-discovered, awaiting review;
-- 'dismissed' = manually rejected.

CREATE TABLE IF NOT EXISTS "add_cvd_orders" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "case"          VARCHAR(50)  NOT NULL,
  "type"          VARCHAR(10)  NOT NULL,
  "country"       VARCHAR(10)  NOT NULL,
  "product"       TEXT         NOT NULL,
  "hts_prefixes"  TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "note"          TEXT,
  "status"        VARCHAR(20)  NOT NULL DEFAULT 'active',
  "source"        VARCHAR(40)  NOT NULL DEFAULT 'manual',
  "source_url"    TEXT,
  "source_date"   TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "add_cvd_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "add_cvd_orders_status_idx"  ON "add_cvd_orders" ("status");
CREATE INDEX IF NOT EXISTS "add_cvd_orders_country_idx" ON "add_cvd_orders" ("country");

-- Seed from the bundled JSON (22 curated active orders). Idempotent:
-- only inserts when the table is empty, so re-running the migration
-- never duplicates rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "add_cvd_orders" LIMIT 1) THEN
    INSERT INTO "add_cvd_orders" ("case", "type", "country", "product", "hts_prefixes", "note", "status", "source") VALUES
      ('A-570-979', 'AD',  'CN', 'Crystalline silicon photovoltaic cells',   ARRAY['8541.43']::TEXT[],                              'Solar cells / modules — frequent enforcement target', 'active', 'manual'),
      ('C-570-980', 'CVD', 'CN', 'Crystalline silicon photovoltaic cells',   ARRAY['8541.43']::TEXT[],                              'Paired with A-570-979',                                'active', 'manual'),
      ('A-570-053', 'AD',  'CN', 'Truck and bus tires',                      ARRAY['4011.20']::TEXT[],                              '',                                                     'active', 'manual'),
      ('A-201-805', 'AD',  'MX', 'Steel concrete reinforcing bar (rebar)',   ARRAY['7213.10','7214.20','7228.30']::TEXT[],          '',                                                     'active', 'manual'),
      ('A-570-026', 'AD',  'CN', 'Carbon and certain alloy steel wire rod',  ARRAY['7213.91','7213.99','7227.20']::TEXT[],          '',                                                     'active', 'manual'),
      ('A-570-893', 'AD',  'CN', 'Frozen warmwater shrimp',                  ARRAY['0306.17','1605.21','1605.29']::TEXT[],          '',                                                     'active', 'manual'),
      ('A-560-832', 'AD',  'ID', 'Frozen warmwater shrimp',                  ARRAY['0306.17','1605.21']::TEXT[],                    '',                                                     'active', 'manual'),
      ('A-560-815', 'AD',  'IN', 'Frozen warmwater shrimp',                  ARRAY['0306.17','1605.21']::TEXT[],                    '',                                                     'active', 'manual'),
      ('A-570-863', 'AD',  'CN', 'Honey',                                    ARRAY['0409.00']::TEXT[],                              '',                                                     'active', 'manual'),
      ('A-570-831', 'AD',  'CN', 'Fresh garlic',                             ARRAY['0703.20']::TEXT[],                              '',                                                     'active', 'manual'),
      ('A-570-983', 'AD',  'CN', 'Drawn stainless steel sinks',              ARRAY['7324.10']::TEXT[],                              '',                                                     'active', 'manual'),
      ('A-570-894', 'AD',  'CN', 'Carbon steel butt-weld pipe fittings',     ARRAY['7307.93']::TEXT[],                              '',                                                     'active', 'manual'),
      ('A-570-067', 'AD',  'CN', 'Aluminum extrusions',                      ARRAY['7604.21','7604.29','7608.20','7609.00']::TEXT[], 'Frequent self-certification audits',                  'active', 'manual'),
      ('A-588-869', 'AD',  'JP', 'Welded line pipe',                         ARRAY['7305.11','7305.12']::TEXT[],                    '',                                                     'active', 'manual'),
      ('A-580-868', 'AD',  'KR', 'Cold-rolled steel flat products',          ARRAY['7209.15','7209.16','7209.17']::TEXT[],          '',                                                     'active', 'manual'),
      ('A-552-805', 'AD',  'VN', 'Frozen fish fillets (catfish)',            ARRAY['0304.62']::TEXT[],                              '',                                                     'active', 'manual'),
      ('A-583-852', 'AD',  'TW', 'Carbon steel cut-to-length plate',         ARRAY['7208.40','7208.51','7208.52']::TEXT[],          '',                                                     'active', 'manual'),
      ('A-570-016', 'AD',  'CN', 'Magnesia carbon bricks',                   ARRAY['6815.91']::TEXT[],                              '',                                                     'active', 'manual'),
      ('A-570-918', 'AD',  'CN', 'Steel wire garment hangers',               ARRAY['7326.20']::TEXT[],                              '',                                                     'active', 'manual'),
      ('C-570-919', 'CVD', 'CN', 'Steel wire garment hangers',               ARRAY['7326.20']::TEXT[],                              'Paired with A-570-918',                                'active', 'manual'),
      ('A-549-823', 'AD',  'TH', 'Steel rebar',                              ARRAY['7213.10','7214.20']::TEXT[],                    '',                                                     'active', 'manual'),
      ('A-570-088', 'AD',  'CN', 'Quartz surface products',                  ARRAY['6810.99']::TEXT[],                              '',                                                     'active', 'manual');
  END IF;
END
$$;
