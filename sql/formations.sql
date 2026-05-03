-- ══════════════════════════════════════════
--  DALIGHT — formations table
--  Run this in Supabase SQL Editor
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS formations (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         varchar(255) NOT NULL,
  subtitle     varchar(255) DEFAULT 'Formation pratique',
  description  text,
  features     text[]        DEFAULT '{}',   -- bullet point list
  price        varchar(100),                  -- e.g. "15 000 Gdes" or "Sur demande"
  duration     varchar(100),                  -- e.g. "2 jours", "1 semaine"
  icon         varchar(100) DEFAULT 'graduation-cap',
  wa_message   text,                          -- pre-filled WhatsApp text
  is_active    boolean      DEFAULT true,
  order_index  int          DEFAULT 0,
  -- Price details (in Gourdes)
  price_inscription int DEFAULT 0,
  price_blouse int DEFAULT 0,
  price_cosmetique int DEFAULT 0,
  price_corporel int DEFAULT 0,
  price_decoration int DEFAULT 0,
  price_massage int DEFAULT 0,
  created_at   timestamptz  DEFAULT now(),
  updated_at   timestamptz  DEFAULT now()
);

-- Add price detail columns to existing table (if upgrading)
ALTER TABLE formations 
  ADD COLUMN IF NOT EXISTS price_inscription int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_blouse int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_cosmetique int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_corporel int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_decoration int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_massage int DEFAULT 0;

-- Row Level Security
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active formations" ON formations;
CREATE POLICY "Public read active formations"
  ON formations FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated manage formations" ON formations;
CREATE POLICY "Authenticated manage formations"
  ON formations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Sample data (you can delete these later) ──
INSERT INTO formations (name, subtitle, description, features, price, duration, icon, wa_message, order_index) VALUES
(
  'Massothérapie',
  'Formation certifiée',
  'Maîtrisez l''art du toucher thérapeutique. Apprenez les techniques de massage professionnel pour soigner et détendre.',
  ARRAY['Massage suédois & drainant', 'Massage crânien (Head Spa)', 'Anatomie & posturologie', 'Pratique supervisée'],
  'Sur demande',
  '1 semaine',
  'hand',
  'Bonjour, je suis intéressé(e) par la formation Massothérapie',
  1
),
(
  'Produits Cosmétiques',
  'Formation pratique',
  'Apprenez à formuler et créer vos propres produits cosmétiques naturels et efficaces.',
  ARRAY['Formulation de crèmes & sérums', 'Ingrédients actifs & naturels', 'Normes de sécurité cosmétique', 'Création de gamme personnelle'],
  'Sur demande',
  '3 jours',
  'flask-conical',
  'Bonjour, je suis intéressé(e) par la formation Produits Cosmétiques',
  2
),
(
  'Produits Corporels',
  'Formation pratique',
  'Concevez des soins corporels complets : gommages, huiles, baumes et lotions sur mesure.',
  ARRAY['Gommages & enveloppements', 'Huiles végétales & essentielles', 'Beurres corporels & baumes', 'Emballage & présentation'],
  'Sur demande',
  '3 jours',
  'droplets',
  'Bonjour, je suis intéressé(e) par la formation Produits Corporels',
  3
),
(
  'Produits Capillaires',
  'Formation pratique',
  'Maîtrisez la création de shampooings, masques, huiles et soins pour tous types de cheveux.',
  ARRAY['Shampooings & après-shampooings', 'Masques nutritifs & réparateurs', 'Huiles capillaires & sérums', 'Soins pour cheveux naturels'],
  'Sur demande',
  '3 jours',
  'wind',
  'Bonjour, je suis intéressé(e) par la formation Produits Capillaires',
  4
),
(
  'Produits de Nettoyage',
  'Formation pratique',
  'Créez une ligne complète de produits ménagers naturels, écologiques et efficaces.',
  ARRAY['Détergents & savons liquides', 'Désinfectants naturels', 'Produits multi-surfaces', 'Certification & commercialisation'],
  'Sur demande',
  '2 jours',
  'spray-can',
  'Bonjour, je suis intéressé(e) par la formation Produits de Nettoyage',
  5
),
(
  'Décoration Événementielle',
  'Formation créative',
  'Transformez chaque espace en un lieu magique. Apprenez à orchestrer des événements mémorables.',
  ARRAY['Design floral & composition', 'Mise en scène & scénographie', 'Mariage, anniversaire & corporate', 'Gestion de projet événementiel'],
  'Sur demande',
  '1 semaine',
  'party-popper',
  'Bonjour, je suis intéressé(e) par la formation Décoration Événementielle',
  6
);
