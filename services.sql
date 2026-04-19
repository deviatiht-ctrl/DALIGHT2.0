-- =============================================
-- DALIGHT Head Spa — Services Table
-- Run this in Supabase SQL Editor
-- =============================================
-- SAFE: Works for both fresh install AND existing table

-- ─── STEP 1: Create table if it doesn't exist ───
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'headspa',
  duration TEXT NOT NULL DEFAULT '60 min',
  price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_htg NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── STEP 2: Add missing columns (safe for existing tables) ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'is_featured') THEN
    ALTER TABLE services ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'description') THEN
    ALTER TABLE services ADD COLUMN description TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'sort_order') THEN
    ALTER TABLE services ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
  END IF;
END
$$;

-- ─── STEP 3: Enable Row Level Security ───
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- ─── STEP 4: Policies (drop existing to avoid conflicts, then create) ───
DROP POLICY IF EXISTS "Public can read active services" ON services;
DROP POLICY IF EXISTS "Authenticated users can read all services" ON services;
DROP POLICY IF EXISTS "Authenticated users can insert services" ON services;
DROP POLICY IF EXISTS "Authenticated users can update services" ON services;
DROP POLICY IF EXISTS "Authenticated users can delete services" ON services;

CREATE POLICY "Public can read active services"
  ON services FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can read all services"
  ON services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete services"
  ON services FOR DELETE
  TO authenticated
  USING (true);

-- ─── STEP 5: Auto-update trigger ───
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

-- ─── STEP 6: Seed data (only if table is empty) ───
INSERT INTO services (name, description, category, duration, price_usd, price_htg, is_active, is_featured, sort_order)
SELECT * FROM (VALUES
  ('Head Spa Signature', 'Soin complet du cuir chevelu, massage crânien et détente cervicale.', 'headspa', '60 min', 85::NUMERIC, 10000::NUMERIC, true, true, 1),
  ('Rituel Zen Impérial', 'L''expérience ultime : Head Spa, bain de vapeur aux herbes et massage épaules.', 'headspa', '90 min', 125::NUMERIC, 15000::NUMERIC, true, true, 2),
  ('Soin Détox & Équilibre', 'Exfoliation délicate, massage purifiant et masque capillaire revitalisant.', 'headspa', '75 min', 100::NUMERIC, 12000::NUMERIC, true, false, 3),
  ('Head Spa & Éclat Visage', 'Duo prestigieux : Soin crânien profond et massage sculptant du visage.', 'headspa', '105 min', 150::NUMERIC, 18000::NUMERIC, true, false, 4),
  ('Duo Sérénité', 'Vivez l''expérience DALIGHT à deux, un moment suspendu de pure harmonie.', 'package', '60 min', 160::NUMERIC, 19000::NUMERIC, true, false, 5),
  ('Rituel Renaissance 4', 'Cure de 4 rituels personnalisés pour une chevelure éclatante et un esprit apaisé.', 'cure', '4 rituels', 300::NUMERIC, 35000::NUMERIC, true, false, 6),
  ('Love & Zen Package', 'Head Spa Signature + bulles + douceur sucrée. Parenthèse enchantée pour amoureux.', 'package', '90 min', 100::NUMERIC, 12000::NUMERIC, true, false, 7),
  ('Cure Vitalité Intense (6)', 'Le summum du soin capillaire pour une chevelure transformée (6 rituels).', 'cure', '6 rituels', 420::NUMERIC, 50000::NUMERIC, true, false, 8),
  ('Cure Vitalité Intense (10)', 'Programme complet de revitalisation intensive (10 rituels).', 'cure', '10 rituels', 670::NUMERIC, 80000::NUMERIC, true, false, 9)
) AS seed(name, description, category, duration, price_usd, price_htg, is_active, is_featured, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM services LIMIT 1);
