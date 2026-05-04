-- =============================================
-- DALIGHT — Prix Head Spa par Type Cheveux
-- Fichye: 03_headspa_prix_cheveux.sql
-- Kouri nan Supabase SQL Editor
-- =============================================
-- LOGIQUE:
--   Admin ajoute yon sèvis Head Spa
--   Li ka defini 4 pri diferan selon kalite cheve a:
--     extra_court, court, large, extra_large
--   Kliyan chwazi tip cheve li → pri kòrèk parèt
-- =============================================

-- Étape 1: Kreye tab prix pa tip cheve
CREATE TABLE IF NOT EXISTS service_hair_prices (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  hair_type   TEXT NOT NULL CHECK (hair_type IN ('extra_court', 'court', 'large', 'extra_large')),
  label_fr    TEXT NOT NULL, -- Afichaj: "Extra Court", "Court", etc.
  price_htg   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, hair_type)
);

-- Étape 2: RLS
ALTER TABLE service_hair_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read hair prices" ON service_hair_prices;
DROP POLICY IF EXISTS "Auth manage hair prices" ON service_hair_prices;

CREATE POLICY "Public read hair prices"
  ON service_hair_prices FOR SELECT USING (true);

CREATE POLICY "Auth manage hair prices"
  ON service_hair_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Étape 3: Index pou performance
CREATE INDEX IF NOT EXISTS idx_hair_prices_service
  ON service_hair_prices(service_id);

-- Étape 4: Ajoute done demo pou Head Spa Signature (si egziste)
-- Si sèvis la pa egziste, INSERT sa yo ap pa fè anyen (DO NOTHING)
INSERT INTO service_hair_prices (service_id, hair_type, label_fr, price_htg)
SELECT 
  s.id,
  hp.hair_type,
  hp.label_fr,
  hp.price_htg
FROM services s
CROSS JOIN (VALUES
  ('extra_court', 'Extra Court', 8000),
  ('court',       'Court',       10000),
  ('large',       'Large',       12000),
  ('extra_large', 'Extra Large', 15000)
) AS hp(hair_type, label_fr, price_htg)
WHERE s.name = 'Head Spa Signature'
ON CONFLICT (service_id, hair_type) DO NOTHING;
