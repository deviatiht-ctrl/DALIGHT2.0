-- ============================================
-- DALIGHT RESERVATION REPAIR SCRIPT
-- Fix tables + business hours 8AM-4PM
-- ============================================

-- 1. FIX RESERVATIONS TABLE - Add missing columns
DO $$
BEGIN
  -- reservation_number
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'reservation_number') THEN
    ALTER TABLE reservations ADD COLUMN reservation_number TEXT UNIQUE;
  END IF;
  
  -- user_name, phone, services JSONB, payment_method, deposit_amount, payment_proof_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'user_name') THEN
    ALTER TABLE reservations ADD COLUMN user_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'phone') THEN
    ALTER TABLE reservations ADD COLUMN phone TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'services') THEN
    ALTER TABLE reservations ADD COLUMN services JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'payment_method') THEN
    ALTER TABLE reservations ADD COLUMN payment_method TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'deposit_amount') THEN
    ALTER TABLE reservations ADD COLUMN deposit_amount INTEGER DEFAULT 1000;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'payment_proof_url') THEN
    ALTER TABLE reservations ADD COLUMN payment_proof_url TEXT;
  END IF;
  
  -- updated_at trigger
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_table = 'reservations' AND trigger_name = 'update_reservations_updated_at') THEN
    ALTER TABLE reservations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 2. CREATE TIME_SLOTS TABLE si manquante
CREATE TABLE IF NOT EXISTS time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT DEFAULT 'Spa' CHECK (location IN ('Spa', 'Domicile')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 6), -- Mon-Sat
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_bookings INTEGER DEFAULT 1,
  current_bookings INTEGER DEFAULT 0 CHECK (current_bookings <= max_bookings),
  is_available BOOLEAN GENERATED ALWAYS AS (current_bookings < max_bookings) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. POPULATE BUSINESS HOURS 8AM-4PM Mon-Sat
DELETE FROM time_slots; -- Clear existing

INSERT INTO time_slots (location, day_of_week, start_time, end_time) VALUES
-- Monday (1) to Saturday (6)
('Spa', 1, '08:00', '09:00'),
('Spa', 1, '09:00', '10:00'),
('Spa', 1, '10:00', '11:00'),
('Spa', 1, '11:00', '12:00'),
('Spa', 1, '13:00', '14:00'),
('Spa', 1, '14:00', '15:00'),
('Spa', 1, '15:00', '16:00'),
('Spa', 2, '08:00', '09:00'),
('Spa', 2, '09:00', '10:00'),
('Spa', 2, '10:00', '11:00'),
('Spa', 2, '11:00', '12:00'),
('Spa', 2, '13:00', '14:00'),
('Spa', 2, '14:00', '15:00'),
('Spa', 2, '15:00', '16:00'),
('Spa', 3, '08:00', '09:00'),
('Spa', 3, '09:00', '10:00'),
('Spa', 3, '10:00', '11:00'),
('Spa', 3, '11:00', '12:00'),
('Spa', 3, '13:00', '14:00'),
('Spa', 3, '14:00', '15:00'),
('Spa', 3, '15:00', '16:00'),
('Spa', 4, '08:00', '09:00'),
('Spa', 4, '09:00', '10:00'),
('Spa', 4, '10:00', '11:00'),
('Spa', 4, '11:00', '12:00'),
('Spa', 4, '13:00', '14:00'),
('Spa', 4, '14:00', '15:00'),
('Spa', 4, '15:00', '16:00'),
('Spa', 5, '08:00', '09:00'),
('Spa', 5, '09:00', '10:00'),
('Spa', 5, '10:00', '11:00'),
('Spa', 5, '11:00', '12:00'),
('Spa', 5, '13:00', '14:00'),
('Spa', 5, '14:00', '15:00'),
('Spa', 5, '15:00', '16:00'),
('Spa', 6, '08:00', '09:00'),
('Spa', 6, '09:00', '10:00'),
('Spa', 6, '10:00', '11:00'),
('Spa', 6, '11:00', '12:00'),
('Spa', 6, '13:00', '14:00'),
('Spa', 6, '14:00', '15:00'),
('Spa', 6, '15:00', '16:00');

-- 4. INDEXES pour performance
CREATE INDEX IF NOT EXISTS idx_reservations_date_time_status ON reservations(date, time, status);
CREATE INDEX IF NOT EXISTS idx_reservations_status_date ON reservations(status, date);
CREATE INDEX IF NOT EXISTS idx_time_slots_day_start ON time_slots(day_of_week, start_time);

-- 5. FUNCTION check_availability
CREATE OR REPLACE FUNCTION check_availability(p_date DATE, p_time TIME)
RETURNS BOOLEAN AS $$
DECLARE
  day_num INTEGER;
  slot_count INTEGER;
  bookings_count INTEGER;
BEGIN
  -- Skip Sunday
  day_num := EXTRACT(DOW FROM p_date)::INTEGER;
  IF day_num = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Count matching time slots available
  SELECT COUNT(*) INTO slot_count
  FROM time_slots 
  WHERE day_of_week = day_num 
  AND start_time = p_time 
  AND is_available = TRUE;
  
  -- Count confirmed bookings
  SELECT COUNT(*) INTO bookings_count
  FROM reservations 
  WHERE date = p_date 
  AND time = p_time 
  AND status IN ('PENDING', 'CONFIRMED');
  
  RETURN (slot_count > bookings_count);
END;
$$ LANGUAGE plpgsql;

-- 6. TRIGGER: Block slot on CONFIRMED
CREATE OR REPLACE FUNCTION update_slot_bookings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
    UPDATE time_slots 
    SET current_bookings = current_bookings + 1
    WHERE day_of_week = EXTRACT(DOW FROM NEW.date)::INTEGER
    AND start_time = NEW.time;
  ELSIF NEW.status IN ('CANCELLED', 'NO_SHOW') AND OLD.status = 'CONFIRMED' THEN
    UPDATE time_slots 
    SET current_bookings = current_bookings - 1
    WHERE day_of_week = EXTRACT(DOW FROM NEW.date)::INTEGER
    AND start_time = NEW.time;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trg_reservation_status_update ON reservations;
CREATE TRIGGER trg_reservation_status_update
  AFTER UPDATE OF status ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_slot_bookings();

-- 7. RLS pour time_slots read public
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "time_slots_public_read" ON time_slots;
CREATE POLICY "time_slots_public_read" ON time_slots FOR SELECT USING (TRUE);

-- 8. Enable realtime (ignore si deja)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE time_slots;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Block past dates
INSERT INTO blocked_dates (date, reason) 
SELECT generate_series, 'Past date - Non disponible'
FROM generate_series(current_date - interval '30 days', current_date - interval '1 day', '1 day'::interval)
ON CONFLICT DO NOTHING;

-- EXECUTION SUMMARY (no RAISE for free tier)
SELECT '✅ REPAIR COMPLETÉ!' as status;
SELECT COUNT(*) as time_slots_count FROM time_slots;
SELECT check_availability(current_date + 1, '08:00') as test_08h;
SELECT check_availability(current_date + 1, '07:00') as test_before_8h;


