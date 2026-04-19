-- ============================================
-- FIX: Infinite Recursion in profiles RLS Policies
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- This fixes the "infinite recursion detected in policy for relation profiles" error

-- Step 1: Disable RLS temporarily to avoid lock
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "users_can_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_can_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_can_update_any_profile" ON profiles;
DROP POLICY IF EXISTS "admin_can_delete_profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "profiles_enable_read_access" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
DROP POLICY IF EXISTS "Enable delete for users based on id" ON profiles;

-- Step 3: Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create clean, simple policies WITHOUT recursion

-- Policy 1: Users can read their own profile
CREATE POLICY "users_read_own_profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Admin can read all profiles (using JWT claim, not database query)
CREATE POLICY "admin_read_all_profiles"
ON profiles
FOR SELECT
USING (
    current_setting('request.jwt.claims', true)::json->>'email' IN (
        'laurorejeanclarens0@gmail.com'
    )
);

-- Policy 3: Anyone can create their own profile during signup
CREATE POLICY "anyone_create_own_profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policy 4: Users can update their own profile
CREATE POLICY "users_update_own_profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 5: Admin can update any profile (using JWT claim)
CREATE POLICY "admin_update_any_profile"
ON profiles
FOR UPDATE
USING (
    current_setting('request.jwt.claims', true)::json->>'email' IN (
        'laurorejeanclarens0@gmail.com'
    )
);

-- Policy 6: Admin can delete profiles (using JWT claim)
CREATE POLICY "admin_delete_profiles"
ON profiles
FOR DELETE
USING (
    current_setting('request.jwt.claims', true)::json->>'email' IN (
        'laurorejeanclarens0@gmail.com'
    )
);

-- Step 5: Verify policies are created
SELECT 
    policyname,
    cmd,
    qual is not null as has_using,
    with_check is not null as has_with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- You should see 6 policies listed above
-- If you see this output without errors, the fix worked!
