-- ============================================
-- DALIGHT - REMOVE QR UNIQUE CONSTRAINT
-- Retire la contrainte UNIQUE sur qr_data pour permettre le partage
-- ============================================

-- 1. TROUVER ET SUPPRIMER LA CONTRAINTE UNIQUE SUR qr_data
-- Note: Le nom de la contrainte peut varier selon votre installation
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Chercher le nom de la contrainte unique sur qr_data
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'presence_employees'::regclass
    AND contype = 'u'
    AND conkey = (SELECT ARRAY[attnum] FROM pg_attribute WHERE attrelid = 'presence_employees'::regclass AND attname = 'qr_data');
    
    -- Si trouvée, la supprimer
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE presence_employees DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Contrainte % supprimée avec succès', constraint_name;
    ELSE
        RAISE NOTICE 'Aucune contrainte unique trouvée sur qr_data';
    END IF;
END $$;

-- 2. SUPPRIMER AUSSI L'INDEX UNIQUE SI IL EXISTE
DROP INDEX IF EXISTS presence_employees_qr_data_key;
DROP INDEX IF EXISTS idx_presence_employees_qr_data_unique;

-- 3. VÉRIFIER QUE LA CONTRAINTE EST BIEN SUPPRIMÉE
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'presence_employees'::regclass
AND conkey = (SELECT ARRAY[attnum] FROM pg_attribute WHERE attrelid = 'presence_employees'::regclass AND attname = 'qr_data');

-- Si aucune ligne n'est retournée, c'est bon!
