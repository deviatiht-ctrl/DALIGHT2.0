-- ============================================================
-- DALIGHT — Suivi client otomatik + blokaj disponibilite
-- Fichye: 34_auto_program_and_employee_block.sql
-- Kouri sa APRE 33_fix_create_program_from_reservation.sql
--
-- SA FICHYE SA FÈ:
-- 1) Lè yon anplwaye asiyen sou yon reservation Wood Therapy,
--    yon "suivi client" (client_programs) kreye OTOMATIKMAN,
--    avèk anplwaye a byen ini (assigned_employee_id).
-- 2) Chak dat seans (chak 2 jou pou woodtherapy) bloke
--    otomatikman nan "Gestion des disponibilités" avèk non
--    kliyan an ekri kòm rezon blokaj la, jiskaske pwogram nan
--    marke 'completed' oswa 'cancelled'.
-- ============================================================

-- 1. Kolòn pou konekte yon eksepsyon disponibilite ak pwogram nan
ALTER TABLE availability_exceptions
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES client_programs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_availability_exceptions_program ON availability_exceptions(program_id);

-- 1a. Sekirite: si service_type pa la ankò (04_creneaux_fix.sql poko kouri), ajoute li
ALTER TABLE availability_exceptions
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'all';

-- 1b. Asire konstrent UNIQUE la gen service_type ladan (kòm nan 04_creneaux_fix.sql)
ALTER TABLE availability_exceptions
  DROP CONSTRAINT IF EXISTS availability_exceptions_exception_date_time_slot_key;
ALTER TABLE availability_exceptions
  DROP CONSTRAINT IF EXISTS uniq_exception_date_time_service;
ALTER TABLE availability_exceptions
  ADD CONSTRAINT uniq_exception_date_time_service
  UNIQUE(exception_date, time_slot, service_type);

-- 2. Mete ajou create_program_from_reservation pou li kreye blokaj yo tou
CREATE OR REPLACE FUNCTION public.create_program_from_reservation(
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
  v_employee_id UUID;
  v_interval_days INTEGER;
  v_end_date DATE;
  v_is_multi_session BOOLEAN;
  v_session_date DATE;
  i INTEGER;
BEGIN
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  SELECT COALESCE(category, '') INTO v_service_category
  FROM services WHERE id = v_reservation.service_id;

  v_employee_id := COALESCE(p_employee_id, v_reservation.assigned_employee_id);
  v_is_multi_session := v_service_category ILIKE '%wood%' AND p_total_sessions > 1;
  v_interval_days := CASE WHEN v_is_multi_session THEN 2 ELSE 1 END;
  v_end_date := p_start_date + ((p_total_sessions - 1) * v_interval_days);

  INSERT INTO client_programs (
    reservation_id, client_id, client_name, client_email, client_phone,
    service_id, service_name, service_category, total_sessions, status,
    start_date, end_date, session_interval_days, therapist_id, assigned_employee_id
  ) VALUES (
    v_reservation.id, v_reservation.user_id, COALESCE(v_reservation.user_name, ''),
    v_reservation.user_email, COALESCE(v_reservation.phone, ''),
    v_reservation.service_id, v_reservation.service, v_service_category,
    p_total_sessions, 'active', p_start_date, v_end_date, v_interval_days,
    p_therapist_id, v_employee_id
  )
  RETURNING id INTO v_program_id;

  -- Bloke chak dat seans nan kalandriye disponibilite a (woodtherapy plizyè seans)
  IF v_is_multi_session AND v_reservation.time IS NOT NULL THEN
    FOR i IN 0..(p_total_sessions - 1) LOOP
      v_session_date := p_start_date + (i * v_interval_days);
      INSERT INTO availability_exceptions (
        exception_date, time_slot, is_blocked, reason, service_type, program_id
      ) VALUES (
        v_session_date,
        v_reservation.time,
        true,
        'Suivi client: ' || COALESCE(v_reservation.user_name, 'Client') || ' (' || COALESCE(v_employee_id::TEXT, 'N/A') || ')',
        v_service_category,
        v_program_id
      )
      ON CONFLICT (exception_date, time_slot, service_type) DO UPDATE
        SET is_blocked = true, reason = EXCLUDED.reason, program_id = EXCLUDED.program_id;
    END LOOP;
  END IF;

  RETURN v_program_id;
END;
$$;

-- 3. Lè pwogram nan marke 'completed' oswa 'cancelled', debloke tout dat kap vini yo
CREATE OR REPLACE FUNCTION public.free_program_blocks_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> 'active' AND OLD.status = 'active' THEN
    DELETE FROM availability_exceptions
    WHERE program_id = NEW.id
      AND exception_date >= CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_free_program_blocks ON client_programs;
CREATE TRIGGER trg_free_program_blocks
  AFTER UPDATE OF status ON client_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.free_program_blocks_on_status_change();

-- 4. Kreyasyon OTOMATIK pwogram lè yon anplwaye asiyen sou yon reservation
--    Wood Therapy ki poko gen okenn suivi
CREATE OR REPLACE FUNCTION public.auto_create_program_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_category TEXT;
  v_default_sessions INTEGER;
  v_existing UUID;
BEGIN
  IF NEW.assigned_employee_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.assigned_employee_id IS NOT DISTINCT FROM NEW.assigned_employee_id THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing FROM client_programs WHERE reservation_id = NEW.id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    -- Pwogram deja egziste, senpleman senkronize anplwaye a
    UPDATE client_programs SET assigned_employee_id = NEW.assigned_employee_id
      WHERE id = v_existing AND assigned_employee_id IS DISTINCT FROM NEW.assigned_employee_id;
    RETURN NEW;
  END IF;

  SELECT COALESCE(category, '') INTO v_category FROM services WHERE id = NEW.service_id;

  -- Sèlman otomatize pou Wood Therapy (plizyè seans pa default).
  -- Lòt sèvis kontinye kreye manyèlman nan "Démarrer le suivi".
  IF v_category ILIKE '%wood%' THEN
    v_default_sessions := 6;
    PERFORM public.create_program_from_reservation(
      NEW.id, v_default_sessions, COALESCE(NEW.date, CURRENT_DATE), NULL, NEW.assigned_employee_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_create_program_on_assignment ON reservations;
CREATE TRIGGER trg_auto_create_program_on_assignment
  AFTER UPDATE OF assigned_employee_id ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_program_on_assignment();

SELECT 'Suivi client otomatik + blokaj disponibilite: konfigire' AS info;
