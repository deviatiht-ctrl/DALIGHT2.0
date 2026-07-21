-- ============================================
-- DALIGHT - STAFF PORTAL SYSTEM
-- Interface personnelle par employé (accès par code + lien)
-- Rôles multiples, sessions de service (chronomètre),
-- rapports employés et évaluations admin
-- ============================================

-- ============================================
-- 1. COLONNES SUR presence_employees
-- ============================================
-- roles: liste des attributions (un employé peut être masseuse ET esthéticienne)
-- access_code: code unique pour se connecter au portail
-- portal_enabled: activer/désactiver l'accès au portail
ALTER TABLE presence_employees
  ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS access_code TEXT,
  ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Code d'accès unique (quand présent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_presence_employees_access_code
  ON presence_employees(access_code) WHERE access_code IS NOT NULL;

-- ============================================
-- 2. SESSIONS DE SERVICE (chronomètre)
-- L'employé démarre un service pour un client et on mesure la durée
-- ============================================
CREATE TABLE IF NOT EXISTS service_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES presence_employees(id) ON DELETE CASCADE,
    reservation_id UUID,                 -- optionnel: lien vers reservations.id
    client_name TEXT,
    client_phone TEXT,
    service_name TEXT NOT NULL,
    location TEXT DEFAULT 'Spa',
    status TEXT DEFAULT 'in_progress',   -- in_progress | completed | cancelled
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_sessions_employee ON service_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_service_sessions_status ON service_sessions(status);
CREATE INDEX IF NOT EXISTS idx_service_sessions_started ON service_sessions(started_at);

-- ============================================
-- 3. RAPPORTS DES EMPLOYÉS
-- Chaque employé (selon son rôle) peut soumettre des rapports
-- metrics (jsonb) sert p.ex. au community manager: {"posts":12,"likes":340,...}
-- ============================================
CREATE TABLE IF NOT EXISTS staff_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES presence_employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    role TEXT,                           -- rôle sous lequel le rapport est soumis
    report_type TEXT DEFAULT 'general',  -- general | daily | weekly | monthly | content
    title TEXT NOT NULL,
    content TEXT,
    metrics JSONB DEFAULT '{}'::jsonb,
    period_start DATE,
    period_end DATE,
    status TEXT DEFAULT 'submitted',     -- submitted | reviewed | archived
    admin_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_reports_employee ON staff_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_staff_reports_created ON staff_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_staff_reports_type ON staff_reports(report_type);

-- ============================================
-- 4. ÉVALUATIONS (admin -> employé)
-- ratings (jsonb) p.ex. {"ponctualite":5,"qualite":4,"attitude":5}
-- ============================================
CREATE TABLE IF NOT EXISTS staff_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES presence_employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    evaluator TEXT NOT NULL,             -- nom de l'admin qui évalue
    period TEXT,                         -- ex: "Juillet 2026"
    ratings JSONB DEFAULT '{}'::jsonb,
    overall_score NUMERIC(4,2),          -- note globale /5
    strengths TEXT,
    improvements TEXT,
    comments TEXT,
    visible_to_employee BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_evaluations_employee ON staff_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_staff_evaluations_created ON staff_evaluations(created_at);

-- ============================================
-- 5. RLS + POLICIES
-- Portail sans login Supabase => accès via clé anon.
-- On ouvre en lecture/écriture (l'app filtre par access_code).
-- ============================================
ALTER TABLE service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_sessions_all" ON service_sessions;
CREATE POLICY "service_sessions_all" ON service_sessions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_reports_all" ON staff_reports;
CREATE POLICY "staff_reports_all" ON staff_reports
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_evaluations_all" ON staff_evaluations;
CREATE POLICY "staff_evaluations_all" ON staff_evaluations
  FOR ALL USING (true) WITH CHECK (true);

-- ---- Accès portail (anon = employé connecté par code) ----
-- Le portail n'utilise pas de login Supabase : il faut permettre
-- à la clé anon de lire les employés (validation du code) et les présences,
-- et de mettre à jour le profil de l'employé.
DROP POLICY IF EXISTS "portal_read_employees" ON presence_employees;
CREATE POLICY "portal_read_employees" ON presence_employees
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "portal_update_employees" ON presence_employees;
CREATE POLICY "portal_update_employees" ON presence_employees
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "portal_read_attendance" ON attendance_logs;
CREATE POLICY "portal_read_attendance" ON attendance_logs
  FOR SELECT TO anon USING (true);

-- reservations: lecture pour les prestataires (anon).
-- (À adapter si vous avez déjà des policies plus strictes.)
DROP POLICY IF EXISTS "portal_read_reservations" ON reservations;
CREATE POLICY "portal_read_reservations" ON reservations
  FOR SELECT TO anon USING (true);

-- ============================================
-- 6. FONCTION: générer un code d'accès unique (6 caractères)
-- ============================================
CREATE OR REPLACE FUNCTION generate_staff_access_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sans caractères ambigus
    result TEXT := '';
    i INTEGER;
    exists_count INTEGER;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        SELECT COUNT(*) INTO exists_count FROM presence_employees WHERE access_code = result;
        EXIT WHEN exists_count = 0;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. VÉRIFICATION
-- ============================================
SELECT 'Colonnes ajoutées à presence_employees' AS info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'presence_employees'
AND column_name IN ('roles', 'access_code', 'portal_enabled', 'bio', 'hire_date')
ORDER BY column_name;

SELECT 'Tables créées' AS info;
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('service_sessions', 'staff_reports', 'staff_evaluations')
ORDER BY table_name;
