-- SQL Script to manage admin users using existing profiles table
-- Run this in your Supabase SQL Editor

-- ============================================
-- MAKE USER AN ADMIN (using email)
-- ============================================
-- Replace 'admin@example.com' with the actual email
-- The user must have already signed up first

-- ADD THIS ADMIN (uncomment and run):
-- UPDATE profiles SET role = 'admin' 
-- WHERE email = 'dalightbeauty15mai@gmail.com';

-- Or use this generic example:
-- UPDATE profiles SET role = 'admin' 
-- WHERE email = 'admin@example.com';

-- ============================================
-- MAKE YOURSELF SUPERADMIN (main admin)
-- ============================================
-- This gives you full control to manage other admins

-- UPDATE profiles SET role = 'superadmin' 
-- WHERE email = 'laurorejeanclarens0@gmail.com';

-- ============================================
-- ADD MULTIPLE ADMINS AT ONCE
-- ============================================
-- Add as many admins as needed in one query

-- UPDATE profiles SET role = 'admin' 
-- WHERE email IN (
--   'admin1@example.com',
--   'admin2@example.com',
--   'admin3@example.com'
-- );

-- ============================================
-- LIST ALL ADMINS
-- ============================================
SELECT * FROM profiles 
WHERE role IN ('admin', 'superadmin') 
ORDER BY role, created_at;

-- ==========================================
-- REMOVE ADMIN RIGHTS (set back to user)
-- ==========================================
-- UPDATE profiles SET role = 'user' 
-- WHERE email = 'admin@example.com';

-- ==========================================
-- READY-TO-RUN COMMAND (just copy and execute)
-- ==========================================
-- Run this exact command to add dalightbeauty15mai@gmail.com as admin:

UPDATE profiles SET role = 'admin' WHERE email = 'dalightbeauty15mai@gmail.com';
