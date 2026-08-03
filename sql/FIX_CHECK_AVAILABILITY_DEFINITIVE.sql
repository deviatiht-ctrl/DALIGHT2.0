-- ============================================================
-- DALIGHT — FIX DEFINITIF: check_availability(date, time) is not unique
-- ============================================================
-- KOZ PWOBLEM: Plizyè script (dateheure.sql, repairfic.sql,
-- fix_check_availability.sql, 04_creneaux_fix.sql) te kreye plizyè
-- vèsyon check_availability() ki sipèpoze youn ak lòt (defaults),
-- kidonk Postgres pa ka deside kilès pou l rele lè trigger a
-- rele check_availability(NEW.date, NEW.time) ak 2 agiman sèlman.
--
-- SOLISYON: Efase TOUT ansyen vèsyon yo (tout sinati posib),
-- rekreye YON SÈL vèsyon final ki sipòte service_type (vèsyon
-- ki pi konplè a, konpatib ak admin_block_slot).
-- Kouri fichye sa YON SÈL FWA nan Supabase SQL Editor.
-- ============================================================

-- 1. Drop trigger anvan (pou evite depandans pandan drop)
DROP TRIGGER IF EXISTS check_availability_trigger ON reservations;

-- 2. Drop TOUT sinati posib check_availability ki ka egziste
--     (TIME = TIME WITHOUT TIME ZONE nan Postgres, men nou mete tou de pou safety)
DROP FUNCTION IF EXISTS check_availability(DATE, TIME) CASCADE;
DROP FUNCTION IF EXISTS check_availability(DATE, TIME WITHOUT TIME ZONE) CASCADE;
DROP FUNCTION IF EXISTS check_availability(DATE, TIME, UUID) CASCADE;
DROP FUNCTION IF EXISTS check_availability(DATE, TIME WITHOUT TIME ZONE, UUID) CASCADE;
DROP FUNCTION IF EXISTS check_availability(DATE, TIME, TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_availability(DATE, TIME WITHOUT TIME ZONE, TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_availability(DATE, TIME, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_availability(DATE, TIME WITHOUT TIME ZONE, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_availability() CASCADE;

-- 2b. Drop agresiv: chache epi efase TOUT vèsyon check_availability ki gen egziste
--     (pou ka kote DROP IF EXISTS pa matche ak yon kalite tip ki pa egzak)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'check_availability'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.func_sig);
  END LOOP;
END $$;

-- 3. Drop fonksyon depandan (yo pral rekreye pi ba)
DROP FUNCTION IF EXISTS get_month_availability(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_month_availability(INTEGER, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_next_available_slots(DATE, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS prevent_double_booking() CASCADE;

-- 4. Asire kolòn service_type egziste (idempotan)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'availability_exceptions' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE availability_exceptions ADD COLUMN service_type TEXT DEFAULT 'all';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'availability_rules' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE availability_rules ADD COLUMN service_type TEXT DEFAULT 'all';
  END IF;
END $$;

-- 5. REKREYE YON SÈL vèsyon check_availability (final, kanonik)
CREATE FUNCTION check_availability(
  p_date DATE,
  p_time TIME,
  p_service_id UUID DEFAULT NULL,
  p_service_type TEXT DEFAULT 'all'
)
RETURNS TABLE (
  is_available BOOLEAN,
  remaining_slots INTEGER,
  total_capacity INTEGER,
  current_bookings INTEGER,
  message TEXT
) AS $$
DECLARE
  v_day_of_week INTEGER;
  v_rule RECORD;
  v_exception RECORD;
  v_current_bookings INTEGER;
  v_capacity INTEGER;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT * INTO v_exception
  FROM availability_exceptions
  WHERE exception_date = p_date
    AND (time_slot = p_time OR time_slot IS NULL)
    AND (service_type = p_service_type OR service_type = 'all')
  ORDER BY CASE WHEN service_type = p_service_type THEN 0 ELSE 1 END
  LIMIT 1;

  IF FOUND AND v_exception.is_blocked THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'Kreno sa bloke pa admin'::TEXT;
    RETURN;
  END IF;

  IF FOUND AND v_exception.max_capacity IS NOT NULL THEN
    v_capacity := v_exception.max_capacity;
  END IF;

  SELECT * INTO v_rule
  FROM availability_rules
  WHERE day_of_week = v_day_of_week
    AND time_slot = p_time
    AND (service_type = p_service_type OR service_type = 'all')
  ORDER BY CASE WHEN service_type = p_service_type THEN 0 ELSE 1 END
  LIMIT 1;

  -- SI PA GEN REGLE → DISPONIB PA DEFAULT (kapasite 1)
  IF NOT FOUND THEN
    SELECT COUNT(*) INTO v_current_bookings
    FROM reservations
    WHERE date = p_date
      AND time = p_time
      AND status NOT IN ('cancelled', 'CANCELLED');

    IF v_current_bookings >= v_capacity THEN
      RETURN QUERY SELECT false, 0, v_capacity, v_current_bookings, 'Tan sa fen ranpli'::TEXT;
    ELSE
      RETURN QUERY SELECT true, (v_capacity - v_current_bookings), v_capacity, v_current_bookings, 'Disponib'::TEXT;
    END IF;
    RETURN;
  END IF;

  IF NOT v_rule.is_available THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'Tan sa pa disponib'::TEXT;
    RETURN;
  END IF;

  IF v_capacity IS NULL THEN
    v_capacity := v_rule.max_capacity;
  END IF;

  SELECT COUNT(*) INTO v_current_bookings
  FROM reservations
  WHERE date = p_date
    AND time = p_time
    AND status NOT IN ('cancelled', 'CANCELLED')
    AND (
      p_service_type = 'all'
      OR service_id IN (SELECT id FROM services WHERE category = p_service_type)
    );

  IF v_current_bookings >= v_capacity THEN
    RETURN QUERY SELECT false, 0, v_capacity, v_current_bookings, 'Tan sa fen ranpli'::TEXT;
  ELSE
    RETURN QUERY SELECT true, (v_capacity - v_current_bookings), v_capacity, v_current_bookings, 'Disponib'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Rekreye prevent_double_booking (li rele check_availability ak 2 agiman,
--    OK kounye a paske gen SÈLMAN yon sinati ki gen defaults)
CREATE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_check RECORD;
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_check
  FROM check_availability(NEW.date, NEW.time);

  IF NOT v_check.is_available THEN
    RAISE EXCEPTION 'Tan sa pa disponib: %', v_check.message;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_availability_trigger
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_double_booking();

-- 7. Rekreye get_month_availability (final, ak service_type)
CREATE FUNCTION get_month_availability(
  p_year INTEGER,
  p_month INTEGER,
  p_service_type TEXT DEFAULT 'all'
)
RETURNS TABLE (
  available_date DATE,
  slot_time TIME,
  is_available BOOLEAN,
  max_capacity INTEGER,
  current_bookings INTEGER,
  remaining_slots INTEGER,
  is_exception BOOLEAN
) AS $$
DECLARE
  v_start_date DATE := make_date(p_year, p_month, 1);
  v_end_date DATE := (v_start_date + INTERVAL '1 month - 1 day')::DATE;
BEGIN
  RETURN QUERY
  WITH
  all_dates AS (
    SELECT generate_series(v_start_date, v_end_date, '1 day'::INTERVAL)::DATE AS d
  ),
  date_slots AS (
    SELECT
      d.d AS ds_date,
      ar.time_slot AS ds_time,
      ar.max_capacity AS ds_capacity,
      ar.is_available AS ds_available
    FROM all_dates d
    CROSS JOIN availability_rules ar
    WHERE ar.day_of_week = EXTRACT(DOW FROM d.d)
      AND (ar.service_type = p_service_type OR ar.service_type = 'all')
  ),
  booking_counts AS (
    SELECT r.date AS bc_date, r.time AS bc_time, COUNT(*) AS bc_cnt
    FROM reservations r
    WHERE r.date BETWEEN v_start_date AND v_end_date
      AND r.status NOT IN ('cancelled', 'CANCELLED')
      AND (
        p_service_type = 'all'
        OR EXISTS (SELECT 1 FROM services s WHERE s.id = r.service_id AND s.category = p_service_type)
      )
    GROUP BY r.date, r.time
  ),
  exception_check AS (
    SELECT ae.exception_date AS ec_date, ae.time_slot AS ec_time,
           ae.is_blocked AS ec_blocked, ae.max_capacity AS ec_capacity
    FROM availability_exceptions ae
    WHERE ae.exception_date BETWEEN v_start_date AND v_end_date
      AND (ae.service_type = p_service_type OR ae.service_type = 'all')
  )
  SELECT
    ds.ds_date::DATE,
    ds.ds_time::TIME,
    CASE
      WHEN ec.ec_blocked = true THEN false
      WHEN ds.ds_available = false THEN false
      ELSE true
    END::BOOLEAN,
    COALESCE(ec.ec_capacity, ds.ds_capacity)::INTEGER,
    COALESCE(bc.bc_cnt, 0)::INTEGER,
    GREATEST(0, COALESCE(ec.ec_capacity, ds.ds_capacity) - COALESCE(bc.bc_cnt, 0))::INTEGER,
    (ec.ec_blocked IS NOT NULL)::BOOLEAN
  FROM date_slots ds
  LEFT JOIN booking_counts bc ON ds.ds_date = bc.bc_date AND ds.ds_time = bc.bc_time
  LEFT JOIN exception_check ec ON ds.ds_date = ec.ec_date
    AND (ec.ec_time = ds.ds_time OR ec.ec_time IS NULL)
  WHERE ds.ds_time IS NOT NULL
  ORDER BY ds.ds_date, ds.ds_time;
END;
$$ LANGUAGE plpgsql;

-- 8. VERIFIKASYON — dwe retounen SÈL YON LIY
SELECT proname AS function_name, pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'check_availability';

-- 9. Test rapid
SELECT * FROM check_availability(CURRENT_DATE + 1, '09:00');
