-- ============================================
-- DALIGHT - PRODUCT IMAGES STORAGE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- This script creates the storage bucket for product images
-- and sets up the necessary policies for access control

-- ============================================
-- STEP 1: CREATE STORAGE BUCKET
-- ============================================

-- Insert the product-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 2: STORAGE POLICIES
-- ============================================

-- Policy: Allow authenticated users (admins) to upload images
CREATE POLICY "Admins can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.email() IN ('laurorejeanclarens0@gmail.com')
);

-- Policy: Allow authenticated users (admins) to update images
CREATE POLICY "Admins can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND auth.email() IN ('laurorejeanclarens0@gmail.com')
);

-- Policy: Allow authenticated users (admins) to delete images
CREATE POLICY "Admins can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND auth.email() IN ('laurorejeanclarens0@gmail.com')
);

-- Policy: Allow public to read product images (since products are public)
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- ============================================
-- STEP 3: VERIFICATION
-- ============================================

-- Check if bucket was created successfully
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'product-images';

-- Check policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%product%';

-- ============================================
-- NOTES:
-- ============================================
-- 1. The bucket is PUBLIC so images can be viewed without authentication
-- 2. Only the admin email can upload/update/delete images
-- 3. Maximum file size: 5MB
-- 4. Allowed formats: JPEG, PNG, GIF, WebP
-- 5. Images are stored in: storage.objects with bucket_id = 'product-images'
-- 6. Public URL format: https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/product-images/products/filename.jpg
