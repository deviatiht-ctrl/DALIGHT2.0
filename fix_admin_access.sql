-- ============================================================
-- DALIGHT - FIX ADMIN ACCESS
-- Execute this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- STEP 1: Update is_admin() function to check profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(auth.jwt() ->> 'email', '') = ANY(ARRAY[
      'laurorejeanclarens0@gmail.com',
      'dalightbeauty15mai@gmail.com'
    ])
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    );
$$;

-- STEP 2: Give dalightbeauty15mai@gmail.com admin role in profiles
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'dalightbeauty15mai@gmail.com';

-- STEP 3: Give laurorejeanclarens0@gmail.com admin role
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'laurorejeanclarens0@gmail.com';

-- STEP 4: Verify - show both admins
SELECT id, email, full_name, role FROM profiles 
WHERE email IN (
  'laurorejeanclarens0@gmail.com',
  'dalightbeauty15mai@gmail.com'
);
