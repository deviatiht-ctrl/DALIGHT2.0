-- ============================================
-- DALIGHT - FIX DUPLICATE QR CODES
-- Script pour détecter et corriger les codes QR dupliqués
-- ============================================

-- 1. TROUVER TOUS LES CODES QR DUPLIQUÉS
-- Cette requête montre tous les QR codes qui sont utilisés par plusieurs employés
SELECT 
    qr_data,
    COUNT(*) as nombre_employes,
    STRING_AGG(full_name || ' (' || employee_number || ')', ', ') as employes_concernes
FROM presence_employees
WHERE qr_data IS NOT NULL
GROUP BY qr_data
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 2. DÉTAILS COMPLETS DES EMPLOYÉS AVEC QR DUPLIQUÉS
-- Pour voir tous les détails des employés affectés
SELECT 
    pe.id,
    pe.employee_number,
    pe.full_name,
    pe.position,
    pe.qr_data,
    pe.created_at,
    pe.is_active
FROM presence_employees pe
WHERE pe.qr_data IN (
    SELECT qr_data
    FROM presence_employees
    WHERE qr_data IS NOT NULL
    GROUP BY qr_data
    HAVING COUNT(*) > 1
)
ORDER BY pe.qr_data, pe.created_at;

-- 3. FONCTION POUR GÉNÉRER UN NOUVEAU QR CODE UNIQUE
-- Cette fonction génère un nouveau QR code et vérifie qu'il n'existe pas déjà
CREATE OR REPLACE FUNCTION generate_unique_qr_code()
RETURNS TEXT AS $$
DECLARE
    new_qr_code TEXT;
    qr_exists BOOLEAN;
BEGIN
    LOOP
        -- Générer un nouveau code QR avec UUID
        new_qr_code := 'DALIGHT-EMP-' || gen_random_uuid()::TEXT;
        
        -- Vérifier si ce code existe déjà
        SELECT EXISTS(
            SELECT 1 FROM presence_employees WHERE qr_data = new_qr_code
        ) INTO qr_exists;
        
        -- Si le code n'existe pas, le retourner
        IF NOT qr_exists THEN
            RETURN new_qr_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. CORRIGER AUTOMATIQUEMENT LES DOUBLONS
-- Cette requête garde le plus ancien employé avec le QR original
-- et donne de nouveaux QR codes aux autres
WITH duplicates AS (
    SELECT 
        id,
        qr_data,
        ROW_NUMBER() OVER (PARTITION BY qr_data ORDER BY created_at ASC) as rn
    FROM presence_employees
    WHERE qr_data IN (
        SELECT qr_data
        FROM presence_employees
        WHERE qr_data IS NOT NULL
        GROUP BY qr_data
        HAVING COUNT(*) > 1
    )
)
UPDATE presence_employees
SET qr_data = generate_unique_qr_code()
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
)
RETURNING id, employee_number, full_name, qr_data as nouveau_qr_code;

-- 5. VÉRIFIER QU'IL N'Y A PLUS DE DOUBLONS
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ Aucun doublon trouvé'
        ELSE '✗ ' || COUNT(*) || ' doublons restants'
    END as statut
FROM (
    SELECT qr_data
    FROM presence_employees
    WHERE qr_data IS NOT NULL
    GROUP BY qr_data
    HAVING COUNT(*) > 1
) as duplicates;

-- 6. AJOUTER UNE CONTRAINTE UNIQUE (OPTIONNEL - À FAIRE APRÈS NETTOYAGE)
-- Ceci empêchera les futurs doublons
-- ATTENTION: Ne pas exécuter si des doublons existent encore!
-- ALTER TABLE presence_employees 
-- DROP CONSTRAINT IF EXISTS presence_employees_qr_data_key;
-- 
-- ALTER TABLE presence_employees 
-- ADD CONSTRAINT presence_employees_qr_data_key UNIQUE (qr_data);

