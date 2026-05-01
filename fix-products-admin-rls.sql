-- ============================================================
-- FIX: Admin Products RLS - "new row violates row level security"
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: Fix is_admin() function (SAFER VERSION - no recursion risk)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get current user email from JWT (faster than querying profiles)
    user_email := COALESCE(
        current_setting('request.jwt.claims', true)::json->>'email',
        auth.jwt() ->> 'email',
        ''
    );
    
    -- Return TRUE only if email matches admin emails
    -- This avoids any recursion with profiles table
    RETURN user_email IN (
        'laurorejeanclarens0@gmail.com',
        'dalightbeauty15mai@gmail.com'
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ============================================================
-- STEP 2: Fix products table RLS policies
-- ============================================================

-- Disable RLS temporarily to avoid lock during fix
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on products
DROP POLICY IF EXISTS "admin_all_products" ON products;
DROP POLICY IF EXISTS "client_read_products" ON products;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "products_client_read" ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON products;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON products;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON products;

-- Re-enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner too (important!)
ALTER TABLE products FORCE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: Create NEW clean policies for products
-- ============================================================

-- Policy 1: Admin has FULL access (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "products_admin_all"
ON products
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy 2: Public/Anon can read ACTIVE products only
CREATE POLICY "products_public_read"
ON products
FOR SELECT
TO anon
USING (is_active = true);

-- Policy 3: Authenticated users (non-admin) can read ACTIVE products
CREATE POLICY "products_auth_read"
ON products
FOR SELECT
TO authenticated
USING (is_active = true);

-- ============================================================
-- STEP 4: Fix product_categories table RLS policies
-- ============================================================

-- Disable RLS temporarily
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "admin_all_product_categories" ON product_categories;
DROP POLICY IF EXISTS "client_read_product_categories" ON product_categories;
DROP POLICY IF EXISTS "product_categories_admin_all" ON product_categories;
DROP POLICY IF EXISTS "product_categories_public_read" ON product_categories;

-- Re-enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Force RLS
ALTER TABLE product_categories FORCE ROW LEVEL SECURITY;

-- Policy 1: Admin has FULL access
CREATE POLICY "product_categories_admin_all"
ON product_categories
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy 2: Public can read ACTIVE categories
CREATE POLICY "product_categories_public_read"
ON product_categories
FOR SELECT
USING (is_active = true);

-- ============================================================
-- STEP 5: Ensure admin emails are properly set in auth
-- ============================================================

-- Update profiles to set role = 'admin' for admin emails
UPDATE profiles 
SET role = 'admin' 
WHERE email IN (
    'laurorejeanclarens0@gmail.com',
    'dalightbeauty15mai@gmail.com'
);

-- If profiles don't exist for these emails, create them
INSERT INTO profiles (id, email, role, full_name)
SELECT 
    auth.users.id,
    auth.users.email,
    'admin',
    'Admin User'
FROM auth.users
WHERE auth.users.email IN (
    'laurorejeanclarens0@gmail.com',
    'dalightbeauty15mai@gmail.com'
)
AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.users.id
);

-- ============================================================
-- STEP 6: Verify the fix
-- ============================================================

-- Test is_admin() function
SELECT 
    'Test is_admin() function' as check_name,
    public.is_admin() as result;

-- Show current policies on products
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;

-- Show current policies on product_categories
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename = 'product_categories'
ORDER BY policyname;

-- Count products (to verify SELECT works)
SELECT COUNT(*) as total_products FROM products;

-- Show admin users
SELECT id, email, role 
FROM profiles 
WHERE email IN (
    'laurorejeanclarens0@gmail.com',
    'dalightbeauty15mai@gmail.com'
);

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
-- If you see this output without errors, the fix is complete!
-- Admin should now be able to:
--   1. INSERT (add) new products
--   2. UPDATE (edit) existing products
--   3. DELETE products
--   4. SELECT (view) all products (active and inactive)
-- ============================================================
