-- ============================================================
-- FIX ADMIN ACCESS - USE CREATE OR REPLACE (NO DROP)
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- STEP 1: Replace is_admin() function (NO DROP - keeps dependencies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    user_role TEXT;
BEGIN
    -- Get current user email from JWT
    user_email := COALESCE(auth.jwt() ->> 'email', '');
    
    -- Get role from profiles table
    SELECT role INTO user_role
    FROM profiles
    WHERE id = auth.uid();
    
    -- Return TRUE if admin (either by email OR by role)
    RETURN user_email IN ('laurorejeanclarens0@gmail.com', 'dalightbeauty15mai@gmail.com')
        OR user_role = 'admin';
END;
$$;

-- STEP 2: Fix RLS policies - recreate admin policies with fresh is_admin()
DROP POLICY IF EXISTS "reservations_admin_all" ON reservations;
CREATE POLICY "reservations_admin_all" ON reservations
    FOR ALL 
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
CREATE POLICY "profiles_admin_all" ON profiles
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- STEP 3: Ensure both admins have correct role
UPDATE profiles 
SET role = 'admin' 
WHERE email IN ('laurorejeanclarens0@gmail.com', 'dalightbeauty15mai@gmail.com');

-- STEP 4: Test the function
SELECT 
    'is_admin() returns:' as test,
    public.is_admin() as result;

-- STEP 5: Verify both admins
SELECT id, email, role 
FROM profiles 
WHERE email IN ('laurorejeanclarens0@gmail.com', 'dalightbeauty15mai@gmail.com')
ORDER BY email;

-- STEP 6: Count reservations (this number should match for both admins)
SELECT COUNT(*) as total_reservations FROM reservations;
