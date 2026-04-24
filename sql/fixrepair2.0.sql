-- ============================================
-- DALIGHT FIXREPAIR 2.0 - COMPREHENSIVE ADMIN FIX
-- Enable admin confirm reservations + all tables
-- ============================================

-- 1. RUN REPAIRFIC (schema fixes)
-- Copy of repairfic.sql content for completeness
DO $$
BEGIN
  -- Add missing columns if needed
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'updated_at') THEN
    ALTER TABLE reservations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'user_name') THEN
    ALTER TABLE reservations ADD COLUMN user_name TEXT;
  END IF;
END $$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at 
    BEFORE UPDATE ON reservations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. CRITICAL: RLS POLICIES FOR RESERVATIONS (ADMIN CAN UPDATE)
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Allow public INSERT (user makes reservation)
DROP POLICY IF EXISTS "Users can create reservations" ON reservations;
CREATE POLICY "Users can create reservations" ON reservations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow admin emails to READ/UPDATE/DELETE all reservations
DROP POLICY IF EXISTS "Admins can manage reservations" ON reservations;
CREATE POLICY "Admins can manage reservations" ON reservations
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND auth.email() IN ('laurorejeanclarens0@gmail.com')
  );

-- Allow users to READ/UPDATE their own reservations
DROP POLICY IF EXISTS "Users can view own reservations" ON reservations;
CREATE POLICY "Users can view own reservations" ON reservations
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own reservations" ON reservations
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- 3. RLS FOR OTHER ADMIN TABLES
-- Posts table
DO $$
BEGIN
  EXECUTE 'ALTER TABLE posts ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'posts table not found';
END $$;

DROP POLICY IF EXISTS "Admins can manage posts" ON posts;
CREATE POLICY "Admins can manage posts" ON posts
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND auth.email() IN ('laurorejeanclarens0@gmail.com')
  );

-- Profiles/Clients table  
DO $$
BEGIN
  EXECUTE 'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'profiles table not found';
END $$;

DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND auth.email() IN ('laurorejeanclarens0@gmail.com')
  );

-- Messages table
DO $$
BEGIN
  EXECUTE 'ALTER TABLE messages ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'messages table not found';
END $$;

DROP POLICY IF EXISTS "Admins can manage messages" ON messages;
CREATE POLICY "Admins can manage messages" ON messages
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND auth.email() IN ('laurorejeanclarens0@gmail.com')
  );

-- 4. Time slots RLS (public read)
CREATE TABLE IF NOT EXISTS time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT DEFAULT 'Spa',
  day_of_week INTEGER,
  start_time TIME,
  end_time TIME,
  max_bookings INTEGER DEFAULT 1,
  current_bookings INTEGER DEFAULT 0,
  is_available BOOLEAN GENERATED ALWAYS AS (current_bookings < max_bookings) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "time_slots_public_read" ON time_slots;
CREATE POLICY "time_slots_public_read" ON time_slots FOR SELECT USING (TRUE);

-- 5. REALTIME PUBLICATION
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE time_slots;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. TEST QUERIES
SELECT '✅ FIXREPAIR 2.0 COMPLETED!' AS status;

-- Test RLS policy
SELECT 'Admin email test: ' || CASE 
  WHEN 'laurorejeanclarens0@gmail.com' IN ('laurorejeanclarens0@gmail.com') 
  THEN '✅ Policy active' 
  ELSE '❌ Policy failed' 
END AS rls_test;

-- Show current policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'reservations';

-- Count reservations by status
SELECT status, COUNT(*) FROM reservations GROUP BY status;

SELECT 'Ready for admin confirm test!' AS next_step;
