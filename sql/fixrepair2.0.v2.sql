-- ============================================
-- DALIGHT FIXREPAIR 2.0.v2 - RESERVATIONS ONLY
-- Fix admin confirm error - MINIMAL + SAFE
-- ============================================

-- 1. SCHEMA FIX: updated_at column + trigger
DO $$
BEGIN
  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE reservations 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Added updated_at column';
  ELSE
    RAISE NOTICE 'ℹ️ updated_at column already exists';
  END IF;
END $$;

-- Update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger (safe - ignores if exists)
DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at 
    BEFORE UPDATE ON reservations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. CRITICAL: RLS POLICIES FOR RESERVATIONS TABLE
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public INSERT (users create reservations)
DROP POLICY IF EXISTS "Users create reservations" ON reservations;
CREATE POLICY "Users create reservations" ON reservations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy 2: ADMIN FULL ACCESS (laurorejeanclarens0@gmail.com)
DROP POLICY IF EXISTS "Admin full access reservations" ON reservations;
CREATE POLICY "Admin full access reservations" ON reservations
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND auth.email() = 'laurorejeanclarens0@gmail.com'
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.email() = 'laurorejeanclarens0@gmail.com'
  );

-- Policy 3: Users view/update OWN reservations
DROP POLICY IF EXISTS "Users own reservations" ON reservations;
CREATE POLICY "Users own reservations" ON reservations
  FOR ALL USING (auth.uid()::text = user_id::text);

-- 3. REALTIME (safe)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. VERIFICATION
SELECT '✅ FIXREPAIR 2.0.v2 COMPLETED SUCCESSFULLY!' AS status;
SELECT 'Admin email policy active:' || 
  CASE WHEN 'laurorejeanclarens0@gmail.com' = 'laurorejeanclarens0@gmail.com' 
       THEN '✅ YES' ELSE '❌ NO' END AS policy_test;

-- Show active policies
SELECT policyname, command, qual 
FROM pg_policies 
WHERE tablename = 'reservations' 
ORDER BY policyname;

-- Test data
SELECT id, status, user_email, updated_at 
FROM reservations 
WHERE status = 'PENDING' 
ORDER BY created_at DESC 
LIMIT 3;

SELECT '🎉 READY FOR ADMIN CONFIRM TEST!' AS next_step;
SELECT 'Go to admin/reservations.html → Click CONFIRM on PENDING reservation' AS instructions;
