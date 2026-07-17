-- ============================================
-- DALIGHT - SIMPLE QR MODIFIER SETUP
-- Version simplifiée sans fonctions complexes
-- ============================================

-- ÉTAPE 1: Supprimer la contrainte UNIQUE sur qr_data
ALTER TABLE presence_employees 
DROP CONSTRAINT IF EXISTS presence_employees_qr_data_key;

DROP INDEX IF EXISTS presence_employees_qr_data_key;

-- ÉTAPE 2: Ajouter la colonne qr_modifier
ALTER TABLE presence_employees 
ADD COLUMN IF NOT EXISTS qr_modifier TEXT DEFAULT NULL;

-- ÉTAPE 3: Créer un index composite unique (qr_data + qr_modifier)
-- Cela permet à plusieurs employés d'avoir le même qr_data, mais avec des modifiers différents
CREATE UNIQUE INDEX IF NOT EXISTS idx_presence_employees_qr_unique 
ON presence_employees(qr_data, COALESCE(qr_modifier, ''));

-- ÉTAPE 4: Créer un index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_presence_employees_qr_data 
ON presence_employees(qr_data) WHERE qr_data IS NOT NULL;

-- VÉRIFICATION: Voir la structure de la table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'presence_employees'
AND column_name IN ('qr_data', 'qr_modifier')
ORDER BY ordinal_position;

-- VÉRIFICATION: Voir les contraintes
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'presence_employees'::regclass
AND conname LIKE '%qr%';
