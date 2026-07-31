-- ============================================================
-- DALIGHT — Aksè pòtal anplwaye pou Suivi clients (client_programs)
-- Fichye: 32_staff_client_tracking.sql
-- Kouri nan Supabase SQL Editor apre 26_client_programs.sql
-- ============================================================

-- 1. Kolòn pou konekte yon pwogram ak anplwaye ki responsab li
ALTER TABLE client_programs
  ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES presence_employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_programs_assigned_employee
  ON client_programs(assigned_employee_id);

-- 2. Pèmèt pòtal anplwaye a (kle anon, tankou lòt tab pòtal yo) li/ekri
--    San DELETE — sèlman admin (authenticated + is_admin) ka efase.
ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_program_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_program_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_select_client_programs" ON client_programs;
CREATE POLICY "portal_select_client_programs" ON client_programs
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "portal_insert_client_programs" ON client_programs;
CREATE POLICY "portal_insert_client_programs" ON client_programs
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "portal_update_client_programs" ON client_programs;
CREATE POLICY "portal_update_client_programs" ON client_programs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "portal_select_client_program_sessions" ON client_program_sessions;
CREATE POLICY "portal_select_client_program_sessions" ON client_program_sessions
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "portal_insert_client_program_sessions" ON client_program_sessions;
CREATE POLICY "portal_insert_client_program_sessions" ON client_program_sessions
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "portal_update_client_program_sessions" ON client_program_sessions;
CREATE POLICY "portal_update_client_program_sessions" ON client_program_sessions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "portal_select_client_program_photos" ON client_program_photos;
CREATE POLICY "portal_select_client_program_photos" ON client_program_photos
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "portal_insert_client_program_photos" ON client_program_photos;
CREATE POLICY "portal_insert_client_program_photos" ON client_program_photos
  FOR INSERT TO anon WITH CHECK (true);

-- 3. Mete ajou fonksyon kreyasyon pwogram pou li ka pran anplwaye responsab la
CREATE OR REPLACE FUNCTION create_program_from_reservation(
  p_reservation_id UUID,
  p_total_sessions INTEGER DEFAULT 1,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_therapist_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_service_category TEXT;
  v_program_id UUID;
BEGIN
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  SELECT COALESCE(category, '') INTO v_service_category
  FROM services WHERE id = v_reservation.service_id;

  INSERT INTO client_programs (
    reservation_id,
    client_id,
    client_name,
    client_email,
    client_phone,
    service_id,
    service_name,
    service_category,
    total_sessions,
    status,
    start_date,
    therapist_id,
    assigned_employee_id
  ) VALUES (
    v_reservation.id,
    v_reservation.user_id,
    COALESCE(v_reservation.user_name, ''),
    v_reservation.user_email,
    COALESCE(v_reservation.phone, ''),
    v_reservation.service_id,
    v_reservation.service,
    v_service_category,
    p_total_sessions,
    'active',
    p_start_date,
    p_therapist_id,
    p_employee_id
  )
  RETURNING id INTO v_program_id;

  RETURN v_program_id;
END;
$$;

-- ============================================================
-- 4. TABLE client_reminders — tach / rapèl relance kliyan pa email
-- ============================================================
CREATE TABLE IF NOT EXISTS client_reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID REFERENCES presence_employees(id) ON DELETE SET NULL,
  program_id     UUID REFERENCES client_programs(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  client_name    TEXT NOT NULL,
  client_email   TEXT NOT NULL,
  service_name   TEXT DEFAULT '',
  note           TEXT DEFAULT '',
  remind_at      DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_reminders_employee ON client_reminders(employee_id);
CREATE INDEX IF NOT EXISTS idx_client_reminders_status_date ON client_reminders(status, remind_at);

ALTER TABLE client_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_select_client_reminders" ON client_reminders;
CREATE POLICY "portal_select_client_reminders" ON client_reminders
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "portal_insert_client_reminders" ON client_reminders;
CREATE POLICY "portal_insert_client_reminders" ON client_reminders
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "portal_update_client_reminders" ON client_reminders;
CREATE POLICY "portal_update_client_reminders" ON client_reminders
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS admin_all_client_reminders ON client_reminders;
CREATE POLICY admin_all_client_reminders ON client_reminders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

SELECT 'Suivi clients: acces pòtal anplwaye configire' AS info;
