-- =============================================
-- DALIGHT — Head Spa Pricing Table (FLEXIBLE)
-- Fichye: 05_head_spa_pricing.sql
-- Kouri nan Supabase SQL Editor
-- =============================================
-- REZOUD: head_spa_pricing_type_check erreur
-- Admin ka ajoute NENPOT tip cheve + longueur
-- =============================================

-- Étape 1: Kreye tab si li pa la (SANS check constraint)
CREATE TABLE IF NOT EXISTS head_spa_pricing (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  hair_length TEXT DEFAULT '',
  description TEXT DEFAULT '',
  price_htg   NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_usd   NUMERIC(10,2),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Étape 2: Retire OLD check constraint si li egziste
DO $$
DECLARE v_con TEXT;
BEGIN
  SELECT constraint_name INTO v_con
  FROM information_schema.table_constraints
  WHERE table_name = 'head_spa_pricing'
    AND constraint_type = 'CHECK'
    AND constraint_name ILIKE '%type%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE head_spa_pricing DROP CONSTRAINT IF EXISTS %I', v_con);
    RAISE NOTICE 'Constraint % removed', v_con;
  END IF;
END $$;

-- Étape 3: Ajoute kolb hair_length si li manke
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'head_spa_pricing' AND column_name = 'hair_length'
  ) THEN
    ALTER TABLE head_spa_pricing ADD COLUMN hair_length TEXT DEFAULT '';
  END IF;
END $$;

-- Étape 4: RLS
ALTER TABLE head_spa_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read head spa pricing" ON head_spa_pricing;
DROP POLICY IF EXISTS "Auth manage head spa pricing" ON head_spa_pricing;

CREATE POLICY "Public read head spa pricing"
  ON head_spa_pricing FOR SELECT USING (is_active = true);

CREATE POLICY "Auth manage head spa pricing"
  ON head_spa_pricing FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Étape 5: Trigger updated_at
CREATE OR REPLACE FUNCTION update_head_spa_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS head_spa_pricing_updated_at ON head_spa_pricing;
CREATE TRIGGER head_spa_pricing_updated_at
  BEFORE UPDATE ON head_spa_pricing
  FOR EACH ROW EXECUTE FUNCTION update_head_spa_pricing_updated_at();

-- Étape 6: Done inisyal (UPSERT — pa efase existants)
INSERT INTO head_spa_pricing (type, label, hair_length, description, price_htg, price_usd, sort_order)
VALUES
  ('extra_court', 'Extra Court', 'Moins de 5 cm',  'Cheveux très courts',          3000,  20, 1),
  ('court',       'Court',       '5 à 15 cm',       'Cheveux courts',                4000,  28, 2),
  ('medium',      'Medium',      '15 à 30 cm',      'Cheveux mi-longs',              5000,  35, 3),
  ('large',       'Large',       '30 à 50 cm',      'Cheveux longs',                 6000,  42, 4),
  ('extra_large', 'Extra Large', 'Plus de 50 cm',   'Cheveux très longs',            7500,  52, 5)
ON CONFLICT (type) DO UPDATE SET
  label       = EXCLUDED.label,
  hair_length = EXCLUDED.hair_length,
  price_htg   = EXCLUDED.price_htg,
  price_usd   = EXCLUDED.price_usd;
