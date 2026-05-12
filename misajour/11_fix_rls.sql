-- =============================================
-- DALIGHT — Fix RLS Policies
-- =============================================

-- 1. DROP old policies
DROP POLICY IF EXISTS "Clients read own reservations" ON reservations;
DROP POLICY IF EXISTS "Clients insert own reservations" ON reservations;
DROP POLICY IF EXISTS "Clients update own reservations" ON reservations;
DROP POLICY IF EXISTS "Admin full access reservations" ON reservations;

-- 2. CREATE new policies — pèmèt we pa user_id OU user_email
CREATE POLICY "Clients read own reservations"
  ON reservations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Clients insert own reservations"
  ON reservations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Clients update own reservations"
  ON reservations FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (user_id = auth.uid());

-- 3. Admin policy
CREATE POLICY "Admin full access reservations"
  ON reservations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );
