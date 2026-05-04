-- =============================================
-- DALIGHT — Head Spa Pricing Table
-- Fichye: 05_head_spa_pricing.sql
-- Kouri nan Supabase SQL Editor
-- =============================================
-- Tab sa pou pri Head Spa pa tip cheve
-- (Itilize pa admin/services.html)
-- =============================================

CREATE TABLE IF NOT EXISTS head_spa_pricing (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type        TEXT NOT NULL UNIQUE,   -- 'extra_court', 'court', 'large', 'extra_large'
  label       TEXT NOT NULL,          -- 'Extra Court', 'Court', etc.
  description TEXT DEFAULT '',
  price_htg   NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_usd   NUMERIC(10,2),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE head_spa_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read head spa pricing" ON head_spa_pricing;
DROP POLICY IF EXISTS "Auth manage head spa pricing" ON head_spa_pricing;

CREATE POLICY "Public read head spa pricing"
  ON head_spa_pricing FOR SELECT USING (is_active = true);

CREATE POLICY "Auth manage head spa pricing"
  ON head_spa_pricing FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_head_spa_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS head_spa_pricing_updated_at ON head_spa_pricing;
CREATE TRIGGER head_spa_pricing_updated_at
  BEFORE UPDATE ON head_spa_pricing
  FOR EACH ROW EXECUTE FUNCTION update_head_spa_pricing_updated_at();

-- Done inisyal (4 tip cheve)
INSERT INTO head_spa_pricing (type, label, description, price_htg, price_usd, sort_order) VALUES
  ('extra_court', 'Extra Court', 'Cheveux très courts (moins de 5 cm)',   8000,  55, 1),
  ('court',       'Court',       'Cheveux courts (5–15 cm)',               10000,  70, 2),
  ('large',       'Large',       'Cheveux mi-longs à longs (15–40 cm)',   12000,  85, 3),
  ('extra_large', 'Extra Large', 'Cheveux très longs (plus de 40 cm)',    15000, 105, 4)
ON CONFLICT (type) DO NOTHING;
