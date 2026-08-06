-- ============================================================
-- DALIGHT — FIX: Pwogram suivi client pa monte nan pòtal anplwaye
-- Problem: create_program_from_reservation sèlman cheke
-- assigned_employee_id sou rezavasyon an, li pa cheke
-- reservation_employees table (many-to-many).
-- Kouri sa nan Supabase SQL Editor.
-- ============================================================

-- 1. Drop ansyen vèsyon
DROP FUNCTION IF EXISTS public.create_program_from_reservation(UUID, INTEGER, DATE, UUID, UUID);

-- 2. Rekreye fonksyon an ki cheke tou reservation_employees
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

  -- 1. Si anplwaye espesifye ekspresyon, itilize l
  -- 2. Sinon, si rezavasyon gen assigned_employee_id, itilize l
  -- 3. Sinon, cheke nan reservation_employees table
  v_employee_id := COALESCE(p_employee_id, v_reservation.assigned_employee_id);

  IF v_employee_id IS NULL THEN
    SELECT employee_id INTO v_employee_id
    FROM reservation_employees
    WHERE reservation_id = p_reservation_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

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

-- 3. Mete ajou pwogram ki egziste deja ki pa gen assigned_employee_id
-- pou yo pran anplwaye ki asiyen nan reservation_employees
UPDATE client_programs cp
SET assigned_employee_id = sub.employee_id
FROM (
  SELECT DISTINCT ON (re.reservation_id)
    re.reservation_id,
    re.employee_id
  FROM reservation_employees re
  ORDER BY re.reservation_id, re.created_at ASC
) sub
WHERE cp.reservation_id = sub.reservation_id
  AND cp.assigned_employee_id IS NULL;

SELECT 'Fix aplike: create_program_from_reservation + update pwogram ki egziste' AS info;
