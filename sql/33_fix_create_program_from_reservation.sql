-- ============================================================
-- DALIGHT — FIX: fonksyon create_program_from_reservation te gen
-- DE vèsyon (overload) ki te bay erreur "could not choose the
-- best candidate function" lè yo rele l ak sèlman kèk paramèt.
-- Fichye: 33_fix_create_program_from_reservation.sql
-- Kouri sa nan Supabase SQL Editor APRE 26_client_programs.sql
-- ak 32_staff_client_tracking.sql.
-- ============================================================

-- 1. Efase TOUT ansyen vèsyon (overload) ki egziste deja
DROP FUNCTION IF EXISTS public.create_program_from_reservation(UUID, INTEGER, DATE, UUID);
DROP FUNCTION IF EXISTS public.create_program_from_reservation(UUID, INTEGER, DATE, UUID, UUID);

-- 2. Kolòn pou estime dat fen pwogram nan (si li pa la ankò)
ALTER TABLE client_programs
  ADD COLUMN IF NOT EXISTS session_interval_days INTEGER NOT NULL DEFAULT 1;

-- 3. Sèl vèsyon final — yon sèl siyati, pa gen okenn ambiguite ankò
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
BEGIN
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  SELECT COALESCE(category, '') INTO v_service_category
  FROM services WHERE id = v_reservation.service_id;

  -- Si okenn anplwaye pa espesifye, pran otomatikman anplwaye
  -- ki te deja asiyen sou reservation an
  v_employee_id := COALESCE(p_employee_id, v_reservation.assigned_employee_id);

  -- Woodtherapy: chak 2 jou si gen plis pase 1 seance. Lòt sèvis: chak jou.
  IF v_service_category ILIKE '%wood%' AND p_total_sessions > 1 THEN
    v_interval_days := 2;
  ELSE
    v_interval_days := 1;
  END IF;

  v_end_date := p_start_date + ((p_total_sessions - 1) * v_interval_days);

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
    end_date,
    session_interval_days,
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
    v_end_date,
    v_interval_days,
    p_therapist_id,
    v_employee_id
  )
  RETURNING id INTO v_program_id;

  RETURN v_program_id;
END;
$$;

SELECT 'create_program_from_reservation: fonksyon inifye, ambiguite retire' AS info;
