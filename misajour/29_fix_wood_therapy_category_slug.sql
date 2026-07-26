-- ============================================================
-- DALIGHT — Verifye ak korije slug kategori 'wood therapy'
-- Fichier: 29_fix_wood_therapy_category_slug.sql
-- ============================================================

-- 1) Gade ki slug ki egziste kounye a pou kategori Wood Therapy
SELECT id, slug, label FROM service_categories WHERE label ILIKE '%wood%' OR slug ILIKE '%wood%';

-- 2) Gade ki category ki asiyen sou sèvis Wood Therapy a
SELECT id, name, category FROM services WHERE name ILIKE '%wood%' OR category ILIKE '%wood%';

-- 3) Si slug la pa egal 'wood-therapy' (egz: 'woodtherapy'), fè jwenn li ansanm ak sèvis la:
--    (dekonmante ak ranpli id oswa slug ki korek apre ou fin gade rezilta anwo yo)

-- UPDATE service_categories SET slug = 'wood-therapy' WHERE slug = 'woodtherapy';
-- UPDATE services SET category = 'wood-therapy' WHERE category = 'woodtherapy';

-- 4) Fè menm verifikasyon an pou massage si w gen dout
SELECT id, slug, label FROM service_categories WHERE label ILIKE '%massage%' OR slug ILIKE '%massage%';
SELECT id, name, category FROM services WHERE name ILIKE '%massage%';
