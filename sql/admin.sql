-- ============================================
-- DALIGHT HEAD SPA - CONFIGURATION ADMIN
-- Exécuter en PREMIER
-- ============================================

-- Fonction pour vérifier si l'utilisateur est admin (par email)
-- Modifiez la liste des emails admin selon vos besoins
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') = ANY(ARRAY[
    'laurorejeanclarens0@gmail.com'
    -- Ajoutez d'autres emails admin ici:
    -- 'autre.admin@example.com'
  ]);
$$;

-- ============================================
-- INSTRUCTIONS POUR AJOUTER UN ADMIN
-- ============================================
-- Ajoutez l'email dans la fonction is_admin() ci-dessus
-- ============================================
