-- ============================================
-- DALIGHT HEAD SPA - CONFIGURATION ADMIN
-- Exécuter en PREMIER
-- ============================================

-- Fonction pour vérifier si l'utilisateur est admin
-- Tcheke ni lis hardcoded ni tab profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    -- Check hardcoded emails (legacy)
    COALESCE(auth.jwt() ->> 'email', '') = ANY(ARRAY[
      'laurorejeanclarens0@gmail.com'
    ])
    OR
    -- Check profiles table role
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    );
$$;

-- ============================================
-- INSTRUCTIONS POUR AJOUTER UN ADMIN
-- ============================================
-- OPTION 1: Hardcoded (ajoute email nan lis anwo)
-- OPTION 2: Profiles table (pi bon metod)
--   UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
-- ============================================
