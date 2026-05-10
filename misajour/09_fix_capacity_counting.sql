-- =============================================
-- DALIGHT — Fix Separasyon Kapasite pa Kategori
-- Fichye: 09_fix_capacity_counting.sql
-- Kouri nan Supabase SQL Editor
-- =============================================

-- OBJEKTIF:
-- Lè yon kliyan pran 2 sèvis diferan (ex: Massage + Head Spa)
-- nan menm kreno an, sistèm nan dwe konte yo kòrèkteman 
-- selon limit kapasite admin nan te fikse pou chak kategori.

CREATE OR REPLACE FUNCTION check_availability(
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

  -- 1. Tcheke eksepsyon espesifik pou sèvis sa oswa 'all'
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

  -- 2. Tcheke règ jeneral
  SELECT * INTO v_rule
  FROM availability_rules
  WHERE day_of_week = v_day_of_week
    AND time_slot = p_time
    AND (service_type = p_service_type OR service_type = 'all')
  ORDER BY CASE WHEN service_type = p_service_type THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'Pa gen règ pou tan sa'::TEXT;
    RETURN;
  END IF;

  IF NOT v_rule.is_available THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'Tan sa pa disponib'::TEXT;
    RETURN;
  END IF;

  IF v_capacity IS NULL THEN
    v_capacity := v_rule.max_capacity;
  END IF;

  -- 3. Konte rezèvasyon ki egziste pou sèvis sa
  --    (li tcheke JSON services la tou si moun nan pran plizyè sèvis)
  SELECT COUNT(*) INTO v_current_bookings
  FROM reservations
  WHERE date = p_date
    AND time = p_time
    AND status NOT IN ('cancelled', 'CANCELLED', 'REJECTED')
    AND (
      p_service_type = 'all'
      OR (service_id IS NOT NULL AND service_id IN (SELECT id FROM services WHERE category = p_service_type))
      OR (
         services IS NOT NULL 
         AND jsonb_typeof(services) = 'array' 
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(services) elem
           WHERE (elem->>'category')::TEXT = p_service_type
              OR (elem->>'category')::TEXT ILIKE '%' || p_service_type || '%'
         )
      )
    );

  IF v_current_bookings >= v_capacity THEN
    RETURN QUERY SELECT false, 0, v_capacity, v_current_bookings, 'Tan sa fen ranpli'::TEXT;
  ELSE
    RETURN QUERY SELECT true, (v_capacity - v_current_bookings), v_capacity, v_current_bookings, 'Disponib'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- MIZAJOU get_month_availability POU LI TOU KONTE JSON services LA
DROP FUNCTION IF EXISTS get_month_availability(integer,integer,text);
CREATE OR REPLACE FUNCTION get_month_availability(
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
  remaining_slots INTEGER
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := MAKE_DATE(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  RETURN QUERY
  WITH all_dates AS (
    SELECT generate_series(v_start_date, v_end_date, '1 day'::interval)::DATE AS d
  ),
  rule_slots AS (
    SELECT d.d AS rs_date, ar.time_slot AS rs_time, ar.is_available AS rs_avail, ar.max_capacity AS rs_cap
    FROM all_dates d
    CROSS JOIN availability_rules ar
    WHERE ar.day_of_week = EXTRACT(DOW FROM d.d)
      AND (ar.service_type = p_service_type OR ar.service_type = 'all')
  ),
  booking_counts AS (
    SELECT r.date AS bc_date, r.time AS bc_time, COUNT(*) AS bc_cnt
    FROM reservations r
    WHERE r.date BETWEEN v_start_date AND v_end_date
      AND r.status NOT IN ('cancelled', 'CANCELLED', 'REJECTED')
      AND (
        p_service_type = 'all'
        OR (r.service_id IS NOT NULL AND EXISTS (SELECT 1 FROM services s WHERE s.id = r.service_id AND s.category = p_service_type))
        OR (
           r.services IS NOT NULL 
           AND jsonb_typeof(r.services) = 'array' 
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(r.services) elem
             WHERE (elem->>'category')::TEXT = p_service_type
                OR (elem->>'category')::TEXT ILIKE '%' || p_service_type || '%'
           )
        )
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
    rs.rs_date,
    rs.rs_time,
    -- Disponib si pa bloke epi gen plas
    (COALESCE(ec.ec_blocked, NOT rs.rs_avail) = false) AND (COALESCE(ec.ec_capacity, rs.rs_cap) > COALESCE(bc.bc_cnt, 0)),
    COALESCE(ec.ec_capacity, rs.rs_cap) AS capacity,
    COALESCE(bc.bc_cnt, 0)::INTEGER AS booked,
    GREATEST(0, COALESCE(ec.ec_capacity, rs.rs_cap) - COALESCE(bc.bc_cnt, 0))::INTEGER AS remaining
  FROM rule_slots rs
  LEFT JOIN booking_counts bc ON bc.bc_date = rs.rs_date AND bc.bc_time = rs.rs_time
  LEFT JOIN exception_check ec ON ec.ec_date = rs.rs_date AND (ec.ec_time = rs.rs_time OR ec.ec_time IS NULL);
END;
$$ LANGUAGE plpgsql;
