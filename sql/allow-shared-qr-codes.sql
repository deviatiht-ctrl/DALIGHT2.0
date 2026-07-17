-- ============================================
-- DALIGHT - ALLOW SHARED QR CODES
-- Permettre à plusieurs employés de partager le même code QR
-- ============================================

-- 1. RETIRER LA CONTRAINTE UNIQUE SUR qr_data
-- Ceci permet à plusieurs employés d'avoir le même QR code
ALTER TABLE presence_employees 
DROP CONSTRAINT IF EXISTS presence_employees_qr_data_key;

-- 2. CRÉER UN INDEX POUR PERFORMANCE (non-unique)
-- Pour rechercher rapidement tous les employés avec un QR code donné
CREATE INDEX IF NOT EXISTS idx_presence_employees_qr_data 
ON presence_employees(qr_data) 
WHERE qr_data IS NOT NULL;

-- 3. VUE POUR VOIR LES QR CODES PARTAGÉS
CREATE OR REPLACE VIEW v_shared_qr_codes AS
SELECT 
    qr_data,
    COUNT(*) as nombre_employes,
    ARRAY_AGG(
        json_build_object(
            'id', id,
            'employee_number', employee_number,
            'full_name', full_name,
            'position', position,
            'photo_url', photo_url,
            'is_active', is_active
        ) ORDER BY full_name
    ) as employes
FROM presence_employees
WHERE qr_data IS NOT NULL
GROUP BY qr_data
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 4. FONCTION POUR OBTENIR TOUS LES EMPLOYÉS D'UN QR CODE
CREATE OR REPLACE FUNCTION get_employees_by_qr(p_qr_data TEXT)
RETURNS TABLE (
    id UUID,
    employee_number TEXT,
    full_name TEXT,
    position TEXT,
    email TEXT,
    phone TEXT,
    nif TEXT,
    photo_url TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pe.id,
        pe.employee_number,
        pe.full_name,
        pe.position,
        pe.email,
        pe.phone,
        pe.nif,
        pe.photo_url,
        pe.is_active
    FROM presence_employees pe
    WHERE pe.qr_data = p_qr_data
    AND pe.is_active = true
    ORDER BY pe.full_name;
END;
$$ LANGUAGE plpgsql;

-- 5. EXEMPLE D'UTILISATION
-- Voir tous les employés qui partagent un QR code
-- SELECT * FROM get_employees_by_qr('DALIGHT-EMP-xxxxx');

-- 6. RAPPORT SUR LES QR CODES PARTAGÉS
SELECT 
    'QR codes uniques' as type,
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
    'QR codes partagés',
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
    'Total employés avec QR partagé',
    COUNT(*)
FROM presence_employees
WHERE qr_data IN (
    SELECT qr_data
    FROM presence_employees
    WHERE qr_data IS NOT NULL
    GROUP BY qr_data
    HAVING COUNT(*) > 1
);

-- 7. FONCTION POUR ASSIGNER LE MÊME QR CODE À PLUSIEURS EMPLOYÉS
CREATE OR REPLACE FUNCTION assign_shared_qr_code(
    p_qr_data TEXT,
    p_employee_ids UUID[]
)
RETURNS JSON AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_employee_id UUID;
BEGIN
    -- Mettre à jour tous les employés avec le même QR code
    FOREACH v_employee_id IN ARRAY p_employee_ids
    LOOP
        UPDATE presence_employees
        SET qr_data = p_qr_data
        WHERE id = v_employee_id;
        
        IF FOUND THEN
            v_updated_count := v_updated_count + 1;
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'qr_code', p_qr_data,
        'employees_updated', v_updated_count
    );
END;
$$ LANGUAGE plpgsql;

-- 8. EXEMPLE: Assigner le même QR à 2 employés
-- SELECT assign_shared_qr_code(
--     'DALIGHT-EMP-shared-001',
--     ARRAY['uuid-employee-1'::UUID, 'uuid-employee-2'::UUID]
-- );
