-- ============================================================
-- COMPLETE FIX - ALL ERRORS (Products, Services, Categories, Head Spa)
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: FIX is_admin() FUNCTION (CRITICAL - No recursion)
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
    user_email := COALESCE(
        current_setting('request.jwt.claims', true)::json->>'email',
        auth.jwt() ->> 'email',
        ''
    );
    RETURN user_email IN (
        'laurorejeanclarens0@gmail.com',
        'dalightbeauty15mai@gmail.com'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ============================================================
-- PART 2: FIX PRODUCT IMAGES STORAGE
-- ============================================================

-- Create product-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop old storage policies
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "product_images_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;

-- Storage policy: Admin can upload to product-images
CREATE POLICY "product_images_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
);

-- Storage policy: Admin can update product-images
CREATE POLICY "product_images_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'product-images'
    AND public.is_admin()
)
WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
);

-- Storage policy: Admin can delete from product-images
CREATE POLICY "product_images_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'product-images'
    AND public.is_admin()
);

-- Storage policy: Public can read product-images
CREATE POLICY "product_images_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- ============================================================
-- PART 3: FIX PRODUCTS TABLE RLS
-- ============================================================

ALTER TABLE products DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_products" ON products;
DROP POLICY IF EXISTS "client_read_products" ON products;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "products_public_read" ON products;
DROP POLICY IF EXISTS "products_auth_read" ON products;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "products_admin_all"
ON products
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Public read active products
CREATE POLICY "products_public_read"
ON products
FOR SELECT
TO anon
USING (is_active = true);

-- Authenticated read active products
CREATE POLICY "products_auth_read"
ON products
FOR SELECT
TO authenticated
USING (is_active = true);

-- ============================================================
-- PART 4: FIX PRODUCT_CATEGORIES TABLE
-- ============================================================

ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_product_categories" ON product_categories;
DROP POLICY IF EXISTS "client_read_product_categories" ON product_categories;
DROP POLICY IF EXISTS "product_categories_admin_all" ON product_categories;
DROP POLICY IF EXISTS "product_categories_public_read" ON product_categories;

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories FORCE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "product_categories_admin_all"
ON product_categories
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Public read active categories
CREATE POLICY "product_categories_public_read"
ON product_categories
FOR SELECT
USING (is_active = true);

-- ============================================================
-- PART 5: FIX SERVICE_CATEGORIES TABLE + ADD ALL CATEGORIES
-- ============================================================

-- Create service_categories if not exists
CREATE TABLE IF NOT EXISTS service_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE service_categories DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read active categories" ON service_categories;
DROP POLICY IF EXISTS "Auth can manage categories" ON service_categories;
DROP POLICY IF EXISTS "service_categories_admin_all" ON service_categories;
DROP POLICY IF EXISTS "service_categories_public_read" ON service_categories;

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories FORCE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "service_categories_admin_all"
ON service_categories
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Public read active
CREATE POLICY "service_categories_public_read"
ON service_categories
FOR SELECT
USING (is_active = true);

-- Insert ALL service categories (your complete list)
INSERT INTO service_categories (slug, label, sort_order) VALUES
    ('headspa', 'Head Spa', 1),
    ('massage-relaxant', 'Massage Relaxant', 2),
    ('wood-therapy', 'Wood Therapy', 3),
    ('packages-silver', 'Packages Silver', 4),
    ('packages-luxury', 'Packages Luxury Golden', 5),
    ('couple-silver', 'Massages Packages Silver Couple', 6),
    ('couple-golden', 'Package Golden Couple', 7),
    ('besties-silver', 'Packege Silver Besties', 8),
    ('besties-golden', 'Packages Golden Besties', 9),
    ('cure', 'Cure', 10),
    ('soin', 'Soin', 11),
    ('autre', 'Autre', 12)
ON CONFLICT (slug) DO UPDATE SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

-- ============================================================
-- PART 6: CREATE HEAD SPA PRICING TABLE (Admin manageable)
-- ============================================================

