-- ============================================
-- DALIGHT - ADD QR MODIFIER SYSTEM
-- Permet d'utiliser le même QR code physique pour plusieurs employés
-- avec un modificateur unique dans la base de données
-- ============================================

-- 1. AJOUTER LA COLONNE qr_modifier
-- Modificateur pour différencier les employés avec le même QR code physique
ALTER TABLE presence_employees 
ADD COLUMN IF NOT EXISTS qr_modifier TEXT DEFAULT NULL;

-- 2. CRÉER UN INDEX COMPOSITE UNIQUE
-- Combinaison qr_data + qr_modifier doit être unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_presence_employees_qr_unique 
ON presence_employees(qr_data, COALESCE(qr_modifier, ''));

-- 3. FONCTION POUR AUTO-ASSIGNER UN MODIFICATEUR
-- Quand on assigne le même QR à plusieurs employés, auto-génère A, B, C, etc.
CREATE OR REPLACE FUNCTION auto_assign_qr_modifier()
RETURNS TRIGGER AS $$
DECLARE
    v_count INTEGER;
    v_next_modifier TEXT;
    v_modifiers TEXT[] := ARRAY['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
BEGIN
    -- Si c'est une insertion ou mise à jour du QR code
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.qr_data IS DISTINCT FROM NEW.qr_data)) THEN
        -- Compter combien d'employés ont déjà ce QR code
        SELECT COUNT(*) INTO v_count
        FROM presence_employees
        WHERE qr_data = NEW.qr_data
        AND id != NEW.id;
        
        -- Si c'est le premier, pas de modificateur
        IF v_count = 0 THEN
            NEW.qr_modifier := NULL;
        -- Sinon, assigner le prochain modificateur disponible
        ELSE
            -- Trouver le prochain modificateur non utilisé
            FOR i IN 1..array_length(v_modifiers, 1) LOOP
                v_next_modifier := v_modifiers[i];
                
                -- Vérifier si ce modificateur est déjà utilisé
                IF NOT EXISTS (
                    SELECT 1 FROM presence_employees
                    WHERE qr_data = NEW.qr_data
                    AND qr_modifier = v_next_modifier
                    AND id != NEW.id
                ) THEN
                    NEW.qr_modifier := v_next_modifier;
                    EXIT;
                END IF;
            END LOOP;
            
            -- Si tous les modificateurs sont utilisés, utiliser un numéro
            IF NEW.qr_modifier IS NULL THEN
                NEW.qr_modifier := 'Z' || (v_count + 1)::TEXT;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. CRÉER LE TRIGGER
DROP TRIGGER IF EXISTS trg_auto_assign_qr_modifier ON presence_employees;
CREATE TRIGGER trg_auto_assign_qr_modifier
    BEFORE INSERT OR UPDATE OF qr_data ON presence_employees
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_qr_modifier();

-- 5. VUE POUR VOIR LES QR CODES AVEC MODIFICATEURS
CREATE OR REPLACE VIEW v_qr_codes_with_modifiers AS
SELECT 
    qr_data,
    COUNT(*) as nombre_employes,
    ARRAY_AGG(
        json_build_object(
            'id', id,
            'employee_number', employee_number,
            'full_name', full_name,
            'position', position,
            'qr_modifier', COALESCE(qr_modifier, 'Principal'),
            'qr_display', qr_data || COALESCE('-' || qr_modifier, ''),
            'is_active', is_active
        ) ORDER BY COALESCE(qr_modifier, '')
    ) as employes
FROM presence_employees
WHERE qr_data IS NOT NULL
GROUP BY qr_data
ORDER BY COUNT(*) DESC;

-- 6. FONCTION POUR OBTENIR L'EMPLOYÉ PAR QR + MODIFICATEUR
CREATE OR REPLACE FUNCTION get_employee_by_qr_and_modifier(
    p_qr_data TEXT,
    p_qr_modifier TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    employee_number TEXT,
    full_name TEXT,
    emp_position TEXT,
    qr_modifier TEXT,
    photo_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pe.id,
        pe.employee_number,
        pe.full_name,
        pe."position",
        pe.qr_modifier,
        pe.photo_url
    FROM presence_employees pe
    WHERE pe.qr_data = p_qr_data
    AND (
        (p_qr_modifier IS NULL AND pe.qr_modifier IS NULL) OR
        (pe.qr_modifier = p_qr_modifier)
    )
    AND pe.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 7. MIGRER LES DONNÉES EXISTANTES
-- Pour les QR codes qui existent déjà en double, assigner des modificateurs
DO $$
DECLARE
    v_qr_record RECORD;
    v_emp_record RECORD;
    v_modifier_index INTEGER;
    v_modifiers TEXT[] := ARRAY['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
BEGIN
    -- Pour chaque QR code qui a des doublons
    FOR v_qr_record IN 
        SELECT qr_data, COUNT(*) as cnt
        FROM presence_employees
        WHERE qr_data IS NOT NULL
        GROUP BY qr_data
        HAVING COUNT(*) > 1
    LOOP
        v_modifier_index := 1;
        
        -- Pour chaque employé avec ce QR code
        FOR v_emp_record IN
            SELECT id
            FROM presence_employees
            WHERE qr_data = v_qr_record.qr_data
            ORDER BY created_at
        LOOP
            -- Le premier garde NULL (principal), les autres ont A, B, C...
            IF v_modifier_index > 1 THEN
                UPDATE presence_employees
                SET qr_modifier = v_modifiers[v_modifier_index - 1]
                WHERE id = v_emp_record.id;
            END IF;
            
            v_modifier_index := v_modifier_index + 1;
        END LOOP;
    END LOOP;
END $$;

-- 8. RAPPORT SUR LES QR CODES AVEC MODIFICATEURS
SELECT 
    'QR codes uniques (1 employé)' as type,
    COUNT(*) as nombre
FROM (
    SELECT qr_data
    FROM presence_employees
    WHERE qr_data IS NOT NULL
    GROUP BY qr_data
    HAVING COUNT(*) = 1
) as unique_qr
UNION ALL
SELECT 
    'QR codes partagés (2+ employés)',
    COUNT(*)
FROM (
    SELECT qr_data
    FROM presence_employees
    WHERE qr_data IS NOT NULL
    GROUP BY qr_data
    HAVING COUNT(*) > 1
) as shared_qr
UNION ALL
SELECT 
    'Employés avec modificateur',
    COUNT(*)
FROM presence_employees
WHERE qr_modifier IS NOT NULL;

-- 9. EXEMPLE D'UTILISATION
-- Voir tous les employés avec le même QR code et leurs modificateurs
-- SELECT * FROM v_qr_codes_with_modifiers WHERE nombre_employes > 1;

-- 10. ASSIGNER MANUELLEMENT UN MODIFICATEUR
-- UPDATE presence_employees 
-- SET qr_modifier = 'A' 
-- WHERE id = 'uuid-christmine';
-- 
-- UPDATE presence_employees 
-- SET qr_modifier = 'B' 
-- WHERE id = 'uuid-derogene';
