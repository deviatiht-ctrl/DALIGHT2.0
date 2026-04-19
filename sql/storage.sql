-- ============================================
-- DALIGHT HEAD SPA - CONFIGURATION STORAGE
-- Exécuter après schema.sql
-- ============================================

-- ============================================
-- CRÉATION DES BUCKETS
-- ============================================

-- Bucket pour les vidéos (public en lecture pour streaming)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'videos',
    'videos',
    TRUE,
    104857600, -- 100MB max
    ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket pour les images (avatars, posts, services)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'images',
    'images',
    TRUE,
    5242880, -- 5MB max
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket pour les avatars utilisateurs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    TRUE,
    2097152, -- 2MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket pour les documents (pièces d'identité, reçus) - privé
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    FALSE,
    10485760, -- 10MB max
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- POLICIES STORAGE - VIDEOS
-- ============================================

-- Lecture publique des vidéos
DROP POLICY IF EXISTS "videos_public_read" ON storage.objects;
CREATE POLICY "videos_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos');

-- Admin peut uploader des vidéos
DROP POLICY IF EXISTS "videos_admin_insert" ON storage.objects;
CREATE POLICY "videos_admin_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'videos'
        AND public.is_admin()
    );

-- Admin peut supprimer des vidéos
DROP POLICY IF EXISTS "videos_admin_delete" ON storage.objects;
CREATE POLICY "videos_admin_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'videos'
        AND public.is_admin()
    );

-- Admin peut mettre à jour les métadonnées vidéos
DROP POLICY IF EXISTS "videos_admin_update" ON storage.objects;
CREATE POLICY "videos_admin_update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'videos'
        AND public.is_admin()
    );

-- ============================================
-- POLICIES STORAGE - IMAGES
-- ============================================

-- Lecture publique des images
DROP POLICY IF EXISTS "images_public_read" ON storage.objects;
CREATE POLICY "images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'images');

-- Utilisateurs authentifiés peuvent uploader des images
DROP POLICY IF EXISTS "images_authenticated_insert" ON storage.objects;
CREATE POLICY "images_authenticated_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'images'
        AND auth.role() = 'authenticated'
    );

-- Utilisateurs peuvent supprimer leurs propres images
DROP POLICY IF EXISTS "images_owner_delete" ON storage.objects;
CREATE POLICY "images_owner_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'images'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Admin peut tout gérer sur les images
DROP POLICY IF EXISTS "images_admin_all" ON storage.objects;
CREATE POLICY "images_admin_all" ON storage.objects
    FOR ALL USING (
        bucket_id = 'images'
        AND public.is_admin()
    );

-- ============================================
-- POLICIES STORAGE - AVATARS
-- ============================================

-- Lecture publique des avatars
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

-- Utilisateurs peuvent uploader leur propre avatar
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Utilisateurs peuvent mettre à jour leur propre avatar
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Utilisateurs peuvent supprimer leur propre avatar
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================
-- POLICIES STORAGE - DOCUMENTS (privé)
-- ============================================

-- Utilisateurs peuvent voir leurs propres documents
DROP POLICY IF EXISTS "documents_owner_read" ON storage.objects;
CREATE POLICY "documents_owner_read" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Utilisateurs peuvent uploader leurs documents
DROP POLICY IF EXISTS "documents_owner_insert" ON storage.objects;
CREATE POLICY "documents_owner_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Admin peut voir tous les documents
DROP POLICY IF EXISTS "documents_admin_read" ON storage.objects;
CREATE POLICY "documents_admin_read" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documents'
        AND public.is_admin()
    );

-- Admin peut tout gérer sur les documents
DROP POLICY IF EXISTS "documents_admin_all" ON storage.objects;
CREATE POLICY "documents_admin_all" ON storage.objects
    FOR ALL USING (
        bucket_id = 'documents'
        AND public.is_admin()
    );
