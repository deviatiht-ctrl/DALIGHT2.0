-- ============================================================
-- SISTÈM AVILABILITE REZÈVASYON POU DALIGHT
-- Fichye: dateheure.sql
-- Dat: 2025
-- ============================================================

-- 1. KREYASYON TAB (Si pa egziste)
-- ============================================================

-- Tab pou règ jeneral avilabilite
CREATE TABLE IF NOT EXISTS availability_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    time_slot TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    max_capacity INTEGER DEFAULT 1,
    service_type TEXT DEFAULT 'all',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(day_of_week, time_slot)
);

-- Tab pou eksepsyon (jou/tan espesifik)
CREATE TABLE IF NOT EXISTS availability_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exception_date DATE NOT NULL,
    time_slot TIME,
    is_blocked BOOLEAN DEFAULT true,
    max_capacity INTEGER,
    reason TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exception_date, time_slot)
);

-- Modifye tab rezèvasyon si bezwen
ALTER TABLE reservations 
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'));

-- 2. INDEX POU PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_availability_rules_day_time 
    ON availability_rules(day_of_week, time_slot);

CREATE INDEX IF NOT EXISTS idx_availability_exceptions_date 
    ON availability_exceptions(exception_date);

CREATE INDEX IF NOT EXISTS idx_reservations_date_time_status 
    ON reservations(date, time, status);

-- 3. DONE INITIAL (Règ Default)
-- ============================================================

-- Efase ansyen règ pou rekreye
DELETE FROM availability_rules;

-- Règ default pou Samdi (jou 6)
INSERT INTO availability_rules (day_of_week, time_slot, is_available, max_capacity) VALUES
-- Samdi maten
(6, '08:00', true, 1),
(6, '09:00', true, 2),
(6, '10:00', true, 2),
(6, '11:00', true, 2),
-- Samdi midi (kapasite redwi)
(6, '12:00', true, 1),
(6, '13:00', true, 1),
-- Samdi apremidi
(6, '14:00', true, 2),
(6, '15:00', true, 2),
(6, '16:00', true, 2),
(6, '17:00', true, 1),
-- Samdi swa
(6, '18:00', true, 1),
-- Dimanch fèmen
(0, '00:00', false, 0),
-- Lendi-Vandredi fèmen (oubyen modifye si ou vle ouvri)
(1, '00:00', false, 0),
(2, '00:00', false, 0),
(3, '00:00', false, 0),
(4, '00:00', false, 0),
(5, '00:00', false, 0);

-- 4. FONKSYON KI PI ENPOTAN
-- ============================================================

