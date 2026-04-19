-- =============================================
-- DALIGHT Head Spa — Service Categories Table
-- Run this in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS service_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active categories" ON service_categories;
DROP POLICY IF EXISTS "Auth can manage categories" ON service_categories;

CREATE POLICY "Public can read active categories"
  ON service_categories FOR SELECT USING (is_active = true);

CREATE POLICY "Auth can manage categories"
  ON service_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed defaults
INSERT INTO service_categories (slug, label, sort_order) VALUES
  ('headspa', 'Head Spa', 1),
  ('package', 'Package', 2),
  ('cure', 'Cure', 3),
  ('soin', 'Soin', 4),
  ('autre', 'Autre', 5)
ON CONFLICT (slug) DO NOTHING;