CREATE TABLE IF NOT EXISTS head_spa_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL UNIQUE CHECK (type IN ('extra-court', 'court', 'medium', 'large', 'extra-large')),
    label TEXT NOT NULL,
    price_htg INTEGER NOT NULL,
    price_usd DECIMAL(10,2),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE head_spa_pricing DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "head_spa_pricing_admin_all" ON head_spa_pricing;
DROP POLICY IF EXISTS "head_spa_pricing_public_read" ON head_spa_pricing;

ALTER TABLE head_spa_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE head_spa_pricing FORCE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "head_spa_pricing_admin_all"
ON head_spa_pricing
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Public read active prices
CREATE POLICY "head_spa_pricing_public_read"
ON head_spa_pricing
FOR SELECT
USING (is_active = true);

-- Seed Head Spa pricing data
INSERT INTO head_spa_pricing (type, label, price_htg, price_usd, description, sort_order) VALUES
    ('extra-court', 'Extra Court', 3000, 25.00, 'Cheveux très courts (moins de 10cm)', 1),
    ('court', 'Court', 4000, 33.00, 'Cheveux courts (10-20cm)', 2),
    ('medium', 'Medium', 5000, 42.00, 'Cheveux mi-longs (20-35cm)', 3),
    ('large', 'Large', 6000, 50.00, 'Cheveux longs (35-50cm)', 4),
    ('extra-large', 'Extra Large', 7500, 62.00, 'Cheveux très longs (plus de 50cm)', 5)
ON CONFLICT (type) DO UPDATE SET
    label = EXCLUDED.label,
    price_htg = EXCLUDED.price_htg,
    price_usd = EXCLUDED.price_usd,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_head_spa_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_head_spa_pricing_updated_at ON head_spa_pricing;
CREATE TRIGGER update_head_spa_pricing_updated_at
    BEFORE UPDATE ON head_spa_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_head_spa_pricing_updated_at();

-- ============================================================
-- PART 7: FIX SERVICES TABLE RLS
-- ============================================================

ALTER TABLE services DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_admin_all" ON services;
DROP POLICY IF EXISTS "services_public_read" ON services;

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "services_admin_all"
ON services
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Public read active services
CREATE POLICY "services_public_read"
ON services
FOR SELECT
USING (is_active = true);

-- ============================================================
-- PART 8: ENSURE ADMIN PROFILES EXIST
-- ============================================================

-- Update existing admin roles
UPDATE profiles 
SET role = 'admin' 
WHERE email IN (
    'laurorejeanclarens0@gmail.com',
    'dalightbeauty15mai@gmail.com'
);

-- Create profiles for admins if missing
INSERT INTO profiles (id, email, role, full_name)
SELECT 
    auth.users.id,
    auth.users.email,
    'admin',
    COALESCE(auth.users.raw_user_meta_data->>'full_name', 'Admin User')
FROM auth.users
WHERE auth.users.email IN (
    'laurorejeanclarens0@gmail.com',
    'dalightbeauty15mai@gmail.com'
)
AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.users.id
);

-- ============================================================
-- PART 9: VERIFICATION QUERIES
-- ============================================================

-- Test is_admin()
SELECT 'is_admin() works' as test, public.is_admin() as result;

-- Show products policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;

-- Show service_categories
SELECT slug, label, sort_order, is_active
FROM service_categories
ORDER BY sort_order;

-- Show head_spa_pricing
SELECT type, label, price_htg, price_usd, is_active
FROM head_spa_pricing
ORDER BY sort_order;

-- Show storage buckets
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'product-images';

-- Show storage policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%product%';

-- ============================================================
-- SUCCESS!
-- ============================================================
-- If all queries above return results without errors, the fix is complete!
-- 
-- Admin can now:
--   ✅ Upload product images to product-images bucket
--   ✅ Add/Edit/Delete products (RLS fixed)
--   ✅ All service categories are created
--   ✅ Manage Head Spa pricing (extra-court: 3000, court: 4000, etc.)
-- ============================================================
