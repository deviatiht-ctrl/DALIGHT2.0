-- ============================================================
-- STEP 1: Check what role dalightbeauty15mai@gmail.com has
-- ============================================================
SELECT id, email, role FROM profiles 
WHERE email = 'dalightbeauty15mai@gmail.com';

-- ============================================================
-- STEP 2: Check total reservations in the database
-- ============================================================
SELECT COUNT(*) as total_reservations FROM reservations;

-- ============================================================
-- STEP 3: Check current is_admin() function definition
-- ============================================================
SELECT prosrc FROM pg_proc WHERE proname = 'is_admin';

-- ============================================================
-- STEP 4: Check RLS policies on reservations table
-- ============================================================
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'reservations';
