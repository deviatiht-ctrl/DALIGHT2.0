-- =============================================
-- DALIGHT — Gestion Catégories Produits
-- Fichye: 01_categorie_produit.sql
-- Kouri nan Supabase SQL Editor
-- =============================================

-- Étape 1: Kreye tab si li pa la
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Étape 2: Aktive RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Étape 3: Polisi
DROP POLICY IF EXISTS "Public can read active product categories" ON product_categories;
DROP POLICY IF EXISTS "Auth can manage product categories" ON product_categories;

CREATE POLICY "Public can read active product categories"
  ON product_categories FOR SELECT USING (is_active = true);

CREATE POLICY "Auth can manage product categories"
  ON product_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Étape 4: Verifye si kolòn category_id egziste nan products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products ADD COLUMN category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- Étape 5: Done inisyal si tab la vid
INSERT INTO product_categories (name, slug, display_order)
VALUES
  ('Soins Capillaires', 'soins-capillaires', 1),
  ('Huiles & Sérums',   'huiles-serums',     2),
  ('Accessoires',       'accessoires',        3),
  ('Kits & Coffrets',   'kits-coffrets',      4)
ON CONFLICT (slug) DO NOTHING;