-- 7. CRÉER UNE VUE POUR SURVEILLER LES DOUBLONS
CREATE OR REPLACE VIEW v_duplicate_qr_codes AS
SELECT 
    qr_data,
    COUNT(*) as nombre_employes,
    ARRAY_AGG(
        json_build_object(
            'id', id,
            'employee_number', employee_number,
            'full_name', full_name,
            'position', position,
            'created_at', created_at,
            'is_active', is_active
        ) ORDER BY created_at
    ) as employes
FROM presence_employees
WHERE qr_data IS NOT NULL
GROUP BY qr_data
HAVING COUNT(*) > 1;

-- 8. FONCTION POUR RÉATTRIBUER UN QR CODE EN TOUTE SÉCURITÉ
-- Cette fonction s'assure qu'il n'y a pas de conflit
CREATE OR REPLACE FUNCTION reassign_qr_code_safely(
    p_old_employee_id UUID,
    p_new_employee_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_qr_code TEXT;
    v_new_qr_for_old TEXT;
    v_duplicate_count INTEGER;
    v_result JSON;
BEGIN
    -- Récupérer le QR code de l'ancien employé
    SELECT qr_data INTO v_qr_code
    FROM presence_employees
    WHERE id = p_old_employee_id;
    
    IF v_qr_code IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Ancien employé n''a pas de QR code'
        );
    END IF;
    
    -- Vérifier s'il y a des doublons de ce QR code
    SELECT COUNT(*) INTO v_duplicate_count
    FROM presence_employees
    WHERE qr_data = v_qr_code;
    
    -- Générer un nouveau QR pour l'ancien employé
    v_new_qr_for_old := generate_unique_qr_code();
    
    -- Si des doublons existent, les corriger d'abord
    IF v_duplicate_count > 1 THEN
        UPDATE presence_employees
        SET qr_data = generate_unique_qr_code()
        WHERE qr_data = v_qr_code 
        AND id != p_old_employee_id;
    END IF;
    
    -- Mettre à jour l'ancien employé avec un nouveau QR
    UPDATE presence_employees
    SET qr_data = v_new_qr_for_old
    WHERE id = p_old_employee_id;
    
    -- Attribuer l'ancien QR au nouvel employé
    UPDATE presence_employees
    SET qr_data = v_qr_code
    WHERE id = p_new_employee_id;
    
    RETURN json_build_object(
        'success', true,
        'old_employee_new_qr', v_new_qr_for_old,
        'new_employee_qr', v_qr_code,
        'duplicates_fixed', v_duplicate_count - 1
    );
END;
$$ LANGUAGE plpgsql;

-- 9. EXEMPLE D'UTILISATION DE LA FONCTION DE RÉATTRIBUTION
-- SELECT reassign_qr_code_safely(
--     'uuid-ancien-employe'::UUID,
--     'uuid-nouvel-employe'::UUID
-- );

-- 10. RAPPORT COMPLET SUR L'ÉTAT DES QR CODES
SELECT 
    'Total employés' as categorie,
    COUNT(*) as nombre
FROM presence_employees
UNION ALL
SELECT 
    'Employés avec QR code',
    COUNT(*)
FROM presence_employees
WHERE qr_data IS NOT NULL
UNION ALL
SELECT 
    'Employés sans QR code',
    COUNT(*)
FROM presence_employees
WHERE qr_data IS NULL
UNION ALL
SELECT 
    'QR codes dupliqués',
    COUNT(DISTINCT qr_data)
FROM presence_employees
WHERE qr_data IN (
    SELECT qr_data
    FROM presence_employees
    WHERE qr_data IS NOT NULL
    GROUP BY qr_data
    HAVING COUNT(*) > 1
)
UNION ALL
SELECT 
    'Employés affectés par doublons',
    COUNT(*)
FROM presence_employees
WHERE qr_data IN (
    SELECT qr_data
    FROM presence_employees
    WHERE qr_data IS NOT NULL
    GROUP BY qr_data
    HAVING COUNT(*) > 1
);
