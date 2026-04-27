-- ============================================================
-- FIX ADMIN ACCESS - COMPLETE SOLUTION
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- STEP 1: Delete and recreate is_admin() function properly
DROP FUNCTION IF EXISTS public.is_admin();

CREATE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    user_role TEXT;
BEGIN
    -- Get current user email
    user_email := COALESCE(auth.jwt() ->> 'email', '');
    
    -- Get role from profiles table
    SELECT role INTO user_role
    FROM profiles
    WHERE id = auth.uid();
    
    -- Debug: uncomment to see what's happening
    -- RAISE NOTICE 'Email: %, Role: %', user_email, user_role;
    
    -- Return TRUE if admin (either by email or by role)
    RETURN user_email IN ('laurorejeanclarens0@gmail.com', 'dalightbeauty15mai@gmail.com')
        OR user_role = 'admin';
END;
$$;

-- STEP 2: Fix RLS policies on reservations table - recreate admin policy
DROP POLICY IF EXISTS "reservations_admin_all" ON reservations;

CREATE POLICY "reservations_admin_all" ON reservations
    FOR ALL 
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- STEP 3: Fix RLS policies on profiles table - allow admin to see all
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;

CREATE POLICY "profiles_admin_all" ON profiles
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- STEP 4: Ensure both admins have correct role
UPDATE profiles 
SET role = 'admin' 
WHERE email IN ('laurorejeanclarens0@gmail.com', 'dalightbeauty15mai@gmail.com');

-- STEP 5: Test the function - this should return TRUE for both admins
SELECT 
    'Test is_admin() function' as test,
    public.is_admin() as is_current_user_admin;

-- STEP 6: Verify both admins exist with correct role
SELECT id, email, role, created_at 
FROM profiles 
WHERE email IN ('laurorejeanclarens0@gmail.com', 'dalightbeauty15mai@gmail.com')
ORDER BY email;

-- STEP 7: Count total reservations (admins should see this number)
SELECT COUNT(*) as total_reservations FROM reservations;
