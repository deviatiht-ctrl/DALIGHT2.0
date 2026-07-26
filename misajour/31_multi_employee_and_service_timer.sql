-- ============================================
-- DALIGHT - MIGRATION 31
-- Multi-employés par réservation + durée de service + minuteur cible
-- ============================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES presence_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_employee_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS required_employees INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_reservations_assigned ON reservations(assigned_employee_id);

CREATE TABLE IF NOT EXISTS reservation_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES presence_employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reservation_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_employees_reservation ON reservation_employees(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_employees_employee ON reservation_employees(employee_id);

ALTER TABLE service_sessions
  ADD COLUMN IF NOT EXISTS planned_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS planned_duration_minutes INTEGER;

-- Policies portail / admin
DROP POLICY IF EXISTS "portal_read_reservations" ON reservations;
CREATE POLICY "portal_read_reservations" ON reservations
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "portal_update_reservations" ON reservations;
CREATE POLICY "portal_update_reservations" ON reservations
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "portal_select_reservation_employees" ON reservation_employees;
CREATE POLICY "portal_select_reservation_employees" ON reservation_employees
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "authenticated_all_reservation_employees" ON reservation_employees;
CREATE POLICY "authenticated_all_reservation_employees" ON reservation_employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'Migration 31 appliquée' AS info;
