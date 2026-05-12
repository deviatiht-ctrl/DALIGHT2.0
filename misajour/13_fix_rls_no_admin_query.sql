-- =============================================
-- DALIGHT — Fix RLS (no admin query)
-- =============================================

-- 1. DROP all policies
DROP POLICY IF EXISTS "Clients read own reservations" ON reservations;
DROP POLICY IF EXISTS "Clients insert own reservations" ON reservations;
DROP POLICY IF EXISTS "Clients update own reservations" ON reservations;
DROP POLICY IF EXISTS "Admin full access reservations" ON reservations;

-- 2. CREATE client policies — pèmèt we pa user_id OU user_email
CREATE POLICY "Clients read own reservations"
  ON reservations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR user_email = auth.email()
  );

CREATE POLICY "Clients insert own reservations"
  ON reservations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Clients update own reservations"
  ON reservations FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR user_email = auth.email()
  )
  WITH CHECK (user_id = auth.uid());

-- 3. Admin policy — san query auth.users, itilize role nan metadata
-- Note: Si ou vle admin access, ou ka ajoute yon kolòn 'created_by_admin' nan tab
-- epi we sa nan application code olye de RLS
-- Pou kounye a, retire admin policy pou evite erè permission