-- Fonksyon pou verifye avilabilite yon dat/tan
CREATE OR REPLACE FUNCTION check_availability(
    p_date DATE,
    p_time TIME,
    p_service_id UUID DEFAULT NULL
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
    
    -- 1. Tcheke eksepsyon pou dat/tan sa
    SELECT * INTO v_exception
    FROM availability_exceptions
    WHERE exception_date = p_date
      AND (time_slot = p_time OR time_slot IS NULL);
      
    IF FOUND THEN
        IF v_exception.is_blocked AND (v_exception.time_slot IS NULL OR v_exception.time_slot = p_time) THEN
            RETURN QUERY SELECT false, 0, 0, 0, 'Dat/tan sa bloke pa admin'::TEXT;
            RETURN;
        END IF;
        -- Si se yon eksepsyon ki modifye kapasite
        IF v_exception.max_capacity IS NOT NULL THEN
            v_capacity := v_exception.max_capacity;
        END IF;
    END IF;
    
    -- 2. Tcheke règ jeneral
    SELECT * INTO v_rule
    FROM availability_rules
    WHERE day_of_week = v_day_of_week
      AND time_slot = p_time;
      
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, 0, 'Pa gen règ pou tan sa'::TEXT;
        RETURN;
    END IF;
    
    IF NOT v_rule.is_available THEN
        RETURN QUERY SELECT false, 0, 0, 0, 'Tan sa pa disponib'::TEXT;
        RETURN;
    END IF;
    
    -- 3. Deterjine kapasite final
    IF v_capacity IS NULL THEN
        v_capacity := v_rule.max_capacity;
    END IF;
    
    -- 4. Konte rezèvasyon ki egziste
    SELECT COUNT(*) INTO v_current_bookings
    FROM reservations
    WHERE date = p_date
      AND time = p_time
      AND status NOT IN ('cancelled');
    
    -- 5. Retounen rezilta
    IF v_current_bookings >= v_capacity THEN
        RETURN QUERY SELECT 
            false,
            0,
            v_capacity,
            v_current_bookings,
            'Tan sa fen ranpli'::TEXT;
    ELSE
        RETURN QUERY SELECT 
            true,
            v_capacity - v_current_bookings,
            v_capacity,
            v_current_bookings,
            'Disponib'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonksyon pou jere kolizyon
CREATE OR REPLACE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_check RECORD;
BEGIN
    -- Verifye avilabilite
    SELECT * INTO v_check
    FROM check_availability(NEW.date, NEW.time);
    
    IF NOT v_check.is_available THEN
        RAISE EXCEPTION 'Tan sa pa disponib: %', v_check.message;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplike triggè
DROP TRIGGER IF EXISTS check_availability_trigger ON reservations;
CREATE TRIGGER check_availability_trigger
    BEFORE INSERT OR UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_double_booking();

-- 5. FONKSYON POU ADMIN
-- ============================================================

-- Fonksyon pou admin modifye règ
CREATE OR REPLACE FUNCTION admin_set_availability(
    p_day_of_week INTEGER,
    p_time_slot TIME,
    p_is_available BOOLEAN,
    p_max_capacity INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    -- Verifye si admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = v_admin_id AND role = 'admin'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Akse refize: Seul admin ka modifye'
        );
    END IF;
    
    INSERT INTO availability_rules (day_of_week, time_slot, is_available, max_capacity)
    VALUES (p_day_of_week, p_time_slot, p_is_available, p_max_capacity)
    ON CONFLICT (day_of_week, time_slot) 
    DO UPDATE SET 
        is_available = EXCLUDED.is_available,
        max_capacity = EXCLUDED.max_capacity,
        updated_at = NOW();
        
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Règ avilabilite aktyalize',
        'day_of_week', p_day_of_week,
        'time_slot', p_time_slot,
        'is_available', p_is_available,
        'max_capacity', p_max_capacity
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonksyon pou admin bloke yon dat
CREATE OR REPLACE FUNCTION admin_block_date(
    p_date DATE,
    p_time_slot TIME,
    p_reason TEXT DEFAULT 'Bloke pa admin',
    p_is_blocked BOOLEAN DEFAULT true,
    p_max_capacity INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = v_admin_id AND role = 'admin'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Akse refize');
    END IF;
    
    INSERT INTO availability_exceptions 
        (exception_date, time_slot, is_blocked, max_capacity, reason, created_by)
    VALUES (p_date, p_time_slot, p_is_blocked, p_max_capacity, p_reason, v_admin_id)
    ON CONFLICT (exception_date, time_slot)
    DO UPDATE SET 
        is_blocked = EXCLUDED.is_blocked,
        max_capacity = EXCLUDED.max_capacity,
        reason = EXCLUDED.reason,
        created_by = v_admin_id,
        created_at = NOW();
        
    RETURN jsonb_build_object(
        'success', true,
        'action', CASE WHEN p_is_blocked THEN 'bloke' ELSE 'debloké' END,
        'date', p_date,
        'time_slot', p_time_slot
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonksyon pou jere tout disponiblite yon mwa
CREATE OR REPLACE FUNCTION get_month_availability(p_year INTEGER, p_month INTEGER)
RETURNS TABLE (
    available_date DATE,
    time_slot TIME,
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
    -- Jenerer tout dat nan mwa a
    all_dates AS (
        SELECT generate_series(v_start_date, v_end_date, '1 day'::INTERVAL)::DATE as d
    ),
    -- Jenerer tout kombinasyon dat/tan
    date_slots AS (
        SELECT 
            d.d as slot_date,
            ar.time_slot,
            ar.max_capacity,
            ar.is_available as rule_available,
            EXTRACT(DOW FROM d.d) as dow
        FROM all_dates d
        CROSS JOIN availability_rules ar
        WHERE ar.day_of_week = EXTRACT(DOW FROM d.d)
    ),
    -- Konte rezèvasyon yo
    booking_counts AS (
        SELECT 
            date as reservation_date, 
            time as reservation_time, 
            COUNT(*) as cnt
        FROM reservations
        WHERE date BETWEEN v_start_date AND v_end_date
          AND status NOT IN ('cancelled')
        GROUP BY date, time
    ),
    -- Tcheke eksepsyon yo
    exception_check AS (
        SELECT 
            exception_date,
            time_slot,
            is_blocked,
            max_capacity as exc_capacity
        FROM availability_exceptions
        WHERE exception_date BETWEEN v_start_date AND v_end_date
    )
    SELECT 
        ds.slot_date as available_date,
        ds.time_slot as time_slot,
        CASE 
            WHEN ec.is_blocked = true THEN false
            WHEN ds.rule_available = false THEN false
            ELSE true
        END as is_available,
        COALESCE(ec.exc_capacity, ds.max_capacity) as max_capacity,
        COALESCE(bc.cnt, 0) as current_bookings,
        GREATEST(0, COALESCE(ec.exc_capacity, ds.max_capacity) - COALESCE(bc.cnt, 0)) as remaining_slots,
        ec.is_blocked IS NOT NULL as is_exception
    FROM date_slots ds
    LEFT JOIN booking_counts bc 
        ON ds.slot_date = bc.reservation_date 
        AND ds.time_slot = bc.reservation_time
    LEFT JOIN exception_check ec 
        ON ds.slot_date = ec.exception_date 
        AND (ec.time_slot = ds.time_slot OR ec.time_slot IS NULL)
    WHERE ds.time_slot IS NOT NULL
    ORDER BY ds.slot_date, ds.time_slot;
END;
$$ LANGUAGE plpgsql;

-- 6. RLS (SECURITY)
-- ============================================================

-- Aktive RLS
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;

-- Admin ka tout
CREATE POLICY "Admins manage availability_rules" ON availability_rules
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Piblik ka wè
CREATE POLICY "Public view availability_rules" ON availability_rules
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Admin exceptions
CREATE POLICY "Admins manage exceptions" ON availability_exceptions
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public view exceptions" ON availability_exceptions
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 7. DONE TEST
-- ============================================================

-- Ajoute yon eksepsyon test pou demen (fèmen 12h)
-- INSERT INTO availability_exceptions (exception_date, time_slot, is_blocked, reason)
-- VALUES (CURRENT_DATE + INTERVAL '1 day', '12:00:00', true, 'Poz midi - Test');

-- 8. FONKSYON UTIL POU FRONTEND
-- ============================================================

-- Fonksyon pou chaje pwochen tan disponib
CREATE OR REPLACE FUNCTION get_next_available_slots(
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_days_ahead INTEGER DEFAULT 30
)
RETURNS TABLE (
    available_date DATE,
    time_slot TIME,
    remaining_slots INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (check_availability(d, t.time_slot)).*,
        d as available_date,
        t.time_slot
    FROM generate_series(p_start_date, p_start_date + p_days_ahead, '1 day') d
    CROSS JOIN (SELECT DISTINCT time_slot FROM availability_rules WHERE is_available = true) t
    WHERE (check_availability(d, t.time_slot)).is_available = true
      AND (check_availability(d, t.time_slot)).remaining_slots > 0
    ORDER BY d, t.time_slot
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FIN SQL
-- ============================================================
