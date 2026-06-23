-- Fix: Disable RLS on specials tables + Fix storage bucket policies
-- Run this in Supabase SQL Editor

-- 1. Disable RLS on specials tables
ALTER TABLE public.dl_specials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_special_services DISABLE ROW LEVEL SECURITY;

-- 2. Storage policies for specials-flyers bucket
-- Allow anyone to read files (public bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('specials-flyers', 'specials-flyers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Allow authenticated upload specials-flyers" ON storage.objects;
CREATE POLICY "Allow authenticated upload specials-flyers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'specials-flyers');

-- Allow authenticated users to update/delete
DROP POLICY IF EXISTS "Allow authenticated update specials-flyers" ON storage.objects;
CREATE POLICY "Allow authenticated update specials-flyers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'specials-flyers');

DROP POLICY IF EXISTS "Allow authenticated delete specials-flyers" ON storage.objects;
CREATE POLICY "Allow authenticated delete specials-flyers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'specials-flyers');

-- Allow public read
DROP POLICY IF EXISTS "Allow public read specials-flyers" ON storage.objects;
CREATE POLICY "Allow public read specials-flyers"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'specials-flyers');
