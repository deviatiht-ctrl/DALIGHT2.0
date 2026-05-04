-- =============================================
-- DALIGHT — Fix Contrainte services.category
-- Fichye: 02_services_fix.sql
-- Kouri nan Supabase SQL Editor
-- RÉSOUT: services_category_check violation
-- =============================================

-- Étape 1: Retire CHECK constraint ki limite valè category
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints
  WHERE table_name = 'services'
    AND constraint_type = 'CHECK'
    AND constraint_name ILIKE '%category%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE services DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE 'Constraint % dropped', v_constraint_name;
  ELSE
    RAISE NOTICE 'No category check constraint found (already removed or never existed)';
  END IF;
END
$$;

-- Étape 2: Asire kolòn category se TEXT san restrikasyon fiks
-- (Valè yo ap soti nan table service_categories kounye a)
ALTER TABLE services ALTER COLUMN category SET DEFAULT 'headspa';

-- Étape 3: Verifye table service_categories egziste, kreye si non
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active service categories" ON service_categories;
DROP POLICY IF EXISTS "Auth can manage service categories" ON service_categories;

CREATE POLICY "Public can read active service categories"
  ON service_categories FOR SELECT USING (is_active = true);

CREATE POLICY "Auth can manage service categories"
  ON service_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Étape 4: Done inisyal
INSERT INTO service_categories (slug, label, sort_order) VALUES
  ('headspa', 'Head Spa', 1),
  ('massage', 'Massage', 2),
  ('package', 'Package', 3),
  ('cure',    'Cure',    4),
  ('soin',    'Soin',    5),
  ('autre',   'Autre',   6)
ON CONFLICT (slug) DO NOTHING;
