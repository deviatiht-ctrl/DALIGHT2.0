-- ============================================
-- DALIGHT - ATTENDANCE AUDIT LOG
-- Système de traçabilité pour les suppressions de présence
-- ============================================

-- 1. TABLE POUR ENREGISTRER LES SUPPRESSIONS
CREATE TABLE IF NOT EXISTS attendance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL, -- 'DELETE', 'MODIFY', 'MANUAL_ENTRY'
    employee_id UUID REFERENCES presence_employees(id) ON DELETE SET NULL,
    employee_name TEXT NOT NULL,
    log_date DATE NOT NULL,
    entry_time TIME,
    exit_time TIME,
    deleted_by TEXT NOT NULL, -- Nom de la personne qui a supprimé
    deletion_reason TEXT NOT NULL, -- Motif de la suppression
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    original_data JSONB, -- Données originales avant suppression
    ip_address TEXT,
    user_agent TEXT
);

-- 2. INDEX POUR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_audit_log_employee ON attendance_audit_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON attendance_audit_log(log_date);
CREATE INDEX IF NOT EXISTS idx_audit_log_deleted_at ON attendance_audit_log(deleted_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON attendance_audit_log(action_type);

-- 3. ENABLE RLS
ALTER TABLE attendance_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
DROP POLICY IF EXISTS "Admins can view audit logs" ON attendance_audit_log;
CREATE POLICY "Admins can view audit logs" ON attendance_audit_log
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert audit logs" ON attendance_audit_log;
CREATE POLICY "Admins can insert audit logs" ON attendance_audit_log
    FOR INSERT WITH CHECK (true);

-- 5. VUE POUR VOIR L'HISTORIQUE DES SUPPRESSIONS
CREATE OR REPLACE VIEW v_attendance_deletions AS
SELECT 
    aal.id,
    aal.action_type,
    aal.employee_name,
    aal.log_date,
    aal.entry_time,
    aal.exit_time,
    aal.deleted_by,
    aal.deletion_reason,
    aal.deleted_at,
    aal.original_data,
    pe.photo_url,
    pe."position" as employee_position,
    pe.employee_number
FROM attendance_audit_log aal
LEFT JOIN presence_employees pe ON aal.employee_id = pe.id
ORDER BY aal.deleted_at DESC;

-- 6. FONCTION POUR ENREGISTRER UNE SUPPRESSION
CREATE OR REPLACE FUNCTION log_attendance_deletion(
    p_employee_id UUID,
    p_employee_name TEXT,
    p_log_date DATE,
    p_entry_time TIME,
    p_exit_time TIME,
    p_deleted_by TEXT,
    p_deletion_reason TEXT,
    p_original_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO attendance_audit_log (
        action_type,
        employee_id,
        employee_name,
        log_date,
        entry_time,
        exit_time,
        deleted_by,
        deletion_reason,
        original_data
    ) VALUES (
        'DELETE',
        p_employee_id,
        p_employee_name,
        p_log_date,
        p_entry_time,
        p_exit_time,
        p_deleted_by,
        p_deletion_reason,
        p_original_data
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- 7. RAPPORT DES SUPPRESSIONS PAR PÉRIODE
CREATE OR REPLACE FUNCTION get_deletion_report(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    deletion_date DATE,
    total_deletions BIGINT,
    employees_affected TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aal.deleted_at::DATE as deletion_date,
        COUNT(*) as total_deletions,
        ARRAY_AGG(DISTINCT aal.employee_name) as employees_affected
    FROM attendance_audit_log aal
    WHERE aal.deleted_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY aal.deleted_at::DATE
    ORDER BY deletion_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. STATISTIQUES D'AUDIT
SELECT 
    'Total suppressions' as metric,
    COUNT(*)::TEXT as value
FROM attendance_audit_log
UNION ALL
SELECT 
    'Suppressions ce mois',
    COUNT(*)::TEXT
FROM attendance_audit_log
WHERE deleted_at >= DATE_TRUNC('month', CURRENT_DATE)
UNION ALL
SELECT 
    'Suppressions aujourd''hui',
    COUNT(*)::TEXT
FROM attendance_audit_log
WHERE deleted_at::DATE = CURRENT_DATE;
